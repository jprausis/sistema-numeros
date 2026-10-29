'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X, MapPin, Navigation, Copy, Check, Camera, Image as ImageIcon } from 'lucide-react';
import styles from './imovelInfo.module.css';
import { statusLabel, STATUS_COLORS } from '@/utils/status';
import { listFotos, parseFotos } from '@/utils/fotos';
import { utmToLatLng } from '@/utils/geo';
import { formatBrazil } from '@/lib/timezone';

type Props = {
    inscimob: string;
    onClose: () => void;
    /** Dados já carregados na tela (abre na hora, sem esperar a API) */
    initial?: any;
    /** Ações extras no rodapé (ex.: "Instalar / Concluir" no painel do instalador) */
    actions?: ReactNode;
};

/** Ficha do imóvel (somente leitura), aberta ao clicar na inscrição imobiliária. */
export default function ImovelInfoModal({ inscimob, onClose, actions, initial }: Props) {
    const [imovel, setImovel] = useState<any | null>(initial || null);
    const [erro, setErro] = useState<string | null>(null);
    const [copiado, setCopiado] = useState(false);
    const [fotoAberta, setFotoAberta] = useState<string | null>(null);

    useEffect(() => {
        if (initial) return;
        let ativo = true;
        setImovel(null);
        setErro(null);
        fetch(`/api/instalador/imovel/${encodeURIComponent(inscimob)}`)
            .then(async res => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao carregar imóvel');
                if (ativo) setImovel(data.imovel);
            })
            .catch(e => ativo && setErro(e.message || 'Erro ao carregar imóvel'));
        return () => { ativo = false; };
    }, [inscimob, initial]);

    // Esc fecha (primeiro a foto ampliada, depois o modal)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (fotoAberta) setFotoAberta(null);
            else onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [fotoAberta, onClose]);

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(inscimob);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
        } catch { /* sem permissão de área de transferência */ }
    };

    const rota = imovel?.x && imovel?.y
        ? (() => {
            const [lat, lng] = utmToLatLng(imovel.x, imovel.y);
            return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        })()
        : null;

    const fotoOrientacao = parseFotos(imovel?.fotoLocalInstalacao);
    const fotosInstalacao = listFotos(imovel?.fotos);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div
                className={styles.sheet}
                role="dialog"
                aria-modal="true"
                aria-labelledby="imovel-info-title"
                onClick={e => e.stopPropagation()}
            >
                <div className={styles.head}>
                    <div className={styles.headText}>
                        <span className={styles.kicker}>Ficha do imóvel</span>
                        <h3 id="imovel-info-title">
                            {imovel ? `Nº ${imovel.numeroAInstalar || 'S/N'}` : 'Carregando...'}
                        </h3>
                        <button type="button" className={styles.inscCopy} onClick={copiar} title="Copiar inscrição">
                            <span>Insc. {inscimob}</span>
                            {copiado ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                    </div>
                    <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.body}>
                    {erro ? (
                        <p className={styles.erro}>{erro}</p>
                    ) : !imovel ? (
                        <p className={styles.loading}>Carregando informações do imóvel...</p>
                    ) : (
                        <>
                            <div className={styles.statusRow}>
                                <span className={styles.status}>
                                    <span className={styles.dot} style={{ background: STATUS_COLORS[imovel.status] || '#94a3b8' }} />
                                    {statusLabel(imovel.status)}
                                </span>
                                {imovel.complementos?.length > 0 && (
                                    <span className={styles.chip}>+{imovel.complementos.length} complementos</span>
                                )}
                            </div>

                            <dl className={styles.grid}>
                                <div>
                                    <dt>Bairro</dt>
                                    <dd>{imovel.bairro?.nome || '—'}</dd>
                                </div>
                                <div>
                                    <dt>Endereço</dt>
                                    <dd>{imovel.endereco || '—'}</dd>
                                </div>
                                {imovel.dataExecucao && (
                                    <div>
                                        <dt>{imovel.status === 'CONCLUIDO' ? 'Instalado em' : 'Última execução'}</dt>
                                        <dd>{formatBrazil(imovel.dataExecucao, true)}</dd>
                                    </div>
                                )}
                                {imovel.instaladorResp && (
                                    <div>
                                        <dt>Instalador</dt>
                                        <dd>{imovel.instaladorResp}</dd>
                                    </div>
                                )}
                            </dl>

                            {imovel.obsPendente && (
                                <div className={styles.obs}>
                                    <strong>Observação</strong>
                                    <p>{imovel.obsPendente}</p>
                                </div>
                            )}

                            {imovel.obsInstalacao && (
                                <div className={styles.obs}>
                                    <strong>Observação da instalação</strong>
                                    <p>{imovel.obsInstalacao}</p>
                                </div>
                            )}

                            {(fotoOrientacao || fotosInstalacao.length > 0) && (
                                <div className={styles.section}>
                                    <span className={styles.sectionTitle}>Fotos</span>
                                    <div className={styles.fotos}>
                                        {fotoOrientacao && (
                                            <button type="button" className={styles.foto} onClick={() => setFotoAberta(fotoOrientacao)}>
                                                <img src={fotoOrientacao} alt="Foto de orientação da prefeitura" />
                                                <span><ImageIcon size={12} /> Orientação</span>
                                            </button>
                                        )}
                                        {fotosInstalacao.map(url => (
                                            <button key={url} type="button" className={styles.foto} onClick={() => setFotoAberta(url)}>
                                                <img src={url} alt="Foto da instalação" />
                                                <span><Camera size={12} /> Instalação</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {imovel.complementos?.length > 0 && (
                                <div className={styles.section}>
                                    <span className={styles.sectionTitle}>Complementos</span>
                                    <ul className={styles.complementos}>
                                        {imovel.complementos.map((c: any) => (
                                            <li key={c.id}>
                                                <span className={styles.compNumero}>{c.numeroPredial}</span>
                                                <span className={styles.compUnidade}>Unid. {c.unidade}</span>
                                                <span className={styles.status}>
                                                    <span className={styles.dot} style={{ background: STATUS_COLORS[c.status] || '#94a3b8' }} />
                                                    {statusLabel(c.status)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {(imovel || actions) && (
                    <div className={styles.footer}>
                        {rota && (
                            <a href={rota} target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
                                <Navigation size={16} /> Rota GPS
                            </a>
                        )}
                        {imovel && !rota && (
                            <span className={styles.semCoord}><MapPin size={14} /> Sem coordenadas</span>
                        )}
                        {actions}
                    </div>
                )}
            </div>

            {fotoAberta && (
                <div className="lightbox" role="dialog" aria-label="Foto em tela cheia" onClick={e => { e.stopPropagation(); setFotoAberta(null); }}>
                    <img src={fotoAberta} alt="Foto do imóvel" />
                    <button type="button" className="lightbox-close" aria-label="Fechar foto"><X size={22} /></button>
                </div>
            )}
        </div>
    );
}
