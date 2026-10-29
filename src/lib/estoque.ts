import type { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { CARACTERES, type MudancaNumero, movimentoDoEstoque } from "@/utils/estoque";

type Db = Prisma.TransactionClient | typeof prisma;

interface MudancaStatus extends MudancaNumero {
    referencia: string;
    descricao: string;
    userEmail?: string | null;
}

/**
 * Baixa automática do estoque quando um imóvel/complemento passa a CONCLUIDO,
 * estorno quando sai de CONCLUIDO (ex: admin corrigiu o status) e correção quando
 * o número de algo já concluído é alterado (ex: instalador trocou CS1 por 88CS1).
 * Assim cada placa instalada é descontada uma única vez, com as peças certas.
 */
export async function movimentarEstoquePorStatus(db: Db, mudanca: MudancaStatus) {
    const movimento = movimentoDoEstoque(mudanca);
    if (!movimento) return;

    const itens = CARACTERES.filter(c => movimento.quantidades[c]);
    for (const caractere of itens) {
        const delta = movimento.quantidades[caractere]!;
        await db.estoqueItem.upsert({
            where: { caractere },
            update: { quantidade: { increment: delta } },
            create: { caractere, quantidade: delta },
        });
    }

    const titulo = movimento.tipo === "INSTALACAO" ? "Instalação"
        : movimento.tipo === "ESTORNO" ? "Estorno"
        : `Correção do número ${mudanca.numeroAnterior} → ${mudanca.numero}`;
    await db.estoqueMovimento.createMany({
        data: itens.map(caractere => ({
            caractere,
            quantidade: movimento.quantidades[caractere]!,
            tipo: movimento.tipo,
            referencia: mudanca.referencia,
            descricao: `${titulo}: ${mudanca.descricao}`,
            userEmail: mudanca.userEmail || null,
        })),
    });
}

/** Não deixa uma falha no estoque impedir o registro da instalação em campo. */
export async function movimentarEstoqueSeguro(db: Db, mudanca: MudancaStatus) {
    try {
        await movimentarEstoquePorStatus(db, mudanca);
    } catch (error) {
        console.error("Erro ao movimentar estoque:", error, mudanca);
    }
}

// Imóveis prontos para receber a placa: só estes entram na previsão de produção
export const STATUS_PENDENTES_PRODUCAO = ["LIBERADO", "AUSENTE"];

/**
 * Imóveis e complementos que ainda vão consumir algarismos (previsão de produção).
 * Bairros marcados como concluídos ficam de fora: o que sobrou neles não será instalado.
 * Complementos usam a marcação "liberado para instalação" da prefeitura
 * (ou o próprio status LIBERADO/AUSENTE) e ainda não foram instalados.
 */
export async function buscarPendentesProducao(db: Db = prisma) {
    const [imoveis, complementos] = await Promise.all([
        db.imovel.findMany({
            where: { status: { in: STATUS_PENDENTES_PRODUCAO }, bairro: { status: { not: "CONCLUIDO" } } },
            select: { numeroAInstalar: true, bairroId: true }
        }),
        db.complemento.findMany({
            where: {
                status: { notIn: ["CONCLUIDO", "PENDENTE"] },
                imovel: { bairro: { status: { not: "CONCLUIDO" } } },
                OR: [{ liberadoInstalacao: true }, { status: { in: STATUS_PENDENTES_PRODUCAO } }]
            },
            select: { numeroPredial: true, imovel: { select: { bairroId: true } } }
        })
    ]);
    return { imoveis, complementos };
}
