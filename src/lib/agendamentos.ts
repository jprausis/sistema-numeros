import prisma from "@/lib/prisma";

const STATUS_FINALIZADOS = ["CONCLUIDO", "CANCELADO"];

/** Gera um protocolo (ex: AG-123456, PREF-123456) garantindo que ainda não existe no banco. */
export async function generateUniqueProtocol(prefix: "AG" | "PREF"): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
        const protocolo = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
        const exists = await prisma.agendamento.findUnique({ where: { protocolo }, select: { protocolo: true } });
        if (!exists) return protocolo;
    }
    // Improvável: fallback com sufixo de tempo para evitar colisão
    return `${prefix}-${Date.now().toString().slice(-8)}`;
}

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

/**
 * Agendamentos oficiais (fila de instalação): protocolo PREF- ou vinculados a um imóvel.
 * Contatos do formulário público guardam em dataHora a data do pedido, não um horário marcado.
 */
export const WHERE_AGENDAMENTO_OFICIAL = {
    OR: [
        { protocolo: { startsWith: "PREF-" } },
        { inscimobVinculo: { not: null } }
    ]
};

/** Agendamento ativo que já ocupa o mesmo horário (exceto o próprio protocolo), ou null se estiver livre. */
export async function buscarConflitoHorario(dataHora: Date, ignorarProtocolo?: string | null) {
    return prisma.agendamento.findFirst({
        where: {
            AND: [WHERE_AGENDAMENTO_OFICIAL],
            dataHora,
            status: { notIn: STATUS_FINALIZADOS },
            ...(ignorarProtocolo ? { NOT: { protocolo: ignorarProtocolo } } : {})
        },
        select: { protocolo: true, nome: true, inscimobVinculo: true }
    });
}

export function mensagemConflitoHorario(conflito: { protocolo: string; inscimobVinculo: string | null }, horario: string) {
    return `O horário ${horario} deste dia já está ocupado pelo agendamento ${conflito.protocolo}`
        + (conflito.inscimobVinculo ? ` (Insc. ${conflito.inscimobVinculo})` : "")
        + ". Escolha outro horário.";
}
