import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, getRequestMeta } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { CARACTERES, Caractere, Contagem, contagemVazia, contarCaracteres, totalContagem } from "@/utils/estoque";

export const dynamic = "force-dynamic";

// Imóveis prontos para receber a placa: só estes entram na previsão de produção
const STATUS_PENDENTES = ["LIBERADO", "AUSENTE"];
const DIAS_CONSUMO = 30;

export async function GET() {
    const { response } = await requireUser(["ADMIN", "OPERATOR"]);
    if (response) return response;

    try {
        const desde = new Date(Date.now() - DIAS_CONSUMO * 24 * 60 * 60 * 1000);

        const [itens, imoveis, complementos, bairros, consumo, movimentos] = await Promise.all([
            prisma.estoqueItem.findMany(),
            prisma.imovel.findMany({
                where: { status: { in: STATUS_PENDENTES } },
                select: { numeroAInstalar: true, bairroId: true }
            }),
            // Complementos usam a marcação "liberado para instalação" da prefeitura
            // (ou o próprio status LIBERADO/AUSENTE) e ainda não foram instalados
            prisma.complemento.findMany({
                where: {
                    status: { notIn: ["CONCLUIDO", "PENDENTE"] },
                    OR: [{ liberadoInstalacao: true }, { status: { in: STATUS_PENDENTES } }]
                },
                select: { numeroPredial: true, imovel: { select: { bairroId: true } } }
            }),
            prisma.bairro.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
            prisma.estoqueMovimento.groupBy({
                by: ["caractere"],
                where: { tipo: { in: ["INSTALACAO", "ESTORNO"] }, createdAt: { gte: desde } },
                _sum: { quantidade: true }
            }),
            prisma.estoqueMovimento.findMany({ orderBy: { createdAt: "desc" }, take: 60 })
        ]);

        const estoque = contagemVazia();
        for (const item of itens) {
            if (item.caractere in estoque) estoque[item.caractere as Caractere] = item.quantidade;
        }
        const atualizadoEm = movimentos[0]?.createdAt ?? null;

        // Pendências por bairro (imóveis principais + complementos)
        const porBairro = new Map<string, { contagem: Contagem; imoveis: number; complementos: number }>();
        const doBairro = (bairroId: string) => {
            if (!porBairro.has(bairroId)) porBairro.set(bairroId, { contagem: contagemVazia(), imoveis: 0, complementos: 0 });
            return porBairro.get(bairroId)!;
        };
        for (const im of imoveis) {
            const b = doBairro(im.bairroId);
            contarCaracteres(im.numeroAInstalar, b.contagem);
            b.imoveis++;
        }
        for (const comp of complementos) {
            const b = doBairro(comp.imovel.bairroId);
            contarCaracteres(comp.numeroPredial, b.contagem);
            b.complementos++;
        }

        const geral = contagemVazia();
        const pendentesPorBairro = bairros
            .filter(b => porBairro.has(b.id))
            .map(b => {
                const dados = porBairro.get(b.id)!;
                for (const c of CARACTERES) geral[c] += dados.contagem[c];
                return { bairroId: b.id, nome: b.nome, ...dados, total: totalContagem(dados.contagem) };
            })
            .sort((a, b) => b.total - a.total);

        const consumo30d = contagemVazia();
        for (const row of consumo) {
            if (row.caractere in consumo30d) consumo30d[row.caractere as Caractere] = -(row._sum.quantidade || 0);
        }

        return NextResponse.json({
            estoque,
            atualizadoEm,
            pendentes: {
                geral,
                porBairro: pendentesPorBairro,
                imoveis: imoveis.length,
                complementos: complementos.length
            },
            consumo30d,
            diasConsumo: DIAS_CONSUMO,
            movimentos
        });
    } catch (error) {
        console.error("Erro ao carregar estoque:", error);
        return NextResponse.json({ error: "Erro ao carregar estoque" }, { status: 500 });
    }
}

/**
 * Lançamento manual:
 * - ENTRADA: soma as quantidades ao estoque (ex: lote recebido da produção)
 * - AJUSTE: define o total exato de cada caractere (ex: após contagem física)
 */
export async function POST(req: NextRequest) {
    const { user, response } = await requireUser(["ADMIN"]);
    if (response) return response;

    try {
        const { modo, valores, observacao } = await req.json();
        if (modo !== "ENTRADA" && modo !== "AJUSTE") {
            return NextResponse.json({ error: "Modo inválido." }, { status: 400 });
        }
        if (!valores || typeof valores !== "object") {
            return NextResponse.json({ error: "Informe as quantidades." }, { status: 400 });
        }

        const informados: Partial<Record<Caractere, number>> = {};
        for (const c of CARACTERES) {
            const raw = valores[c];
            if (raw === undefined || raw === null || raw === "") continue;
            const n = Number(raw);
            if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
                return NextResponse.json({ error: `Quantidade inválida para "${c}". Use números inteiros a partir de 0.` }, { status: 400 });
            }
            informados[c] = n;
        }

        const descricao = String(observacao || "").trim().slice(0, 300) || null;

        const alteracoes = await prisma.$transaction(async (tx) => {
            const atuais = await tx.estoqueItem.findMany();
            const atualMap = new Map(atuais.map(i => [i.caractere, i.quantidade]));
            const feitas: { caractere: Caractere; antes: number; delta: number }[] = [];

            for (const c of CARACTERES) {
                const valor = informados[c];
                if (valor === undefined) continue;
                const antes = atualMap.get(c) ?? 0;
                const delta = modo === "ENTRADA" ? valor : valor - antes;
                if (delta === 0) continue;

                await tx.estoqueItem.upsert({
                    where: { caractere: c },
                    update: { quantidade: { increment: delta } },
                    create: { caractere: c, quantidade: delta }
                });
                feitas.push({ caractere: c, antes, delta });
            }

            if (feitas.length > 0) {
                await tx.estoqueMovimento.createMany({
                    data: feitas.map(f => ({
                        caractere: f.caractere,
                        quantidade: f.delta,
                        tipo: modo,
                        descricao: descricao || (modo === "ENTRADA" ? "Entrada de estoque" : "Ajuste de estoque"),
                        userEmail: user.email
                    }))
                });
            }
            return feitas;
        });

        if (alteracoes.length === 0) {
            return NextResponse.json({ error: modo === "ENTRADA" ? "Informe ao menos uma quantidade maior que zero." : "Nenhum valor foi alterado." }, { status: 400 });
        }

        await createAuditLog({
            userId: user.id,
            userEmail: user.email || "admin",
            action: modo === "ENTRADA" ? "ESTOQUE_ENTRADA" : "ESTOQUE_AJUSTE",
            resource: "estoque",
            details: { alteracoes, observacao: descricao },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, alteracoes });
    } catch (error) {
        console.error("Erro ao atualizar estoque:", error);
        return NextResponse.json({ error: "Erro ao atualizar estoque" }, { status: 500 });
    }
}
