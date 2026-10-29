/**
 * Itens físicos controlados no estoque de placas.
 * O 6 e o 9 são a mesma peça (basta girar), por isso formam um único item "6/9".
 */
export const CARACTERES = ['0', '1', '2', '3', '4', '5', '6/9', '7', '8', 'C', 'S'] as const;
export type Caractere = typeof CARACTERES[number];

export type Contagem = Record<Caractere, number>;

// Caractere digitado no número -> item do estoque
const ITEM_POR_CARACTERE: Record<string, Caractere> = {
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6/9', '9': '6/9',
    '7': '7', '8': '8', 'C': 'C', 'S': 'S',
};

export function contagemVazia(): Contagem {
    return Object.fromEntries(CARACTERES.map(c => [c, 0])) as Contagem;
}

/** Item de estoque correspondente a um caractere do número (ou null se não é controlado). */
export function itemDoCaractere(ch: string): Caractere | null {
    return ITEM_POR_CARACTERE[ch.toUpperCase()] || null;
}

/**
 * Conta os itens de estoque usados por um número (ex: "296" usa 2, e duas peças "6/9").
 * Espaços e caracteres não controlados (letras diferentes de C e S, hífens) são ignorados.
 */
export function contarCaracteres(numero: string | null | undefined, acumulado: Contagem = contagemVazia()): Contagem {
    for (const ch of String(numero || '')) {
        const item = itemDoCaractere(ch);
        if (item) acumulado[item]++;
    }
    return acumulado;
}

export function totalContagem(contagem: Partial<Contagem>): number {
    return Object.values(contagem).reduce((sum, n) => sum + (n || 0), 0);
}

export type TipoMovimento = 'INSTALACAO' | 'ESTORNO' | 'CORRECAO';

export interface MudancaNumero {
    numero: string | null | undefined;          // número depois da alteração
    numeroAnterior?: string | null | undefined; // número antes da alteração (padrão: o mesmo)
    statusAnterior: string | null | undefined;
    statusNovo: string | null | undefined;
}

/**
 * Peças que uma alteração de imóvel/complemento tira ou devolve ao estoque
 * (quantidade negativa = sai do estoque, positiva = volta para o estoque).
 * - Passou a CONCLUIDO: desconta as peças do número instalado.
 * - Saiu de CONCLUIDO: devolve as peças do número que tinha sido descontado.
 * - Continuou CONCLUIDO com o número corrigido (ex: CS1 → 88CS1): só a diferença de peças.
 */
export function movimentoDoEstoque(m: MudancaNumero): { tipo: TipoMovimento; quantidades: Partial<Contagem> } | null {
    const estavaConcluido = m.statusAnterior === 'CONCLUIDO';
    const ficaConcluido = m.statusNovo === 'CONCLUIDO';
    const descontado = estavaConcluido ? contarCaracteres(m.numeroAnterior ?? m.numero) : contagemVazia();
    const instalado = ficaConcluido ? contarCaracteres(m.numero) : contagemVazia();

    const quantidades: Partial<Contagem> = {};
    for (const c of CARACTERES) {
        const delta = descontado[c] - instalado[c];
        if (delta !== 0) quantidades[c] = delta;
    }
    if (Object.keys(quantidades).length === 0) return null;

    const tipo: TipoMovimento = !estavaConcluido ? 'INSTALACAO' : !ficaConcluido ? 'ESTORNO' : 'CORRECAO';
    return { tipo, quantidades };
}
