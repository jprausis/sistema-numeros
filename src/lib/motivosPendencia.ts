/** Motivos padronizados de pendência (mesma lista no app: app-instalador/src/utils/motivosPendencia.ts). */
export const MOTIVOS_PENDENCIA = [
    "Morador ausente",
    "Fachada sem lugar para a placa",
    "Endereço não encontrado",
    "Morador recusou",
    "Outro",
] as const;

export function motivoValido(motivo: unknown): string | null {
    return typeof motivo === "string" && (MOTIVOS_PENDENCIA as readonly string[]).includes(motivo) ? motivo : null;
}
