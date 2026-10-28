import { apiFetch } from './api';
import { gravar, ler } from './armazenamento';

export type RespostaCache<T> = { dados: T; offline: boolean; salvoEm?: number };

/**
 * GET na API guardando a resposta no celular. Sem internet devolve a última resposta salva
 * (agenda, imóveis do mapa e fichas de imóveis já abertos continuam disponíveis).
 */
export async function apiGetComCache<T = any>(path: string): Promise<RespostaCache<T>> {
    try {
        const res = await apiFetch(path);
        const dados = await res.json();
        if (!res.ok) throw Object.assign(new Error(dados?.error || 'Erro ao carregar'), { http: true });
        gravar('cache', path, { dados, salvoEm: Date.now() }).catch(() => {});
        return { dados, offline: false };
    } catch (e: any) {
        if (e?.http) throw e; // erro do servidor (ex.: 404): não mascara com dado antigo
        const salvo = await ler<{ dados: T; salvoEm: number }>('cache', path).catch(() => undefined);
        if (salvo) return { dados: salvo.dados, offline: true, salvoEm: salvo.salvoEm };
        throw new Error('Sem internet e sem dados salvos no celular para esta tela.');
    }
}

/** Baixa e guarda fichas de imóveis (ex.: os da agenda de hoje) para abrir depois sem internet. */
export async function guardarImoveisOffline(inscimobs: string[]) {
    for (const id of [...new Set(inscimobs)].slice(0, 40)) {
        await apiGetComCache(`/api/instalador/imovel/${id}`).catch(() => {});
    }
}

/** Ficha guardada de um imóvel (sem chamar a rede). */
export async function imovelGuardado(id: string): Promise<any | null> {
    const salvo = await ler<{ dados: any }>('cache', `/api/instalador/imovel/${id}`).catch(() => undefined);
    return salvo?.dados?.imovel || null;
}
