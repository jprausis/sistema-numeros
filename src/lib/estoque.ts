import type { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { CARACTERES, contarCaracteres } from "@/utils/estoque";

type Db = Prisma.TransactionClient | typeof prisma;

interface MudancaStatus {
    numero: string | null | undefined;
    statusAnterior: string | null | undefined;
    statusNovo: string | null | undefined;
    referencia: string;
    descricao: string;
    userEmail?: string | null;
}

/**
 * Baixa automática do estoque quando um imóvel/complemento passa a CONCLUIDO,
 * e estorno quando sai de CONCLUIDO (ex: admin corrigiu o status).
 * Assim cada placa instalada é descontada uma única vez.
 */
export async function movimentarEstoquePorStatus(db: Db, mudanca: MudancaStatus) {
    const entrou = mudanca.statusNovo === "CONCLUIDO" && mudanca.statusAnterior !== "CONCLUIDO";
    const saiu = mudanca.statusAnterior === "CONCLUIDO" && mudanca.statusNovo !== "CONCLUIDO";
    if (!entrou && !saiu) return;

    const sinal = entrou ? -1 : 1;
    const contagem = contarCaracteres(mudanca.numero);
    const itens = CARACTERES.filter(c => contagem[c] > 0);
    if (itens.length === 0) return;

    for (const caractere of itens) {
        const delta = sinal * contagem[caractere];
        await db.estoqueItem.upsert({
            where: { caractere },
            update: { quantidade: { increment: delta } },
            create: { caractere, quantidade: delta },
        });
    }

    await db.estoqueMovimento.createMany({
        data: itens.map(caractere => ({
            caractere,
            quantidade: sinal * contagem[caractere],
            tipo: entrou ? "INSTALACAO" : "ESTORNO",
            referencia: mudanca.referencia,
            descricao: `${entrou ? "Instalação" : "Estorno"}: ${mudanca.descricao}`,
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
