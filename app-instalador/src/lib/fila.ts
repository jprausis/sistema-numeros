import { apiFetch } from './api';
import { apagar, gravar, listar } from './armazenamento';
import { descartarListaImoveis } from './cache';

/**
 * Fila de envio: toda instalação é gravada primeiro no celular e depois enviada ao servidor.
 * Sem internet ela fica guardada e é reenviada sozinha quando a conexão voltar.
 */

export type ComplementoFila = {
    id: string;
    status: string;
    numeroPredial: string;
    foto?: Blob | null;
    fotoUrl?: string | null; // preenchido depois do upload, para não reenviar a foto numa nova tentativa
};

export type ItemFila = {
    chave: string;
    inscimob: string;
    numero: string;
    pasta: string;
    criadoEm: number;
    status: string;
    obsPendente: string | null;
    motivoPendencia: string | null;
    obsInstalacao?: string | null; // itens guardados antes desta versão não têm (o servidor mantém o que já existe)
    protocolo: string | null;
    gps: { lat: number; lon: number; precisao: number | null } | null;
    fotoPrincipal?: Blob | null;
    fotoPrincipalUrl?: string | null;
    complementos: ComplementoFila[];
    tentativas: number;
    erro?: string | null;       // último erro (exibido na lista de envios)
    rejeitado?: boolean;        // o servidor recusou (não é falta de internet): precisa de atenção
};

const PREFIXO = 'fila:';

type Ouvinte = (itens: ItemFila[]) => void;
const ouvintes = new Set<Ouvinte>();
let processando: Promise<ResultadoEnvio> | null = null;

export type ResultadoEnvio = { enviados: number; pendentes: number; semInternet: boolean };

export async function itensFila(): Promise<ItemFila[]> {
    const itens = await listar<ItemFila>('dados', PREFIXO).catch(() => []);
    return itens.sort((a, b) => a.criadoEm - b.criadoEm);
}

async function avisar() {
    const itens = await itensFila();
    ouvintes.forEach(o => o(itens));
}

/** Acompanha a fila (para o contador "aguardando envio"). Retorna a função para parar. */
export function observarFila(ouvinte: Ouvinte): () => void {
    ouvintes.add(ouvinte);
    itensFila().then(ouvinte);
    return () => { ouvintes.delete(ouvinte); };
}

export async function adicionarNaFila(item: Omit<ItemFila, 'chave' | 'tentativas'>): Promise<ItemFila> {
    const completo: ItemFila = { ...item, chave: `${PREFIXO}${item.criadoEm}_${item.inscimob}`, tentativas: 0 };
    await gravar('dados', completo.chave, completo);
    await avisar();
    return completo;
}

export async function descartarDaFila(chave: string) {
    await apagar('dados', chave);
    await avisar();
}

class SemInternet extends Error {}

/** fetch que diferencia "sem internet" (tenta de novo depois) de erro do servidor. */
async function chamar(path: string, init: RequestInit): Promise<Response> {
    try {
        return await apiFetch(path, init);
    } catch {
        throw new SemInternet('Sem conexão com a internet');
    }
}

async function enviarFoto(foto: Blob, item: ItemFila, prefixo: string): Promise<string> {
    const form = new FormData();
    form.append('file', foto, `${item.inscimob}_${prefixo}_${item.criadoEm}.jpg`);
    form.append('folder', item.pasta);
    const res = await chamar('/api/upload', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        if (res.status >= 500 || res.status === 401) throw new SemInternet(data.error || 'Servidor indisponível');
        throw new Error(data.details || data.error || `Falha no envio da foto ${prefixo}`);
    }
    return data.url;
}

async function enviarItem(item: ItemFila, aoProgredir?: (etapa: string) => void) {
    // 1. Fotos (a URL fica salva no item: numa nova tentativa a foto não é enviada de novo)
    if (item.fotoPrincipal && !item.fotoPrincipalUrl) {
        aoProgredir?.('Enviando foto principal...');
        item.fotoPrincipalUrl = await enviarFoto(item.fotoPrincipal, item, 'principal');
        await gravar('dados', item.chave, item);
    }
    for (const comp of item.complementos) {
        if (comp.foto && !comp.fotoUrl) {
            aoProgredir?.(`Enviando foto da unidade ${comp.numeroPredial}...`);
            comp.fotoUrl = await enviarFoto(comp.foto, item, comp.numeroPredial || 'comp');
            await gravar('dados', item.chave, item);
        }
    }

    // 2. Dados da instalação
    aoProgredir?.('Salvando instalação...');
    const res = await chamar('/api/instalador/atualizar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            inscimob: item.inscimob,
            status: item.status,
            obsPendente: item.status === 'PENDENTE' ? item.obsPendente : null,
            motivoPendencia: item.status === 'PENDENTE' ? item.motivoPendencia : null,
            ...(item.status === 'CONCLUIDO' && item.obsInstalacao !== undefined ? { obsInstalacao: item.obsInstalacao } : {}),
            fotos: item.fotoPrincipalUrl ? [item.fotoPrincipalUrl] : [],
            complementosData: item.complementos.map(c => ({
                id: c.id,
                status: c.status,
                numeroPredial: c.numeroPredial,
                fotos: c.fotoUrl ? [c.fotoUrl] : [],
            })),
            protocolo: item.protocolo,
            registradoEm: new Date(item.criadoEm).toISOString(),
            ...(item.gps || {}),
        }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status >= 500 || res.status === 401) throw new SemInternet(data.error || 'Servidor indisponível');
        throw new Error(data.error || 'O servidor recusou a instalação.');
    }
}

/**
 * Envia o que estiver na fila, em ordem. Para no primeiro "sem internet" (o resto espera a conexão).
 * `apenas` limita a um item (envio logo após salvar, mostrando o progresso na tela).
 */
export function processarFila(opcoes: { apenas?: string; aoProgredir?: (etapa: string) => void } = {}): Promise<ResultadoEnvio> {
    if (processando) {
        // Já existe um envio em andamento: espera ele terminar e roda de novo para pegar itens novos
        return processando.then(() => processarFila(opcoes));
    }
    processando = (async () => {
        let enviados = 0;
        let semInternet = false;
        const itens = (await itensFila()).filter(i => !i.rejeitado && (!opcoes.apenas || i.chave === opcoes.apenas));
        for (const item of itens) {
            try {
                await enviarItem(item, opcoes.aoProgredir);
                await apagar('dados', item.chave);
                enviados++;
            } catch (e: any) {
                item.tentativas++;
                item.erro = e?.message || 'Erro ao enviar';
                if (e instanceof SemInternet) {
                    semInternet = true;
                    await gravar('dados', item.chave, item).catch(() => {});
                    break;
                }
                item.rejeitado = true;
                await gravar('dados', item.chave, item).catch(() => {});
            }
        }
        if (enviados > 0) descartarListaImoveis();
        const pendentes = (await itensFila()).length;
        return { enviados, pendentes, semInternet };
    })().finally(() => {
        processando = null;
        avisar();
    });
    return processando;
}

/** Tenta de novo um item que o servidor recusou (ex.: depois de corrigir algo no sistema). */
export async function tentarNovamente(chave: string) {
    const item = (await itensFila()).find(i => i.chave === chave);
    if (!item) return;
    item.rejeitado = false;
    item.erro = null;
    await gravar('dados', chave, item);
    return processarFila({ apenas: chave });
}

/** Envio automático: ao abrir o app, quando a internet volta e a cada minuto. */
export function iniciarEnvioAutomatico(): () => void {
    const tentar = () => {
        if (navigator.onLine && document.visibilityState === 'visible') processarFila().catch(() => {});
    };
    tentar();
    window.addEventListener('online', tentar);
    const timer = window.setInterval(tentar, 60 * 1000);
    return () => {
        window.removeEventListener('online', tentar);
        window.clearInterval(timer);
    };
}
