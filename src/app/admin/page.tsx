'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    CalendarClock, CheckCircle2, Download, Hash, Home, Layers, Loader2, Map as MapIcon, Plus,
    Trophy, UploadCloud, UserX, Users, Unlock
} from 'lucide-react';
import styles from './page.module.css';
import { toast } from '@/utils/toast';
import { todayBrazil } from '@/lib/timezone';
import TimelineInstalacoes from '@/components/TimelineInstalacoes';

interface Stats {
    totalImoveis: number;
    concluidos: number;
    liberados: number;
    ausentes: number;
    agendados: number;
    pendentes: number;
    naoIniciados: number;
    complementosInstalados: number;
    algarismosComplementosInstalados: number;
    totalGeralAlgarismosInstalados: number;
    digitos: { totalNecessario: number; totalInstalado: number };
}

interface RankingItem {
    instalador: string;
    totalInstalado: number;
}

const fmt = (n: number | undefined) => (n || 0).toLocaleString('pt-BR');
const pct = (part: number, total: number) => (total ? (part / total) * 100 : 0);

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [bairros, setBairros] = useState<any[]>([]);
    const [selectedBairro, setSelectedBairro] = useState<string>('');
    const [loadingStats, setLoadingStats] = useState(false);
    const [role, setRole] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    const [selectedDate, setSelectedDate] = useState<string>(todayBrazil);
    const [rankingData, setRankingData] = useState<RankingItem[]>([]);
    const [rankingGeralData, setRankingGeralData] = useState<RankingItem[]>([]);
    const [loadingRanking, setLoadingRanking] = useState(false);
    const [loadingRankingGeral, setLoadingRankingGeral] = useState(false);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => setRole(data.user?.role || 'OPERATOR'))
            .catch(() => setRole('OPERATOR'));

        fetch('/api/admin/bairros')
            .then(res => res.json())
            .then(data => setBairros(data.bairros || []))
            .catch(() => setBairros([]));
    }, []);

    useEffect(() => {
        setLoadingStats(true);
        const url = selectedBairro ? `/api/admin/stats?bairroId=${selectedBairro}` : '/api/admin/stats';
        fetch(url)
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => setStats(data))
            .catch(() => toast.error('Não foi possível carregar os indicadores.'))
            .finally(() => setLoadingStats(false));
    }, [selectedBairro]);

    // Ranking do dia selecionado
    useEffect(() => {
        if (role !== 'ADMIN') return;
        setLoadingRanking(true);
        const params = new URLSearchParams({ data: selectedDate });
        if (selectedBairro) params.set('bairroId', selectedBairro);
        fetch(`/api/admin/ranking?${params}`)
            .then(res => res.json())
            .then(data => setRankingData(data.ranking || []))
            .catch(() => setRankingData([]))
            .finally(() => setLoadingRanking(false));
    }, [selectedDate, selectedBairro, role]);

    // Ranking acumulado geral
    useEffect(() => {
        if (role !== 'ADMIN') return;
        setLoadingRankingGeral(true);
        const url = selectedBairro ? `/api/admin/ranking?bairroId=${selectedBairro}` : '/api/admin/ranking';
        fetch(url)
            .then(res => res.json())
            .then(data => setRankingGeralData(data.ranking || []))
            .catch(() => setRankingGeralData([]))
            .finally(() => setLoadingRankingGeral(false));
    }, [selectedBairro, role]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const url = selectedBairro ? `/api/admin/exportar?bairroId=${selectedBairro}` : '/api/admin/exportar';
            const res = await fetch(url);
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `relatorio-instalacoes-${todayBrazil()}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch {
            toast.error('Erro ao exportar o relatório.');
        } finally {
            setExporting(false);
        }
    };

    if (!stats || role === null) {
        return (
            <div className="page-loading">
                <Loader2 size={28} className="spin" />
                Carregando indicadores...
            </div>
        );
    }

    const total = stats.totalImoveis;
    const segments = [
        { key: 'concluidos', label: 'Concluídos', value: stats.concluidos, color: 'var(--status-concluido)' },
        { key: 'agendados', label: 'Agendados', value: stats.agendados, color: 'var(--status-agendado)' },
        { key: 'liberados', label: 'Liberados', value: stats.liberados, color: 'var(--status-liberado)' },
        { key: 'pendentes', label: 'Pendentes', value: stats.pendentes, color: 'var(--status-pendente)' },
        { key: 'ausentes', label: 'Ausentes', value: stats.ausentes, color: 'var(--status-ausente)' },
        { key: 'naoIniciados', label: 'Não iniciados', value: stats.naoIniciados, color: '#e2e8f0' },
    ];
    const concluidoPct = pct(stats.concluidos, total);
    const digitosPct = pct(stats.digitos.totalInstalado, stats.digitos.totalNecessario);
    const bairroNome = bairros.find(b => b.id === selectedBairro)?.nome;

    const kpis = [
        { label: 'Base de Imóveis', value: total, sub: bairroNome ? `Em ${bairroNome}` : 'Total carregado no sistema', icon: Home, tone: styles.toneNeutral },
        { label: 'Concluídos', value: stats.concluidos, sub: `${concluidoPct.toFixed(1)}% da base`, icon: CheckCircle2, tone: styles.toneSuccess },
        { label: 'Agendados', value: stats.agendados, sub: 'Aguardando a equipe', icon: CalendarClock, tone: styles.tonePurple },
        { label: 'Liberados', value: stats.liberados, sub: 'Prontos para instalar', icon: Unlock, tone: styles.toneInfo },
        { label: 'Ausentes', value: stats.ausentes, sub: 'Morador não encontrado', icon: UserX, tone: styles.toneWarning },
        { label: 'Complementos', value: stats.complementosInstalados, sub: 'Unidades internas instaladas', icon: Layers, tone: styles.toneSuccess },
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Visão Geral</h1>
                    <p>Progresso das instalações de numeração predial em Rio Branco do Sul.</p>
                </div>
                <div className={styles.headerActions}>
                    <label className={styles.filter}>
                        <span className="sr-only">Filtrar por bairro</span>
                        <MapIcon size={16} aria-hidden />
                        <select value={selectedBairro} onChange={(e) => setSelectedBairro(e.target.value)}>
                            <option value="">Todos os bairros</option>
                            {bairros.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                        </select>
                    </label>
                    <button onClick={handleExport} className={styles.btnSecondary} disabled={exporting}>
                        {exporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                        Exportar CSV
                    </button>
                </div>
            </header>

            <nav className={styles.quickActions} aria-label="Ações rápidas">
                <Link href="/admin/imoveis?cadastrar=true" className={styles.quickAction}>
                    <Plus size={18} /> Novo Imóvel
                </Link>
                <Link href="/admin/imoveis" className={styles.quickAction}>
                    <MapIcon size={18} /> Mapa de Execução
                </Link>
                <Link href="/admin/agendamentos" className={styles.quickAction}>
                    <CalendarClock size={18} /> Agendamentos
                </Link>
                {role === 'ADMIN' && (
                    <>
                        <Link href="/admin/importar" className={styles.quickAction}>
                            <UploadCloud size={18} /> Importar Lote
                        </Link>
                        <Link href="/admin/usuarios" className={styles.quickAction}>
                            <Users size={18} /> Equipe
                        </Link>
                    </>
                )}
            </nav>

            <section aria-labelledby="kpi-title" className={loadingStats ? styles.loadingSection : undefined}>
                <h2 id="kpi-title" className={styles.sectionTitle}>Indicadores por imóvel</h2>
                <div className={styles.statsGrid}>
                    {kpis.map(({ label, value, sub, icon: Icon, tone }) => (
                        <div key={label} className={`${styles.card} ${tone}`}>
                            <div className={styles.cardHeader}>
                                <span className={styles.cardLabel}>{label}</span>
                                <span className={styles.cardIcon}><Icon size={18} aria-hidden /></span>
                            </div>
                            <p className={styles.cardValue}>{fmt(value)}</p>
                            <span className={styles.cardSub}>{sub}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className={styles.panel} aria-labelledby="progress-title">
                <div className={styles.panelHeader}>
                    <h3 id="progress-title">Progresso das instalações</h3>
                    <span className={styles.bigPct}>{concluidoPct.toFixed(1)}%</span>
                </div>
                <div
                    className={styles.progressBar}
                    role="img"
                    aria-label={segments.map(s => `${s.label}: ${s.value}`).join(', ')}
                >
                    {segments.filter(s => s.value > 0).map(s => (
                        <div
                            key={s.key}
                            style={{ width: `${pct(s.value, total)}%`, background: s.color }}
                            title={`${s.label}: ${fmt(s.value)} (${pct(s.value, total).toFixed(1)}%)`}
                        />
                    ))}
                </div>
                <ul className={styles.legend}>
                    {segments.map(s => (
                        <li key={s.key}>
                            <span className={styles.legendDot} style={{ background: s.color }} />
                            {s.label}
                            <strong>{fmt(s.value)}</strong>
                            <span className={styles.legendPct}>{pct(s.value, total).toFixed(1)}%</span>
                        </li>
                    ))}
                </ul>
            </section>

            {role === 'ADMIN' && (
                <>
                    <section aria-labelledby="digits-title" className={loadingStats ? styles.loadingSection : undefined}>
                        <h2 id="digits-title" className={styles.sectionTitle}>Indicadores por algarismo</h2>
                        <div className={styles.statsGrid}>
                            <div className={`${styles.card} ${styles.toneNeutral}`}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.cardLabel}>Algarismos necessários</span>
                                    <span className={styles.cardIcon}><Hash size={18} aria-hidden /></span>
                                </div>
                                <p className={styles.cardValue}>{fmt(stats.digitos.totalNecessario)}</p>
                                <span className={styles.cardSub}>Dígitos físicos dos imóveis</span>
                            </div>
                            <div className={`${styles.card} ${styles.toneSuccess}`}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.cardLabel}>Instalados (imóveis)</span>
                                    <span className={styles.cardIcon}><CheckCircle2 size={18} aria-hidden /></span>
                                </div>
                                <p className={styles.cardValue}>{fmt(stats.digitos.totalInstalado)}</p>
                                <div className={styles.miniBar}><div style={{ width: `${digitosPct}%` }} /></div>
                                <span className={styles.cardSub}>{digitosPct.toFixed(1)}% do necessário</span>
                            </div>
                            <div className={`${styles.card} ${styles.toneInfo}`}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.cardLabel}>Instalados (complementos)</span>
                                    <span className={styles.cardIcon}><Layers size={18} aria-hidden /></span>
                                </div>
                                <p className={styles.cardValue}>{fmt(stats.algarismosComplementosInstalados)}</p>
                                <span className={styles.cardSub}>Dígitos de unidades internas</span>
                            </div>
                            <div className={`${styles.card} ${styles.toneSuccess}`}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.cardLabel}>Total instalado</span>
                                    <span className={styles.cardIcon}><Hash size={18} aria-hidden /></span>
                                </div>
                                <p className={styles.cardValue}>{fmt(stats.totalGeralAlgarismosInstalados)}</p>
                                <span className={styles.cardSub}>Imóveis + complementos</span>
                            </div>
                        </div>
                    </section>

                    <div className={styles.rankingGrid}>
                        <section className={styles.panel} aria-labelledby="ranking-day-title">
                            <div className={styles.panelHeader}>
                                <div>
                                    <h3 id="ranking-day-title">Ranking do dia</h3>
                                    <p className={styles.panelSub}>Algarismos instalados por instalador</p>
                                </div>
                                <label>
                                    <span className="sr-only">Dia do ranking</span>
                                    <input
                                        type="date"
                                        className={styles.dateInput}
                                        value={selectedDate}
                                        max={todayBrazil()}
                                        onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                                    />
                                </label>
                            </div>
                            <RankingList
                                items={rankingData}
                                loading={loadingRanking}
                                empty={`Nenhuma instalação em ${selectedDate.split('-').reverse().join('/')}.`}
                            />
                        </section>

                        <section className={styles.panel} aria-labelledby="ranking-all-title">
                            <div className={styles.panelHeader}>
                                <div>
                                    <h3 id="ranking-all-title">Ranking geral</h3>
                                    <p className={styles.panelSub}>Total acumulado de algarismos</p>
                                </div>
                            </div>
                            <RankingList items={rankingGeralData} loading={loadingRankingGeral} empty="Nenhuma instalação registrada ainda." />
                        </section>
                    </div>

                    <TimelineInstalacoes bairroId={selectedBairro || undefined} />
                </>
            )}
        </div>
    );
}

function RankingList({ items, loading, empty }: { items: RankingItem[]; loading?: boolean; empty: string }) {
    if (loading) {
        return <div className={styles.rankingEmpty}><Loader2 size={18} className="spin" /> Carregando...</div>;
    }
    if (items.length === 0) {
        return <div className={styles.rankingEmpty}>{empty}</div>;
    }
    const max = Math.max(...items.map(i => i.totalInstalado), 1);
    return (
        <ol className={styles.rankingList}>
            {items.map((item, index) => (
                <li key={item.instalador}>
                    <span className={`${styles.rankPos} ${index < 3 ? styles[`rank${index + 1}`] : ''}`}>
                        {index === 0 ? <Trophy size={14} aria-label="1º lugar" /> : index + 1}
                    </span>
                    <div className={styles.rankBody}>
                        <div className={styles.rankRow}>
                            <span className={styles.rankName}>{item.instalador}</span>
                            <strong>{fmt(item.totalInstalado)}</strong>
                        </div>
                        <div className={styles.rankBar}><div style={{ width: `${(item.totalInstalado / max) * 100}%` }} /></div>
                    </div>
                </li>
            ))}
        </ol>
    );
}
