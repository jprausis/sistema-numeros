/** Caracteres físicos controlados no estoque de placas. */
export const CARACTERES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', 'S'] as const;
export type Caractere = typeof CARACTERES[number];

export type Contagem = Record<Caractere, number>;

export function contagemVazia(): Contagem {
    return Object.fromEntries(CARACTERES.map(c => [c, 0])) as Contagem;
}

/**
 * Conta os caracteres controlados de um número (ex: "297" ou "CS 2").
 * Espaços e caracteres não controlados (letras diferentes de C e S, hífens) são ignorados.
 */
export function contarCaracteres(numero: string | null | undefined, acumulado: Contagem = contagemVazia()): Contagem {
    for (const ch of String(numero || '').toUpperCase()) {
        if (ch in acumulado) acumulado[ch as Caractere]++;
    }
    return acumulado;
}

export function totalContagem(contagem: Partial<Contagem>): number {
    return Object.values(contagem).reduce((sum, n) => sum + (n || 0), 0);
}
