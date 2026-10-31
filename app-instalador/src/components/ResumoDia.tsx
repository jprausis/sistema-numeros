import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudUpload, Loader2, RotateCw, Trash2, X } from 'lucide-react';
import { apiGetComCache } from '@/lib/cache';
import { descartarDaFila, observarFila, processarFila, tentarNovamente, type ItemFila } from '@/lib/fila';
import { toast } from '@/utils/toast';
import styles from './resumoDia.module.css';

// algarismos: números dos imóveis + complementos instalados hoje (ex.: "365" conta 3, "CS2" conta 3)
type Resumo = { algarismos?: number; concluidos: number; pendentes: number; complementos: number };

const hora = (ms: number) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Resumo do dia do instalador + instalações guardadas no celular aguardando envio. */
export default function ResumoDia() {
    const [resumo, setResumo] = useState<Resumo | null>(null);
    const [fila, setFila] = useState<ItemFila[]>([]);
    const [abrirFila, setAbrirFila] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const tamanhoAnterior = useRef(0);

    const carregarResumo = () => {
        apiGetComCache<Resumo>('/api/instalador/resumo').then(r => setResumo(r.dados)).catch(() => {});
    };

    useEffect(() => {
        carregarResumo();
        // Com a tela apagada ou o app em segundo plano não há quem veja os números
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') carregarResumo();
        }, 2 * 60 * 1000);
        const parar = observarFila(itens => {
            // Algo saiu da fila (foi enviado): atualiza os números do dia
            if (itens.length < tamanhoAnterior.current) carregarResumo();
            tamanhoAnterior.current = itens.length;
            setFila(itens);
        });
        return () => { window.clearInterval(timer); parar(); };
    }, []);

    const comErro = fila.filter(i => i.rejeitado).length;

    const enviarAgora = async () => {
        setEnviando(true);
        const r = await processarFila().catch(() => null);
        setEnviando(false);
        if (!r) return;
        if (r.enviados) toast.success(`${r.enviados} instalação(ões) enviada(s).`);
        else if (r.semInternet) toast.info('Ainda sem internet. O envio será feito sozinho quando a conexão voltar.');
    };

    const descartar = async (item: ItemFila) => {
        if (!confirm(`Descartar a instalação do Nº ${item.numero} guardada no celular? As fotos dela serão apagadas.`)) return;
        await descartarDaFila(item.chave);
    };

    return (
        <>
            <div className={styles.resumo}>
                <div className={styles.numeros} aria-label="Resumo de hoje">
                    <span className={styles.rotulo}>Hoje</span>
                    <span className={styles.numero}><CheckCircle2 size={16} /> <strong>{resumo?.algarismos ?? '–'}</strong> algarismos instalados</span>
                </div>
                {fila.length > 0 && (
                    <button
                        type="button"
                        className={`${styles.filaBtn} ${comErro ? styles.filaErro : ''}`}
                        onClick={() => setAbrirFila(true)}
                    >
                        {comErro ? <AlertTriangle size={16} /> : <CloudUpload size={16} />}
                        {fila.length} aguardando envio
                    </button>
                )}
            </div>

            {abrirFila && (
                <div className={styles.overlay} onClick={() => setAbrirFila(false)}>
                    <div className={styles.sheet} role="dialog" aria-label="Instalações aguardando envio" onClick={e => e.stopPropagation()}>
                        <div className={styles.sheetTopo}>
                            <h3>Guardadas no celular</h3>
                            <button type="button" className={styles.fechar} onClick={() => setAbrirFila(false)} aria-label="Fechar"><X size={20} /></button>
                        </div>
                        <p className={styles.explica}>Estas instalações ainda não chegaram ao sistema. Elas são enviadas sozinhas quando houver internet.</p>

                        {fila.length === 0 && <p className={styles.vazio}>Tudo enviado.</p>}
                        <ul className={styles.lista}>
                            {fila.map(item => (
                                <li key={item.chave} className={item.rejeitado ? styles.itemErro : ''}>
                                    <div className={styles.itemInfo}>
                                        <strong>Nº {item.numero}</strong>
                                        <span>{item.status === 'PENDENTE' ? `Pendência${item.motivoPendencia ? `: ${item.motivoPendencia}` : ''}` : 'Instalação'} • {hora(item.criadoEm)}</span>
                                        {item.erro && <span className={styles.erroTexto}>{item.rejeitado ? 'Recusada: ' : 'Última tentativa: '}{item.erro}</span>}
                                    </div>
                                    <div className={styles.itemAcoes}>
                                        {item.rejeitado && (
                                            <button type="button" onClick={() => tentarNovamente(item.chave)} aria-label="Tentar de novo"><RotateCw size={18} /></button>
                                        )}
                                        <button type="button" onClick={() => descartar(item)} aria-label="Descartar"><Trash2 size={18} /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>

                        {fila.length > 0 && (
                            <button type="button" className={styles.enviarBtn} onClick={enviarAgora} disabled={enviando}>
                                {enviando ? <Loader2 size={18} className="spin" /> : <CloudUpload size={18} />}
                                {enviando ? 'Enviando...' : 'Enviar agora'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
