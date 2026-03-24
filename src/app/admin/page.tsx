'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        fetch('/api/admin/stats')
            .then(res => res.json())
            .then(data => setStats(data));
    }, []);

    const handleExport = async () => {
        try {
            const res = await fetch('/api/admin/exportar');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `relatorio-instalacoes-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {
            alert("Erro ao exportar");
        }
    };

    if (!stats) return <div className={styles.loading}>Carregando indicadores...</div>;

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

            <div className={styles.statsGrid}>
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
                    <span className={styles.cardSub}>Dígitos já fixados</span>
                </div>

                <div className={`${styles.card} ${styles.warning}`}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardLabel}>Pendências</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <p className={styles.cardValue}>{stats.pendentes}</p>
                    <span className={styles.cardSub}>Imóveis com problemas técnicos</span>
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

                <div className={`${styles.card} ${styles.total}`}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardLabel}>Complementos</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    </div>
                    <p className={styles.cardValue}>{stats.totalComplementos}</p>
                    <span className={styles.cardSub}>Unidades internas totais</span>
                </div>

                <div className={`${styles.card} ${styles.success}`}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardLabel}>Compl. Liberados</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <p className={styles.cardValue}>{stats.complementosLiberados}</p>
                    <span className={styles.cardSub}>Unidades prontas para instalar</span>
                </div>
                <div className={`${styles.card} ${styles.warning}`}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardLabel}>Agend. Pendentes</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <p className={styles.cardValue}>{stats.agendamentosPendentes || 0}</p>
                    <span className={styles.cardSub}>Pedidos aguardando vínculo</span>
                </div>

                <div className={`${styles.card} ${styles.info}`}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardLabel}>Algarismos (Liberados)</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <p className={styles.cardValue}>{stats.totalAlgarismosLiberados || 0}</p>
                    <span className={styles.cardSub}>Total de dígitos em imóveis liberados</span>
                </div>
            </div>

            <div className={styles.mainGrid}>
                <section className={styles.progressSection}>
                    <h3>Progresso das Instalações</h3>
                    <div className={styles.progressBarWrapper}>
                        <div
                            className={styles.progressBar}
                            style={{ width: `${(stats.concluidos / stats.totalImoveis) * 100}%` }}
                            title={`Concluídos: ${((stats.concluidos / stats.totalImoveis) * 100).toFixed(1)}%`}
                        ></div>
                        <div
                            className={styles.progressBarLiberados}
                            style={{ width: `${((stats.liberados + stats.ausentes) / stats.totalImoveis) * 100}%` }}
                            title={`Liberados + Ausentes: ${(((stats.liberados + stats.ausentes) / stats.totalImoveis) * 100).toFixed(1)}%`}
                        ></div>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--primary)' }}></div>
                            <span>Concluídos ({((stats.concluidos / stats.totalImoveis) * 100).toFixed(1)}%)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f59e0b' }}></div>
                            <span>Liberados + Ausentes ({(((stats.liberados + stats.ausentes) / stats.totalImoveis) * 100).toFixed(1)}%)</span>
                        </div>
                    </div>
                    <p>Ao todo, <strong>{(((stats.concluidos + stats.liberados + stats.ausentes) / stats.totalImoveis) * 100).toFixed(1)}%</strong> da base já foi trabalhada ou está pronta para execução.</p>
                </section>

                <section className={styles.activityCard}>
                    <h3>Links Rápidos</h3>
                    <div className={styles.quickActions}>
                        <button onClick={() => router.push('/admin/importar')}>Importar Novo Lote</button>
                        <button onClick={() => router.push('/admin/imoveis')}>Ver Mapa de Execução</button>
                        <button onClick={() => router.push('/admin/usuarios')}>Gerenciar Equipe</button>
                    </div>
                </section>

                {stats.digitos?.liberadosPorDigito && (
                    <section className={styles.digitSection}>
                        <h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            Algarismos de Imóveis Liberados
                        </h3>
                        <p style={{ marginBottom: '1.5rem', color: 'var(--secondary)', fontSize: '0.95rem' }}>
                            Estes são os algarismos necessários especificamente para os imóveis que já estão com status <strong>LIBERADO</strong>.
                        </p>
                        <div className={styles.digitGrid}>
                            {Object.entries(stats.digitos.liberadosPorDigito).map(([digit, count]) => (
                                <div key={digit} className={`${styles.digitItem} ${count as number > 0 ? styles.activeDigit : ''}`}>
                                    <span className={styles.digitLabel}>{digit}</span>
                                    <span className={styles.digitValue}>quantidade: <strong>{count as number}</strong></span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {stats.digitos?.faltantesPorDigito && (
                    <section className={styles.digitSection}>
                        <h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                            Algarismos Faltantes (Total da Base)
                        </h3>
                        <p style={{ marginBottom: '1.5rem', color: 'var(--secondary)', fontSize: '0.95rem' }}>
                            Contagem total de algarismos necessários para todos os imóveis ainda não instalados na base.
                        </p>
                        <div className={styles.digitGrid}>
                            {Object.entries(stats.digitos.faltantesPorDigito).map(([digit, count]) => (
                                <div key={digit} className={styles.digitItem}>
                                    <span className={styles.digitLabel}>{digit}</span>
                                    <span className={styles.digitValue}>faltam <strong>{count as number}</strong></span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

        </div>
    );
}
