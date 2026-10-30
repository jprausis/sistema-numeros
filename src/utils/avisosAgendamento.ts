import { formatBrazil, splitBrazilDate } from "@/lib/timezone";

/** Códigos devolvidos pela API (409) quando o agendamento precisa de confirmação do usuário. */
export const CODIGO_IMOVEL_CONCLUIDO = "IMOVEL_CONCLUIDO";
export const CODIGO_AGENDAMENTO_EXISTENTE = "AGENDAMENTO_EXISTENTE";

export type ImovelResumo = {
    inscimob: string;
    numeroAInstalar?: string | null;
    dataExecucao?: Date | string | null;
};

export type AgendamentoResumo = {
    protocolo: string;
    dataHora?: Date | string | null;
    inscimobVinculo?: string | null;
};

export function mensagemImovelConcluido(imovel: ImovelResumo): string {
    const quando = imovel.dataExecucao ? ` em ${formatBrazil(imovel.dataExecucao)}` : "";
    return imovel.numeroAInstalar
        ? `O número ${imovel.numeroAInstalar} (Insc. ${imovel.inscimob}) já foi instalado${quando}.`
        : `O número do imóvel Insc. ${imovel.inscimob} já foi instalado${quando}.`;
}

/** Ex.: "O imóvel Insc. 123 já tem o agendamento PREF-123456 marcado para 30/10/2026 às 09:00." */
export function mensagemAgendamentoExistente(agendamento: AgendamentoResumo): string {
    const imovel = agendamento.inscimobVinculo ? `O imóvel Insc. ${agendamento.inscimobVinculo}` : "Este imóvel";
    const quando = agendamento.dataHora
        ? ` marcado para ${formatBrazil(agendamento.dataHora)} às ${splitBrazilDate(new Date(agendamento.dataHora)).horario}`
        : "";
    return `${imovel} já tem o agendamento ${agendamento.protocolo}${quando}.`;
}

/** Pergunta se é preciso remarcar uma nova visita para um imóvel já concluído. */
export function confirmarRemarcacao(imovel: ImovelResumo): boolean {
    return confirm(`${mensagemImovelConcluido(imovel)}\n\nÉ preciso remarcar uma nova visita? O imóvel volta para "Agendado".`);
}

/** Pergunta se vincula mesmo com outro agendamento em aberto para o mesmo imóvel. */
export function confirmarAgendamentoExistente(agendamento: AgendamentoResumo): boolean {
    return confirm(`${mensagemAgendamentoExistente(agendamento)}\n\nVincular mesmo assim? O imóvel ficará com dois agendamentos em aberto.`);
}

/** Agendamento em aberto do imóvel (ou null), para avisar na tela antes de salvar. */
export async function buscarAgendamentoAberto(inscimob: string): Promise<AgendamentoResumo | null> {
    const res = await fetch(`/api/prefeitura/agendamentos/obter?inscimob=${encodeURIComponent(inscimob)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.agendamento || null;
}

/**
 * POST de agendamento que trata as confirmações pedidas pela API: imóvel já concluído
 * (reenvia com `confirmarConcluido`) e outro agendamento em aberto (reenvia com
 * `confirmarAgendamentoExistente`). Retorna null se o usuário desistir.
 */
export async function postAgendamento(url: string, body: Record<string, unknown>) {
    const enviar = async (corpo: Record<string, unknown>) => {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo)
        });
        const data = await res.json().catch(() => ({}));
        return { res, data };
    };

    let corpo = body;
    let resposta = await enviar(corpo);
    // No máximo uma rodada para cada confirmação
    for (let i = 0; i < 2 && resposta.res.status === 409; i++) {
        const { code, imovel, agendamento } = resposta.data;
        if (code === CODIGO_IMOVEL_CONCLUIDO && !corpo.confirmarConcluido) {
            if (!confirmarRemarcacao(imovel)) return null;
            corpo = { ...corpo, confirmarConcluido: true };
        } else if (code === CODIGO_AGENDAMENTO_EXISTENTE && !corpo.confirmarAgendamentoExistente) {
            if (!confirmarAgendamentoExistente(agendamento)) return null;
            corpo = { ...corpo, confirmarAgendamentoExistente: true };
        } else {
            break;
        }
        resposta = await enviar(corpo);
    }
    return resposta;
}
