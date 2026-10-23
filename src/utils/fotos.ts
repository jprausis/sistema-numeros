/**
 * Helpers para o campo `fotos`, que pode estar salvo como JSON (["url"]),
 * como URL simples ou como lista separada por vírgula (registros antigos).
 */

/** Retorna todas as URLs contidas no campo. */
export function listFotos(fotosStr: unknown): string[] {
    if (!fotosStr) return [];
    const trimmed = String(fotosStr).trim();
    if (!trimmed || trimmed === "null" || trimmed === "[]") return [];

    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed);
            const list = Array.isArray(parsed) ? parsed : [parsed];
            return list.map(item => String(item).trim()).filter(Boolean);
        } catch {
            // Formato antigo: [url1, url2] sem aspas válidas
            return trimmed
                .replace(/^\[|\]$/g, "")
                .split(",")
                .map(s => s.replace(/["']/g, "").trim())
                .filter(Boolean);
        }
    }
    return [trimmed];
}

/** Primeira foto do campo (ou null). */
export function parseFotos(fotosStr: unknown): string | null {
    return listFotos(fotosStr)[0] || null;
}

/** Indica se o campo contém ao menos uma foto. */
export function temFotosReais(fotosStr: unknown): boolean {
    return listFotos(fotosStr).length > 0;
}

/** URLs separadas por vírgula, para relatórios. */
export function limparLinksImagens(fotosStr: unknown): string {
    return listFotos(fotosStr).join(", ");
}

/** Foto mais relevante de um imóvel: a da instalação se concluído, senão a de orientação. */
export function fotoDestaque(imovel: { status?: string; fotos?: unknown; fotoLocalInstalacao?: unknown }) {
    const instalacao = parseFotos(imovel.fotos);
    if (imovel.status === "CONCLUIDO") {
        return instalacao ? { url: instalacao, tipo: "Instalação" as const } : null;
    }
    const orientacao = parseFotos(imovel.fotoLocalInstalacao);
    if (orientacao) return { url: orientacao, tipo: "Orientação" as const };
    return instalacao ? { url: instalacao, tipo: "Instalação" as const } : null;
}
