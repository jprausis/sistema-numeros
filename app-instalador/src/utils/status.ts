export const STATUS_LABELS: Record<string, string> = {
    NAO_INICIADO: "Não Iniciado",
    LIBERADO: "Liberado",
    AUSENTE: "Ausente",
    PENDENTE: "Pendente",
    CONCLUIDO: "Concluído",
    AGENDADO: "Agendado",
    CANCELADO: "Cancelado",
    REAGENDAR: "Reagendar",
    EM_ROTA: "Em Rota",
};

// Cores usadas nos pinos do mapa e legendas (mesma paleta em todo o sistema)
export const STATUS_COLORS: Record<string, string> = {
    NAO_INICIADO: "#ef4444",
    LIBERADO: "#3b82f6",
    AUSENTE: "#f97316",
    PENDENTE: "#eab308",
    CONCLUIDO: "#22c55e",
    AGENDADO: "#9333ea",
};

export function statusLabel(status?: string | null): string {
    if (!status) return "—";
    return STATUS_LABELS[status] || status;
}

/** Link de WhatsApp a partir de um telefone brasileiro em qualquer formato (com DDD). */
export function whatsappLink(telefone?: string | null, mensagem?: string): string | null {
    const digits = (telefone || "").replace(/\D/g, "");
    if (digits.length < 10) return null;
    const numero = digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
    return `https://wa.me/${numero}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`;
}
