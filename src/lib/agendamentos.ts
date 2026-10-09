import prisma from "@/lib/prisma";

const STATUS_FINALIZADOS = ["CONCLUIDO", "CANCELADO"];

/**
 * Conclui todos os agendamentos em aberto vinculados a um imóvel.
 * Deve ser chamado sempre que o imóvel for marcado como CONCLUIDO,
 * independente de o instalador ter acessado o imóvel pela agenda, mapa ou busca.
 */
export async function concluirAgendamentosDoImovel(inscimob: string) {
    if (!inscimob) return 0;
    const result = await prisma.agendamento.updateMany({
        where: {
            inscimobVinculo: inscimob,
            status: { notIn: STATUS_FINALIZADOS }
        },
        data: { status: "CONCLUIDO" }
    });
    return result.count;
}

/**
 * Sincroniza agendamentos em aberto cujo imóvel vinculado já está CONCLUIDO.
 * Corrige registros antigos que ficaram abertos antes desta regra existir.
 * (Ao criar/vincular um agendamento o imóvel volta para AGENDADO, então
 * imóvel CONCLUIDO + agendamento aberto significa instalação já realizada.)
 */
export async function sincronizarAgendamentosConcluidos() {
    const abertos = await prisma.agendamento.findMany({
        where: {
            status: { notIn: STATUS_FINALIZADOS },
            inscimobVinculo: { not: null }
        },
        select: { inscimobVinculo: true }
    });

    const inscimobs = Array.from(new Set(abertos.map(a => a.inscimobVinculo).filter(Boolean))) as string[];
    if (inscimobs.length === 0) return 0;

    const concluidos = await prisma.imovel.findMany({
        where: { inscimob: { in: inscimobs }, status: "CONCLUIDO" },
        select: { inscimob: true }
    });
    if (concluidos.length === 0) return 0;

    const result = await prisma.agendamento.updateMany({
        where: {
            inscimobVinculo: { in: concluidos.map(i => i.inscimob) },
            status: { notIn: STATUS_FINALIZADOS }
        },
        data: { status: "CONCLUIDO" }
    });
    return result.count;
}
