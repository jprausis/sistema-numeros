'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    const [bairros, setBairros] = useState<any[]>([]);
    const [selectedBairro, setSelectedBairro] = useState<string>('');
    const [loadingStats, setLoadingStats] = useState(false);
    const [role, setRole] = useState<string | null>(null);
    
    // Novo estado para o ranking do dia selecionado (inicializa com hoje no fuso local)
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });
    const [rankingData, setRankingData] = useState<any[]>([]);
    const [loadingRanking, setLoadingRanking] = useState(false);

    // Novo estado para o ranking acumulado geral (todos os tempos)
    const [rankingGeralData, setRankingGeralData] = useState<any[]>([]);
    const [loadingRankingGeral, setLoadingRankingGeral] = useState(false);

    useEffect(() => {
        // Buscar papel do usuário
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => setRole(data.user?.role || 'INSTALLER'))
            .catch(() => setRole('INSTALLER'));

        // Buscar lista de bairros para o filtro
        fetch('/api/admin/bairros')
            .then(res => res.json())
            .then(data => setBairros(data.bairros || []));
    }, []);

    useEffect(() => {
        setLoadingStats(true);
        let url = '/api/admin/stats';
        if (selectedBairro) {
            url += `?bairroId=${selectedBairro}`;
        }
        
        fetch(url)
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoadingStats(false);
            })
            .catch(() => setLoadingStats(false));
    }, [selectedBairro]);

    // Efeito para carregar o ranking de instaladores filtrado por dia
    useEffect(() => {
        if (role !== 'ADMIN') return;
        setLoadingRanking(true);
        let url = `/api/admin/ranking?data=${selectedDate}`;
        if (selectedBairro) {
            url += `&bairroId=${selectedBairro}`;
        }
        
        fetch(url)
            .then(res => res.json())
            .then(data => {
                setRankingData(data.ranking || []);
                setLoadingRanking(false);
            })
            .catch(() => setLoadingRanking(false));
    }, [selectedDate, selectedBairro, role]);

    // Efeito para carregar o ranking geral acumulado (sem filtro de data)
    useEffect(() => {
        if (role !== 'ADMIN') return;
        setLoadingRankingGeral(true);
        let url = `/api/admin/ranking`; // Sem parâmetro de data
        if (selectedBairro) {
            url += `?bairroId=${selectedBairro}`;
        }
        
        fetch(url)
            .then(res => res.json())
            .then(data => {
                setRankingGeralData(data.ranking || []);
                setLoadingRankingGeral(false);
            })
            .catch(() => setLoadingRankingGeral(false));
    }, [selectedBairro, role]);

    const handleExport = async () => {
        try {
            let url = '/api/admin/exportar';
            if (selectedBairro) {
                url += `?bairroId=${selectedBairro}`;
            }
            const res = await fetch(url);
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `relatorio-instalacoes-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {
            alert("Erro ao exportar");
        }
    };

    if (!stats || role === null) return <div className={styles.loading}>Carregando indicadores...</div>;

    const concluidosPercent = stats.totalImoveis ? (stats.concluidos / stats.totalImoveis) * 100 : 0;
    const liberadosPercent = stats.totalImoveis ? (stats.liberados / stats.totalImoveis) * 100 : 0;
    const ausentesPercent = stats.totalImoveis ? (stats.ausentes / stats.totalImoveis) * 100 : 0;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Olá, Administrador</h1>
                    <p>Aqui está o resumo do progresso das instalações em Rio Branco do Sul.</p>
                </div>
                <button onClick={handleExport} className={styles.exportButton}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Exportar Dados (CSV)
                </button>
            </header>

            {/* BOTÕES DE AÇÕES RÁPIDAS NA PARTE SUPERIOR */}
            <div className={styles.filterContainer} style={{ gap: '1rem', flexWrap: 'wrap' }}>
                {role === 'ADMIN' && (
                    <button 
                        onClick={() => router.push('/admin/importar')} 
                        className={styles.exportButton}
                        style={{ background: 'var(--primary)' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Importar Novo Lote
                    </button>
                )}
                
                {(role === 'ADMIN' || role === 'OPERATOR' || role === 'PREFEITURA') && (
                    <button 
                        onClick={() => router.push('/admin/imoveis?cadastrar=true')} 
                        className={styles.exportButton}
                        style={{ background: '#22c55e' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Novo Imóvel
                    </button>
                )}

                <button 
                    onClick={() => router.push('/admin/imoveis')} 
                    className={styles.exportButton}
                    style={{ background: 'var(--info)' }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>
                    Ver Mapa de Execução
                </button>

                {role === 'ADMIN' && (
                    <button 
                        onClick={() => router.push('/admin/usuarios')} 
                        className={styles.exportButton}
                        style={{ background: 'var(--secondary)' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        Gerenciar Equipe
                    </button>
                )}
            </div>

            <div className={styles.filterContainer}>

                <span className={styles.filterLabel}>Filtrar por Bairro:</span>
                <select 
                    className={styles.select} 
                    value={selectedBairro} 
                    onChange={(e) => setSelectedBairro(e.target.value)}
                >
                    <option value="">Todos os Bairros</option>
                    {bairros.map(b => (
                        <option key={b.id} value={b.id}>{b.nome}</option>
                    ))}
                </select>
                {(loadingStats || loadingRanking || loadingRankingGeral) && <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>Atualizando...</span>}
            </div>

            {/* SEÇÃO 1: IMOVEIS */}
            <div className={styles.sectionGroup}>
                <h2 className={styles.sectionGroupTitle}>Indicadores por Imóveis</h2>
                <div className={`${styles.statsGrid} ${loadingStats ? styles.loadingGrid : ''}`}>
                    <div className={`${styles.card} ${styles.total}`}>
                        <div className={styles.cardHeader}>
                            <span className={styles.cardLabel}>Base de Imóveis</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path></svg>
                        </div>
                        <p className={styles.cardValue}>{stats.totalImoveis}</p>
                        <span className={styles.cardSub}>Total carregado no sistema</span>
                    </div>

                    <div className={`${styles.card} ${styles.success}`}>
                        <div className={styles.cardHeader}>
                            <span className={styles.cardLabel}>Imóveis Concluídos</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <p className={styles.cardValue}>{stats.concluidos || 0}</p>
                        <span className={styles.cardSub}>Total de imóveis instalados</span>
                    </div>


                    <div className={`${styles.card} ${styles.info}`}>
                        <div className={styles.cardHeader}>
                            <span className={styles.cardLabel}>Liberados</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <p className={styles.cardValue}>{stats.liberados}</p>
                        <span className={styles.cardSub}>Aguardando instalação</span>
                    </div>

                    <div className={`${styles.card} ${styles.warning}`}>
                        <div className={styles.cardHeader}>
                            <span className={styles.cardLabel}>Ausentes</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                        </div>
                        <p className={styles.cardValue}>{stats.ausentes}</p>
                        <span className={styles.cardSub}>Moradores não encontrados</span>
                    </div>

                    <div className={`${styles.card} ${styles.success}`}>
                        <div className={styles.cardHeader}>
                            <span className={styles.cardLabel}>Compl. Instalados</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <p className={styles.cardValue}>{stats.complementosInstalados || 0}</p>
                        <span className={styles.cardSub}>Unidades internas instaladas</span>
                    </div>

                </div>
            </div>

            {/* SEÇÃO 2: ALGARISMOS */}
            {role === 'ADMIN' && (
                <div className={styles.sectionGroup}>
                    <h2 className={styles.sectionGroupTitle}>Indicadores por Algarismos</h2>
                    <div className={`${styles.statsGrid} ${loadingStats ? styles.loadingGrid : ''}`}>
                        <div className={`${styles.card} ${styles.success}`}>
                            <div className={styles.cardHeader}>
                                <span className={styles.cardLabel}>Algarismos (Total)</span>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"></path><path d="M9 11v11"></path><path d="M15 11v11"></path><path d="M20 7H4"></path><path d="M20 11H4"></path></svg>
                            </div>
                            <p className={styles.cardValue}>{stats.digitos?.totalNecessario || 0}</p>
                            <span className={styles.cardSub}>Total de dígitos físicos necessários</span>
                        </div>

                        <div className={`${styles.card} ${styles.info}`}>
                            <div className={styles.cardHeader}>
                                <span className={styles.cardLabel}>Algarismos (Instalados)</span>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                            </div>
                            <p className={styles.cardValue}>{stats.digitos?.totalInstalado || 0}</p>
                            <span className={styles.cardSub}>Dígitos de imóveis já fixados</span>
                        </div>

                        <div className={`${styles.card} ${styles.info}`}>
                            <div className={styles.cardHeader}>
                                <span className={styles.cardLabel}>Alg. Compl. (Instalados)</span>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                            </div>
                            <p className={styles.cardValue}>{stats.algarismosComplementosInstalados || 0}</p>
                            <span className={styles.cardSub}>Dígitos de complementos fixados</span>
                        </div>

                        <div className={`${styles.card} ${styles.success}`}>
                            <div className={styles.cardHeader}>
                                <span className={styles.cardLabel}>Total Geral Algarismos</span>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"></path><path d="M9 11v11"></path><path d="M15 11v11"></path><path d="M20 7H4"></path><path d="M20 11H4"></path></svg>
                            </div>
                            <p className={styles.cardValue}>{stats.totalGeralAlgarismosInstalados || 0}</p>
                            <span className={styles.cardSub}>Soma de algarismos (imóveis + complementos)</span>
                        </div>
                    </div>
                </div>
            )}



            <div className={styles.mainGrid}>
                <section className={styles.progressSection}>
                    <h3>Progresso das Instalações</h3>
                    <div className={styles.progressBarWrapper}>
                        <div
                            className={styles.progressBar}
                            style={{ width: `${concluidosPercent}%` }}
                            title={`Concluídos: ${concluidosPercent.toFixed(1)}%`}
                        ></div>
                        <div
                            className={styles.progressBarLiberados}
                            style={{ width: `${liberadosPercent}%` }}
                            title={`Liberados: ${liberadosPercent.toFixed(1)}%`}
                        ></div>
                        <div
                            className={styles.progressBarAusentes}
                            style={{ width: `${ausentesPercent}%` }}
                            title={`Ausentes: ${ausentesPercent.toFixed(1)}%`}
                        ></div>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--primary)' }}></div>
                            <span>Concluídos ({concluidosPercent.toFixed(1)}%)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f59e0b' }}></div>
                            <span>Liberados ({liberadosPercent.toFixed(1)}%)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444' }}></div>
                            <span>Ausentes ({ausentesPercent.toFixed(1)}%)</span>
                        </div>
                    </div>
                    <p>Ao todo, <strong>{((stats.concluidos + stats.liberados + stats.ausentes) / stats.totalImoveis * 100).toFixed(1)}%</strong> da base já foi trabalhada ou está pronta para execução.</p>
                </section>


                {/* PAINEL DE RANKING POR DIA (ALGARISMOS INSTALADOS) */}
                {role === 'ADMIN' && (
                    <section className={styles.rankingSection}>
                        <div className={styles.rankingHeader}>
                            <div>
                                <h3>Ranking de Algarismos Instalados no Dia</h3>
                                <p style={{ color: 'var(--secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                    Total de algarismos (caracteres físicos) instalados no dia selecionado por instalador.
                                </p>
                            </div>
                            <div>
                                <input 
                                    type="date" 
                                    className={styles.dateInput} 
                                    value={selectedDate} 
                                    onChange={(e) => setSelectedDate(e.target.value)} 
                                    title="Selecione o dia do ranking"
                                />
                            </div>
                        </div>

                        <div className={`${styles.statsGrid} ${loadingRanking ? styles.loadingGrid : ''}`}>
                            {rankingData.length === 0 ? (
                                <div className={styles.noRanking}>
                                    Nenhum registro de instalação encontrado para o dia {selectedDate.split('-').reverse().join('/')}.
                                </div>
                            ) : (
                                rankingData.map((item, index) => (
                                    <div key={item.instalador} className={`${styles.card} ${styles.success}`}>
                                        <div className={styles.cardHeader} style={{ marginBottom: 0 }}>
                                            <span className={styles.cardLabel} style={{ fontSize: '0.95rem' }}>
                                                #{index + 1} {item.instalador}
                                            </span>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                        </div>
                                        <p className={styles.cardValue} style={{ fontSize: '2rem', marginTop: '0.5rem' }}>
                                            {item.totalInstalado}
                                        </p>
                                        <span className={styles.cardSub}>algarismos instalados no dia</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                )}

                {/* PAINEL DE RANKING ACUMULADO / GERAL */}
                {role === 'ADMIN' && (
                    <section className={styles.rankingSection}>
                        <div className={styles.rankingHeader}>
                            <div>
                                <h3>Total de Algarismos Instalados por Instalador (Geral)</h3>
                                <p style={{ color: 'var(--secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                    Soma acumulada de todos os algarismos (caracteres físicos) instalados na base por instalador.
                                </p>
                            </div>
                        </div>

                        <div className={`${styles.statsGrid} ${loadingRankingGeral ? styles.loadingGrid : ''}`}>
                            {rankingGeralData.length === 0 ? (
                                <div className={styles.noRanking}>
                                    Nenhum registro de instalação encontrado no período geral.
                                </div>
                            ) : (
                                rankingGeralData.map((item, index) => (
                                    <div key={item.instalador} className={`${styles.card} ${styles.info}`}>
                                        <div className={styles.cardHeader} style={{ marginBottom: 0 }}>
                                            <span className={styles.cardLabel} style={{ fontSize: '0.95rem' }}>
                                                #{index + 1} {item.instalador}
                                            </span>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                        </div>
                                        <p className={styles.cardValue} style={{ fontSize: '2rem', marginTop: '0.5rem' }}>
                                            {item.totalInstalado}
                                        </p>
                                        <span className={styles.cardSub}>total acumulado de algarismos</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                )}


            </div>
        </div>
    );
}
