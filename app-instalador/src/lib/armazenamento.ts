/**
 * Armazenamento local no celular (IndexedDB): guarda fotos (Blob) e dados para uso sem internet.
 * Duas "tabelas": cache (respostas da API) e dados (fila de envio, rascunhos).
 */
const DB_NOME = 'instalador';
const LOJAS = ['cache', 'dados'] as const;
type Loja = typeof LOJAS[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NOME, 1);
            req.onupgradeneeded = () => {
                for (const loja of LOJAS) {
                    if (!req.result.objectStoreNames.contains(loja)) req.result.createObjectStore(loja);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => { dbPromise = null; reject(req.error); };
        });
    }
    return dbPromise;
}

function executar<T>(loja: Loja, modo: IDBTransactionMode, acao: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    return abrir().then(db => new Promise<T>((resolve, reject) => {
        const tx = db.transaction(loja, modo);
        const req = acao(tx.objectStore(loja));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    }));
}

export const ler = <T>(loja: Loja, chave: string) => executar<T | undefined>(loja, 'readonly', s => s.get(chave));
export const gravar = (loja: Loja, chave: string, valor: unknown) => executar<void>(loja, 'readwrite', s => s.put(valor, chave));
export const apagar = (loja: Loja, chave: string) => executar<void>(loja, 'readwrite', s => s.delete(chave));

/** Todas as entradas cujo nome começa com `prefixo`. */
export async function listar<T>(loja: Loja, prefixo: string): Promise<T[]> {
    const faixa = IDBKeyRange.bound(prefixo, prefixo + '￿');
    return executar<T[]>(loja, 'readonly', s => s.getAll(faixa));
}
