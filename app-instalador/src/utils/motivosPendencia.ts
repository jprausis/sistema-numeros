/** Motivos padronizados de pendência (mesma lista do servidor: src/lib/motivosPendencia.ts). */
export const MOTIVOS_PENDENCIA = [
    "Morador ausente",
    "Fachada sem lugar para a placa",
    "Endereço não encontrado",
    "Morador recusou",
    "Outro",
] as const;

export type MotivoPendencia = typeof MOTIVOS_PENDENCIA[number];

/** Texto salvo em obsPendente (o admin e a prefeitura já exibem esse campo). */
export function montarObsPendente(motivo: string, detalhe: string): string {
    const d = detalhe.trim();
    if (!motivo) return d;
    return d ? `${motivo} — ${d}` : motivo;
}

/** Separa "Motivo — detalhe" de volta (ao reabrir um imóvel pendente). */
export function separarObsPendente(obs: string | null | undefined, motivoSalvo?: string | null): { motivo: string; detalhe: string } {
    const texto = (obs || '').trim();
    const motivo = motivoSalvo && (MOTIVOS_PENDENCIA as readonly string[]).includes(motivoSalvo) ? motivoSalvo : '';
    if (motivo && texto.startsWith(motivo)) {
        return { motivo, detalhe: texto.slice(motivo.length).replace(/^\s*—\s*/, '') };
    }
    return { motivo, detalhe: texto };
}
