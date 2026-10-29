'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle, CalendarCheck, CalendarClock, CheckCircle2, Download, FileSpreadsheet, Gauge, Home, Layers,
    Loader2, MapPin, Package, RefreshCw, Search, TrendingUp
} from 'lucide-react';
import styles from './page.module.css';
import { toast } from '@/utils/toast';
import { formatBrazil, todayBrazil } from '@/lib/timezone';

type StatusImovel = 'CONCLUIDO' | 'AGENDADO' | 'LIBERADO' | 'PENDENTE' | 'AUSENTE' | 'NAO_INICIADO';
type PorStatus = Record<StatusImovel, number>;

interface Resumo {
    geradoEm: string;
    geral: {
        totalImoveis: number;
        porStatus: PorStatus;
        restantes: number;
        totalComplementos: number;
        complementosInstalados: number;
        algarismosInstalados: number;
        algarismosImoveis: number;
        algarismosComplementos: number;
        bairros: number;
        bairrosConcluidos: number;
    };
    ritmo: {
        hoje: number;
        semana: number;
        algarismosSemana: number;
        algarismosPeriodo: number;
        periodo: number;
        diasPeriodo: number;
        diasTrabalhados: number;
        mediaPorDiaTrabalhado: number;
        diasRestantesEstimados: number | null;
    };
    evolucao: { data: string; imoveis: number; complementos: number; algarismos: number }[];
    porBairro: (PorStatus & {
        id: string;
        nome: string;
        total: number;
        complementos: number;
        complementosInstalados: number;
        algarismosInstalados: number;
        ultimaInstalacao: string | null;
        concluido: boolean;
        marcadoConcluido: boolean;
    })[];
    motivosPendencia: { motivo: string; total: number }[];
    agendamentos: {
        abertos: number;
        hoje: number;
        proximos7: number;
        atrasados: number;
        semData: number;
        concluidos: number;
        cancelados: number;
        reagendar: number;
        total: number;
        proximosDias: { data: string; total: number }[];
    };
    estoque: {
        itens: { caractere: string; estoque: number; necessario: number; falta: number }[];
        total: number;
        necessario: number;
        falta: number;
        imoveisAguardando: number;
        complementosAguardando: number;
        consumo30d: number;
        coberturaDias: number | null;
    };
}

const SEGMENTOS: { key: StatusImovel; label: string; color: string }[] = [
    { key: 'CONCLUIDO', label: 'Instalados', color: 'var(--status-concluido)' },
    { key: 'AGENDADO', label: 'Agendados', color: 'var(--status-agendado)' },
    { key: 'LIBERADO', label: 'Liberados', color: 'var(--status-liberado)' },
    { key: 'PENDENTE', label: 'Pendentes', color: 'var(--status-pendente)' },
    { key: 'AUSENTE', label: 'Ausentes', color: 'var(--status-ausente)' },
    { key: 'NAO_INICIADO', label: 'Não iniciados', color: '#e2e8f0' },
];

const SIGNIFICADO: Record<StatusImovel, string> = {
    CONCLUIDO: 'Número instalado e fotografado pela equipe.',
    AGENDADO: 'Visita marcada com o morador.',
    LIBERADO: 'Liberado pela prefeitura; a equipe já pode instalar.',
    PENDENTE: 'A equipe foi ao local e não conseguiu instalar. O motivo aparece abaixo, em "Por que alguns imóveis não foram instalados".',
    AUSENTE: 'O morador não estava no momento da visita.',
    NAO_INICIADO: 'Ainda não liberado para instalação.',
};

const ORDENACOES = {
    progresso: 'Maior progresso',
    restante: 'Mais imóveis restantes',
    nome: 'Nome do bairro',
} as const;

const fmt = (n: number | undefined) => (n || 0).toLocaleString('pt-BR');
const pct = (part: number, total: number) => (total ? (part / total) * 100 : 0);
const fmtPct = (part: number, total: number) => `${pct(part, total).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const diaCurto = (data: string) => data.split('-').reverse().slice(0, 2).join('/');
const diaSemana = (data: string) =>
    new Date(`${data}T12:00:00-03:00`).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '');
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

export default function PainelPrefeituraPage() {
    const [resumo, setResumo] = useState<Resumo | null>(null);
    const [carregando, setCarregando] = useState(false);
    const [baixando, setBaixando] = useState<string | null>(null);
    const [busca, setBusca] = useState('');
    const [ordem, setOrdem] = useState<keyof typeof ORDENACOES>('progresso');
    const [erro, setErro] = useState<string | null>(null);

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await fetch('/api/painel-prefeitura/resumo');
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error);
            setResumo(json);
            setErro(null);
        } catch {
            // Mantém os últimos números na tela (se houver) e mostra o aviso com "Tentar novamente"
            setErro('Não foi possível carregar os indicadores. Verifique a internet e tente de novo.');
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

    const bairros = useMemo(() => {
        if (!resumo) return [];
        const termo = busca.trim().toLowerCase();
        const lista = resumo.porBairro.filter(b => !termo || b.nome.toLowerCase().includes(termo));
        return [...lista].sort((a, b) => {
            if (ordem === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR');
            if (ordem === 'restante') return (b.total - b.CONCLUIDO) - (a.total - a.CONCLUIDO);
            return pct(b.CONCLUIDO, b.total) - pct(a.CONCLUIDO, a.total);
        });
    }, [resumo, busca, ordem]);

    const baixarRelatorio = async (bairro?: { id: string; nome: string }) => {
        const chave = bairro?.id || 'todos';
        setBaixando(chave);
        try {
            const res = await fetch(bairro ? `/api/admin/exportar?bairroId=${bairro.id}` : '/api/admin/exportar');
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `relatorio-${bairro ? slug(bairro.nome) : 'geral'}-${todayBrazil()}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error('Não foi possível baixar a planilha. Tente de novo em instantes.');
        } finally {
            setBaixando(null);
        }
    };

    if (!resumo && erro) {
        return (
            <div className={styles.errorPanel} role="alert">
                <AlertTriangle size={28} aria-hidden />
                <p>{erro}</p>
                <button type="button" onClick={carregar} className={styles.btnDark} disabled={carregando}>
                    <RefreshCw size={16} className={carregando ? 'spin' : undefined} aria-hidden /> Tentar novamente
                </button>
            </div>
        );
    }

    if (!resumo) {
        return (
            <div className="page-loading">
                <Loader2 size={28} className="spin" />
                Carregando indicadores...
            </div>
        );
    }

    const { geral, ritmo, agendamentos: ag, estoque } = resumo;
    const total = geral.totalImoveis;
    const instalados = geral.porStatus.CONCLUIDO;
    const maxEvolucao = Math.max(...resumo.evolucao.map(d => d.algarismos), 1);
    const maxProximos = Math.max(...ag.proximosDias.map(d => d.total), 1);
    const maxMotivo = Math.max(...resumo.motivosPendencia.map(m => m.total), 1);
    const maxEstoque = Math.max(...estoque.itens.map(i => Math.max(i.estoque, i.necessario)), 1);

    const kpis = [
        { label: 'Imóveis com número instalado', value: fmt(instalados), sub: `${fmtPct(instalados, total)} de ${fmt(total)} imóveis`, icon: CheckCircle2, tone: styles.toneSuccess },
        { label: 'Algarismos instalados', value: fmt(geral.algarismosInstalados), sub: `${fmt(geral.algarismosImoveis)} nos imóveis · ${fmt(geral.algarismosComplementos)} em ${fmt(geral.complementosInstalados)} complementos`, icon: Layers, tone: styles.toneInfo },
        { label: 'Algarismos nos últimos 7 dias', value: fmt(ritmo.algarismosSemana), sub: `${fmt(ritmo.semana)} imóveis · ${fmt(ritmo.hoje)} hoje`, icon: TrendingUp, tone: styles.toneNeutral },
        { label: 'Agendamentos em aberto', value: fmt(ag.abertos), sub: `${fmt(ag.hoje)} para hoje`, icon: CalendarClock, tone: styles.tonePurple },
        { label: 'Bairros concluídos', value: `${fmt(geral.bairrosConcluidos)} / ${fmt(geral.bairros)}`, sub: 'Finalizados pela equipe ou 100% instalados', icon: MapPin, tone: styles.toneSuccess },
        { label: 'Algarismos em estoque', value: fmt(estoque.total), sub: estoque.falta > 0 ? `Faltam ${fmt(estoque.falta)} para os liberados` : 'Suficiente para os liberados', icon: Package, tone: estoque.falta > 0 ? styles.toneWarning : styles.toneNeutral },
    ];

    return (
        <div className={styles.container}>
                <div className={styles.header}>
                    <div>
                        <h1>Andamento da numeração predial</h1>
                        <p>Atualizado em {formatBrazil(resumo.geradoEm, true)}</p>
                    </div>
                    <div className={styles.headerActions}>
                        <button type="button" onClick={carregar} className={styles.btnLight} disabled={carregando}>
                            <RefreshCw size={16} className={carregando ? 'spin' : undefined} aria-hidden /> Atualizar
                        </button>
                        <button type="button" onClick={() => baixarRelatorio()} className={styles.btnDark} disabled={baixando !== null}>
                            {baixando === 'todos' ? <Loader2 size={16} className="spin" /> : <FileSpreadsheet size={16} aria-hidden />}
                            Planilha geral
                        </button>
                    </div>
                </div>

                {erro && (
                    <div className={styles.staleBanner} role="alert">
                        <AlertTriangle size={16} aria-hidden />
                        <span>{erro} Os números abaixo são da última atualização.</span>
                        <button type="button" onClick={carregar} disabled={carregando}>Tentar novamente</button>
                    </div>
                )}

                <section aria-labelledby="kpi-title" className={carregando ? styles.loadingSection : undefined}>
                    <h2 id="kpi-title" className="sr-only">Indicadores principais</h2>
                    <div className={styles.statsGrid}>
                        {kpis.map(({ label, value, sub, icon: Icon, tone }) => (
                            <div key={label} className={`${styles.card} ${tone}`}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.cardLabel}>{label}</span>
                                    <span className={styles.cardIcon}><Icon size={18} aria-hidden /></span>
                                </div>
                                <p className={styles.cardValue}>{value}</p>
                                <span className={styles.cardSub}>{sub}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={styles.panel} aria-labelledby="progress-title">
                    <div className={styles.panelHeader}>
                        <div>
                            <h3 id="progress-title">Progresso geral</h3>
                            <p className={styles.panelSub}>Situação dos {fmt(total)} imóveis da base</p>
                        </div>
                        <span className={styles.bigPct}>{fmtPct(instalados, total)}</span>
                    </div>
                    <StackedBar dados={geral.porStatus} total={total} alto />
                    <ul className={styles.legend}>
                        {SEGMENTOS.map(s => (
                            <li key={s.key}>
                                <span className={styles.legendDot} style={{ background: s.color }} />
                                {s.label}
                                <strong>{fmt(geral.porStatus[s.key])}</strong>
                                <span className={styles.legendPct}>{fmtPct(geral.porStatus[s.key], total)}</span>
                            </li>
                        ))}
                    </ul>
                    <details className={styles.help}>
                        <summary>O que significa cada situação?</summary>
                        <dl>
                            {SEGMENTOS.map(seg => (
                                <div key={seg.key}>
                                    <dt><span className={styles.legendDot} style={{ background: seg.color }} />{seg.label}</dt>
                                    <dd>{SIGNIFICADO[seg.key]}</dd>
                                </div>
                            ))}
                        </dl>
                    </details>
                </section>

                <div className={styles.twoCols}>
                    <section className={styles.panel} aria-labelledby="evolucao-title">
                        <div className={styles.panelHeader}>
                            <div>
                                <h3 id="evolucao-title">Algarismos instalados por dia</h3>
                                <p className={styles.panelSub}>Últimos {ritmo.diasPeriodo} dias · imóveis + complementos</p>
                            </div>
                            <strong className={styles.panelValue}>{fmt(ritmo.algarismosPeriodo)} algarismos</strong>
                        </div>
                        <div className={styles.barChart} role="img" aria-label={`Algarismos instalados por dia nos últimos ${ritmo.diasPeriodo} dias`}>
                            {resumo.evolucao.map(d => {
                                return (
                                    <div key={d.data} className={styles.barCol} title={`${diaCurto(d.data)} (${diaSemana(d.data)}): ${fmt(d.algarismos)} algarismos em ${fmt(d.imoveis)} imóveis e ${fmt(d.complementos)} complementos`}>
                                        <div className={styles.bar} style={{ height: `${pct(d.algarismos, maxEvolucao)}%` }} />
                                    </div>
                                );
                            })}
                        </div>
                        <div className={styles.axis}>
                            <span>{diaCurto(resumo.evolucao[0].data)}</span>
                            <span>{diaCurto(resumo.evolucao[resumo.evolucao.length - 1].data)}</span>
                        </div>
                    </section>

                    <section className={styles.panel} aria-labelledby="ritmo-title">
                        <div className={styles.panelHeader}>
                            <div>
                                <h3 id="ritmo-title">Ritmo e previsão</h3>
                                <p className={styles.panelSub}>Com base nos dias com instalação</p>
                            </div>
                            <span className={`${styles.cardIcon} ${styles.toneInfo}`}><Gauge size={18} aria-hidden /></span>
                        </div>
                        <dl className={styles.factList}>
                            <div>
                                <dt>Média por dia trabalhado</dt>
                                <dd>{ritmo.mediaPorDiaTrabalhado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} imóveis</dd>
                            </div>
                            <div>
                                <dt>Dias com instalação ({ritmo.diasPeriodo} dias)</dt>
                                <dd>{fmt(ritmo.diasTrabalhados)}</dd>
                            </div>
                            <div>
                                <dt>Imóveis restantes (bairros em andamento)</dt>
                                <dd>{fmt(geral.restantes)}</dd>
                            </div>
                            <div>
                                <dt>Previsão para concluir</dt>
                                <dd>{ritmo.diasRestantesEstimados === null ? '—' : `≈ ${fmt(ritmo.diasRestantesEstimados)} dias de trabalho`}</dd>
                            </div>
                        </dl>
                        <p className={styles.note}>Estimativa no ritmo atual. Depende da liberação dos imóveis e da presença dos moradores.</p>
                    </section>
                </div>

                <section className={styles.panel} aria-labelledby="bairros-title">
                    <div className={styles.panelHeader}>
                        <div>
                            <h3 id="bairros-title">Andamento por bairro</h3>
                            <p className={styles.panelSub}>Baixe o relatório de cada bairro com a situação e as fotos de cada imóvel</p>
                        </div>
                        <div className={styles.tableTools}>
                            <label className={styles.filter}>
                                <Search size={16} aria-hidden />
                                <span className="sr-only">Buscar bairro</span>
                                <input type="search" placeholder="Buscar bairro" value={busca} onChange={e => setBusca(e.target.value)} />
                            </label>
                            <label className={styles.filter}>
                                <span className="sr-only">Ordenar por</span>
                                <select value={ordem} onChange={e => setOrdem(e.target.value as keyof typeof ORDENACOES)}>
                                    {Object.entries(ORDENACOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </label>
                        </div>
                    </div>

                    {bairros.length === 0 ? (
                        <div className={styles.empty}>Nenhum bairro encontrado.</div>
                    ) : (
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Bairro</th>
                                        <th className={styles.progressCol}>Progresso</th>
                                        <th className={styles.num}>Imóveis</th>
                                        <th className={styles.num}>Instalados</th>
                                        <th className={styles.num}>Agendados</th>
                                        <th className={styles.num}>Liberados</th>
                                        <th className={styles.num}>Pend./Aus.</th>
                                        <th className={styles.num}>Complementos</th>
                                        <th className={styles.num}>Algarismos</th>
                                        <th>Última instalação</th>
                                        <th><span className="sr-only">Relatório</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bairros.map(b => (
                                        <tr key={b.id}>
                                            <th scope="row" className={styles.bairroNome}>
                                                {b.nome}
                                                {b.concluido && <span className={styles.concluidoTag}>Concluído</span>}
                                                {b.marcadoConcluido && b.CONCLUIDO < b.total && (
                                                    <span className={styles.semInstalacao}>{fmt(b.total - b.CONCLUIDO)} não serão instalados</span>
                                                )}
                                            </th>
                                            <td className={styles.progressCol}>
                                                <div className={styles.progressCell}>
                                                    <StackedBar dados={b} total={b.total} />
                                                    <span>{fmtPct(b.CONCLUIDO, b.total)}</span>
                                                </div>
                                            </td>
                                            <td className={styles.num}>{fmt(b.total)}</td>
                                            <td className={styles.num}>{fmt(b.CONCLUIDO)}</td>
                                            <td className={styles.num}>{fmt(b.AGENDADO)}</td>
                                            <td className={styles.num}>{fmt(b.LIBERADO)}</td>
                                            <td className={styles.num}>{fmt(b.PENDENTE + b.AUSENTE)}</td>
                                            <td className={styles.num}>{fmt(b.complementosInstalados)} / {fmt(b.complementos)}</td>
                                            <td className={styles.num}>{fmt(b.algarismosInstalados)}</td>
                                            <td className={styles.muted}>{b.ultimaInstalacao ? formatBrazil(b.ultimaInstalacao) : '—'}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className={styles.btnDownload}
                                                    onClick={() => baixarRelatorio(b)}
                                                    disabled={baixando !== null}
                                                    aria-label={`Baixar relatório de ${b.nome}`}
                                                >
                                                    {baixando === b.id ? <Loader2 size={15} className="spin" /> : <Download size={15} aria-hidden />}
                                                    Planilha
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <div className={styles.twoCols}>
                    <section className={styles.panel} aria-labelledby="agenda-title">
                        <div className={styles.panelHeader}>
                            <div>
                                <h3 id="agenda-title">Agendamentos</h3>
                                <p className={styles.panelSub}>Visitas marcadas com os moradores</p>
                            </div>
                            <span className={`${styles.cardIcon} ${styles.tonePurple}`}><CalendarCheck size={18} aria-hidden /></span>
                        </div>
                        <div className={styles.miniStats}>
                            <MiniStat label="Em aberto" value={ag.abertos} />
                            <MiniStat label="Hoje" value={ag.hoje} />
                            <MiniStat label="Próximos 7 dias" value={ag.proximos7} />
                            <MiniStat label="Atrasados" value={ag.atrasados} alerta={ag.atrasados > 0} />
                            <MiniStat label="Realizados" value={ag.concluidos} />
                            <MiniStat label="Cancelados" value={ag.cancelados} />
                        </div>
                        <h4 className={styles.subTitle}>Próximos dias</h4>
                        <ul className={styles.hList}>
                            {ag.proximosDias.map(d => (
                                <li key={d.data}>
                                    <span className={styles.hLabel}>{diaSemana(d.data)} {diaCurto(d.data)}</span>
                                    <div className={styles.hTrack}><div className={styles.hBarPurple} style={{ width: `${pct(d.total, maxProximos)}%` }} /></div>
                                    <strong>{fmt(d.total)}</strong>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className={styles.panel} aria-labelledby="motivos-title">
                        <div className={styles.panelHeader}>
                            <div>
                                <h3 id="motivos-title">Por que alguns imóveis não foram instalados</h3>
                                <p className={styles.panelSub}>{fmt(geral.porStatus.PENDENTE + geral.porStatus.AUSENTE)} imóveis pendentes ou com morador ausente</p>
                            </div>
                            <span className={`${styles.cardIcon} ${styles.toneWarning}`}><AlertTriangle size={18} aria-hidden /></span>
                        </div>
                        {resumo.motivosPendencia.length === 0 ? (
                            <div className={styles.empty}>Nenhuma pendência registrada.</div>
                        ) : (
                            <ul className={styles.hList}>
                                {resumo.motivosPendencia.map(m => (
                                    <li key={m.motivo}>
                                        <span className={styles.hLabelWide}>{m.motivo}</span>
                                        <div className={styles.hTrack}><div className={styles.hBarWarning} style={{ width: `${pct(m.total, maxMotivo)}%` }} /></div>
                                        <strong>{fmt(m.total)}</strong>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <section className={styles.panel} aria-labelledby="estoque-title">
                    <div className={styles.panelHeader}>
                        <div>
                            <h3 id="estoque-title">Estoque de números</h3>
                            <p className={styles.panelSub}>
                                Algarismos disponíveis x necessários para {fmt(estoque.imoveisAguardando)} imóveis e {fmt(estoque.complementosAguardando)} complementos já liberados
                            </p>
                        </div>
                        <ul className={styles.legendInline}>
                            <li><span className={styles.legendDot} style={{ background: 'var(--primary)' }} /> Em estoque</li>
                            <li><span className={styles.legendDot} style={{ background: '#94a3b8' }} /> Necessário</li>
                        </ul>
                    </div>
                    <div className={styles.miniStats}>
                        <MiniStat label="Algarismos em estoque" value={estoque.total} />
                        <MiniStat label="Necessários (liberados)" value={estoque.necessario} />
                        <MiniStat label="A produzir" value={estoque.falta} alerta={estoque.falta > 0} />
                        <MiniStat label="Usados em 30 dias" value={estoque.consumo30d} />
                        <MiniStat label="Duração estimada" texto={estoque.coberturaDias === null ? '—' : `${fmt(estoque.coberturaDias)} dias`} />
                    </div>
                    <div className={styles.stockGrid}>
                        {estoque.itens.map(i => (
                            <div key={i.caractere} className={`${styles.stockItem} ${i.falta > 0 ? styles.stockFalta : ''}`}>
                                <span className={styles.stockChar}>{i.caractere}</span>
                                <div className={styles.stockBars} title={`${i.caractere}: ${fmt(i.estoque)} em estoque, ${fmt(i.necessario)} necessários`}>
                                    <div className={styles.stockTrack}><div style={{ width: `${pct(i.estoque, maxEstoque)}%`, background: 'var(--primary)' }} /></div>
                                    <div className={styles.stockTrack}><div style={{ width: `${pct(i.necessario, maxEstoque)}%`, background: '#94a3b8' }} /></div>
                                </div>
                                <div className={styles.stockNums}>
                                    <strong>{fmt(i.estoque)}</strong>
                                    <span>{fmt(i.necessario)} nec.</span>
                                    {i.falta > 0 && <span className={styles.faltaTag}>faltam {fmt(i.falta)}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className={styles.note}>O 6 e o 9 são a mesma peça (basta girar). Entram na previsão os imóveis liberados ainda sem instalação; bairros concluídos ficam de fora.</p>
                </section>

                <footer className={styles.footer}>
                    <Home size={14} aria-hidden /> Indicadores somente leitura · dados do sistema de instalação
                </footer>
        </div>
    );
}

function StackedBar({ dados, total, alto }: { dados: PorStatus; total: number; alto?: boolean }) {
    return (
        <div
            className={`${styles.progressBar} ${alto ? styles.progressBarTall : ''}`}
            role="img"
            aria-label={SEGMENTOS.map(s => `${s.label}: ${dados[s.key]}`).join(', ')}
        >
            {SEGMENTOS.filter(s => dados[s.key] > 0).map(s => (
                <div
                    key={s.key}
                    style={{ width: `${pct(dados[s.key], total)}%`, background: s.color }}
                    title={`${s.label}: ${fmt(dados[s.key])} (${fmtPct(dados[s.key], total)})`}
                />
            ))}
        </div>
    );
}

function MiniStat({ label, value, texto, alerta }: { label: string; value?: number; texto?: string; alerta?: boolean }) {
    return (
        <div className={`${styles.miniStat} ${alerta ? styles.miniStatAlerta : ''}`}>
            <span>{label}</span>
            <strong>{texto ?? fmt(value)}</strong>
        </div>
    );
}
