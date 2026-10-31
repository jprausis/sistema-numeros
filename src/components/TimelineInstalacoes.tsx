'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle, CalendarCheck, Camera, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, HardHat,
    ImageOff, Loader2, MapPin, MessageSquare, RefreshCw, X
} from 'lucide-react';
import styles from './timelineInstalacoes.module.css';
import ImovelInfoModal from './ImovelInfoModal';
import { formatBrazil, splitBrazilDate, todayBrazil } from '@/lib/timezone';
import { statusLabel } from '@/utils/status';

interface ItemTimeline {
    inscimob: string;
    numero: string;
    endereco: string | null;
    bairro: string | null;
    status: 'CONCLUIDO' | 'PENDENTE';
    horario: string;
    instalador: string;
    fotos: string[];
    motivoPendencia: string | null;
    obsPendente: string | null;
    obsInstalacao: string | null;
    complementos: { numeroPredial: string; status: string }[];
    agendamento: { protocolo: string; nome: string; dataHora: string | null; status: string } | null;
}

type FiltroStatus = 'TODOS' | 'CONCLUIDO' | 'PENDENTE';

// Atualiza sozinho enquanto o dia exibido é hoje
const INTERVALO_ATUALIZACAO_MS = 60 * 1000;
// Cada item pode ter foto: mostra poucos por vez
const ITENS_POR_VEZ = 25;

function somarDias(data: string, dias: number) {
    const [y, m, d] = data.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + dias));
    return dt.toISOString().slice(0, 10);
}

const hora = (iso: string | Date) => splitBrazilDate(new Date(iso)).horario;

export default function TimelineInstalacoes({ bairroId }: { bairroId?: string }) {
    const [data, setData] = useState<string>(todayBrazil);
    const [itens, setItens] = useState<ItemTimeline[]>([]);
    const [chaveCarregada, setChaveCarregada] = useState<string | null>(null);
    const [atualizando, setAtualizando] = useState(false);
    const [erro, setErro] = useState(false);
    const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
    const [instalador, setInstalador] = useState('');
    const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('TODOS');
    const [fotoAberta, setFotoAberta] = useState<string | null>(null);
    const [imovelAberto, setImovelAberto] = useState<string | null>(null);
    // Começa fechada: o painel abre sem baixar a linha do tempo, só quando alguém pede
    const [aberta, setAberta] = useState(false);
    const [limite, setLimite] = useState({ filtro: '', total: ITENS_POR_VEZ });

    const hoje = todayBrazil();
    const ehHoje = data === hoje;

    // Carregando enquanto o dia/bairro exibido ainda não chegou da API
    const chave = `${data}|${bairroId || ''}`;
    const loading = chave !== chaveCarregada || atualizando;

    const carregar = useCallback(() => {
        const params = new URLSearchParams({ data });
        if (bairroId) params.set('bairroId', bairroId);
        return fetch(`/api/admin/timeline?${params}`)
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(res => {
                setItens(res.itens || []);
                setErro(false);
                setAtualizadoEm(new Date());
            })
            .catch(() => setErro(true))
            .finally(() => {
                setChaveCarregada(`${data}|${bairroId || ''}`);
                setAtualizando(false);
            });
    }, [data, bairroId]);

    useEffect(() => {
        if (aberta) carregar();
    }, [aberta, carregar]);

    useEffect(() => {
        if (!aberta || !ehHoje) return;
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') carregar();
        }, INTERVALO_ATUALIZACAO_MS);
        return () => clearInterval(id);
    }, [aberta, ehHoje, carregar]);

    useEffect(() => {
        if (!fotoAberta) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFotoAberta(null);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [fotoAberta]);

    const instaladores = useMemo(() => {
        const contagem = new Map<string, number>();
        itens.forEach(i => contagem.set(i.instalador, (contagem.get(i.instalador) || 0) + 1));
        return Array.from(contagem.entries()).sort((a, b) => b[1] - a[1]);
    }, [itens]);

    // Instalador escolhido que não trabalhou no dia exibido => mostra todos
    const instaladorAtivo = instaladores.some(([nome]) => nome === instalador) ? instalador : '';
    const doInstalador = instaladorAtivo ? itens.filter(i => i.instalador === instaladorAtivo) : itens;
    const visiveis = filtroStatus === 'TODOS' ? doInstalador : doInstalador.filter(i => i.status === filtroStatus);

    const resumo = {
        concluidos: doInstalador.filter(i => i.status === 'CONCLUIDO').length,
        pendentes: doInstalador.filter(i => i.status === 'PENDENTE').length,
        agendados: doInstalador.filter(i => i.agendamento).length,
    };

    const filtros: { key: FiltroStatus; label: string; total: number }[] = [
        { key: 'TODOS', label: 'Todos', total: doInstalador.length },
        { key: 'CONCLUIDO', label: 'Concluídos', total: resumo.concluidos },
        { key: 'PENDENTE', label: 'Pendentes', total: resumo.pendentes },
    ];

    const dataBr = data.split('-').reverse().join('/');

    // Volta a mostrar só os primeiros itens quando o dia ou um filtro muda
    const filtroAtual = `${chave}|${instaladorAtivo}|${filtroStatus}`;
    const totalVisivel = limite.filtro === filtroAtual ? limite.total : ITENS_POR_VEZ;
    const mostrar = visiveis.slice(0, totalVisivel);

    if (!aberta) {
        return (
            <section className={styles.panel} aria-labelledby="timeline-title">
                <div className={`${styles.header} ${styles.headerFechado}`}>
                    <div>
                        <h3 id="timeline-title">Linha do tempo das instalações</h3>
                        <p className={styles.sub}>Imóveis concluídos ou marcados como pendentes pelos instaladores</p>
                    </div>
                    <button type="button" className={styles.btnHoje} onClick={() => setAberta(true)} aria-expanded={false}>
                        <ChevronDown size={16} aria-hidden /> Abrir linha do tempo
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className={styles.panel} aria-labelledby="timeline-title">
            <div className={styles.header}>
                <div>
                    <h3 id="timeline-title">Linha do tempo das instalações</h3>
                    <p className={styles.sub}>
                        Imóveis concluídos ou marcados como pendentes pelos instaladores
                        {ehHoje && atualizadoEm && <> · atualizado às {hora(atualizadoEm)}</>}
                    </p>
                </div>
                <div className={styles.controls}>
                    <div className={styles.dateNav}>
                        <button type="button" onClick={() => setData(somarDias(data, -1))} aria-label="Dia anterior">
                            <ChevronLeft size={18} />
                        </button>
                        <label>
                            <span className="sr-only">Dia da linha do tempo</span>
                            <input
                                type="date"
                                value={data}
                                max={hoje}
                                onChange={(e) => e.target.value && setData(e.target.value)}
                            />
                        </label>
                        <button type="button" onClick={() => setData(somarDias(data, 1))} disabled={ehHoje} aria-label="Próximo dia">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    {!ehHoje && (
                        <button type="button" className={styles.btnHoje} onClick={() => setData(hoje)}>Hoje</button>
                    )}
                    <button type="button" className={styles.btnIcon} onClick={() => { setAtualizando(true); carregar(); }} disabled={loading} aria-label="Atualizar">
                        <RefreshCw size={16} className={loading ? 'spin' : undefined} />
                    </button>
                    <button type="button" className={styles.btnHoje} onClick={() => setAberta(false)} aria-expanded={true}>
                        <ChevronUp size={16} aria-hidden /> Recolher
                    </button>
                </div>
            </div>

            <div className={styles.toolbar}>
                <label className={styles.select}>
                    <HardHat size={16} aria-hidden />
                    <span className="sr-only">Filtrar por instalador</span>
                    <select value={instaladorAtivo} onChange={(e) => setInstalador(e.target.value)}>
                        <option value="">Todos os instaladores ({instaladores.length})</option>
                        {instaladores.map(([nome, total]) => (
                            <option key={nome} value={nome}>{nome} ({total})</option>
                        ))}
                    </select>
                </label>
                <div className={styles.chips} role="group" aria-label="Filtrar por situação">
                    {filtros.map(f => (
                        <button
                            key={f.key}
                            type="button"
                            className={`${styles.chip} ${filtroStatus === f.key ? styles.chipActive : ''}`}
                            aria-pressed={filtroStatus === f.key}
                            onClick={() => setFiltroStatus(f.key)}
                        >
                            {f.label} <span>{f.total}</span>
                        </button>
                    ))}
                </div>
                {resumo.agendados > 0 && (
                    <span className={styles.resumoAgendados}>
                        <CalendarCheck size={15} aria-hidden /> {resumo.agendados} com agendamento
                    </span>
                )}
            </div>

            {loading && itens.length === 0 ? (
                <div className={styles.empty}><Loader2 size={18} className="spin" /> Carregando...</div>
            ) : erro ? (
                <div className={styles.empty}>Não foi possível carregar a linha do tempo.</div>
            ) : visiveis.length === 0 ? (
                <div className={styles.empty}>
                    {itens.length === 0 ? `Nenhuma instalação registrada em ${dataBr}.` : 'Nenhum imóvel com esses filtros.'}
                </div>
            ) : (
                <ol className={`${styles.timeline} ${loading ? styles.loading : ''}`}>
                    {mostrar.map(item => {
                        const concluido = item.status === 'CONCLUIDO';
                        const foto = item.fotos[0];
                        return (
                            <li key={item.inscimob} className={concluido ? styles.concluido : styles.pendente}>
                                <time className={styles.time} dateTime={item.horario}>{hora(item.horario)}</time>
                                <span className={styles.dot} aria-hidden>
                                    {concluido ? <CheckCircle2 size={14} /> : <AlertTriangle size={13} />}
                                </span>
                                <article className={styles.card}>
                                    <div className={styles.cardBody}>
                                        <div className={styles.cardTop}>
                                            <span className={styles.numero}>Nº {item.numero}</span>
                                            <span className={`${styles.badge} ${concluido ? styles.badgeOk : styles.badgeWarn}`}>
                                                {statusLabel(item.status)}
                                            </span>
                                            {item.agendamento && (
                                                <span className={`${styles.badge} ${styles.badgeAgendado}`}>
                                                    <CalendarCheck size={13} aria-hidden /> Agendado
                                                </span>
                                            )}
                                        </div>

                                        <p className={styles.endereco}>
                                            <MapPin size={14} aria-hidden />
                                            {item.endereco || 'Endereço não informado'}
                                            {item.bairro && <span className={styles.muted}> · {item.bairro}</span>}
                                        </p>

                                        <dl className={styles.meta}>
                                            <div>
                                                <dt>Instalador</dt>
                                                <dd>{item.instalador}</dd>
                                            </div>
                                            <div>
                                                <dt>Inscrição</dt>
                                                <dd>
                                                    <button type="button" className={styles.link} onClick={() => setImovelAberto(item.inscimob)}>
                                                        {item.inscimob}
                                                    </button>
                                                </dd>
                                            </div>
                                            {item.complementos.length > 0 && (
                                                <div>
                                                    <dt>Complementos</dt>
                                                    <dd className={styles.compList}>
                                                        {item.complementos.map(c => (
                                                            <span
                                                                key={c.numeroPredial}
                                                                className={c.status === 'CONCLUIDO' ? styles.compOk : styles.compWarn}
                                                                title={statusLabel(c.status)}
                                                            >
                                                                {c.numeroPredial}
                                                            </span>
                                                        ))}
                                                    </dd>
                                                </div>
                                            )}
                                        </dl>

                                        {item.agendamento && (
                                            <p className={styles.agendamento}>
                                                <Clock size={14} aria-hidden />
                                                <span>
                                                    {item.agendamento.protocolo} · {item.agendamento.nome}
                                                    {item.agendamento.dataHora && <> · marcado para {formatBrazil(item.agendamento.dataHora, true)}</>}
                                                </span>
                                            </p>
                                        )}

                                        {concluido && item.obsInstalacao && (
                                            <p className={styles.observacao}>
                                                <MessageSquare size={14} aria-hidden />
                                                <span>{item.obsInstalacao}</span>
                                            </p>
                                        )}

                                        {!concluido && (item.motivoPendencia || item.obsPendente) && (
                                            <p className={styles.pendencia}>
                                                <AlertTriangle size={14} aria-hidden />
                                                <span>
                                                    {item.motivoPendencia && <strong>{item.motivoPendencia}</strong>}
                                                    {item.motivoPendencia && item.obsPendente && ' — '}
                                                    {item.obsPendente}
                                                </span>
                                            </p>
                                        )}
                                    </div>

                                    {foto ? (
                                        <button
                                            type="button"
                                            className={styles.foto}
                                            onClick={() => setFotoAberta(foto)}
                                            aria-label={`Ampliar foto do imóvel Nº ${item.numero}`}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={foto} alt="" loading="lazy" />
                                            {item.fotos.length > 1 && (
                                                <span className={styles.fotoCount}><Camera size={12} aria-hidden /> {item.fotos.length}</span>
                                            )}
                                        </button>
                                    ) : (
                                        <div className={`${styles.foto} ${styles.semFoto}`}>
                                            <ImageOff size={20} aria-hidden />
                                            <span>Sem foto</span>
                                        </div>
                                    )}
                                </article>
                            </li>
                        );
                    })}
                </ol>
            )}

            {!loading && !erro && visiveis.length > totalVisivel && (
                <div className={styles.maisItens}>
                    <span>Exibindo {totalVisivel} de {visiveis.length}</span>
                    <button type="button" className={styles.btnHoje} onClick={() => setLimite({ filtro: filtroAtual, total: totalVisivel + ITENS_POR_VEZ })}>
                        Mostrar mais
                    </button>
                </div>
            )}

            {fotoAberta && (
                <div className="lightbox" role="dialog" aria-label="Foto em tela cheia" onClick={() => setFotoAberta(null)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotoAberta} alt="Foto da instalação" />
                    <button type="button" className="lightbox-close" aria-label="Fechar foto"><X size={22} /></button>
                </div>
            )}

            {imovelAberto && (
                <ImovelInfoModal inscimob={imovelAberto} onClose={() => setImovelAberto(null)} />
            )}
        </section>
    );
}
