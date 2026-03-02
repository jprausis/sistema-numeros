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
                    📥 Exportar Dados (CSV)
                </button>
            </header>

            <div className={styles.statsGrid}>
                <div className={`${styles.card} ${styles.total}`}>
                    <span className={styles.cardLabel}>Base de Imóveis</span>
                    <p className={styles.cardValue}>{stats.totalImoveis}</p>
                    <span className={styles.cardSub}>Total carregado no sistema</span>
                </div>

                <div className={`${styles.card} ${styles.success}`}>
                    <span className={styles.cardLabel}>Concluídos</span>
                    <p className={styles.cardValue}>{stats.concluidos}</p>
                    <span className={styles.cardSub}>Placas instaladas com sucesso</span>
                </div>

                <div className={`${styles.card} ${styles.warning}`}>
                    <span className={styles.cardLabel}>Pendências</span>
                    <p className={styles.cardValue}>{stats.pendentes}</p>
                    <span className={styles.cardSub}>Imóveis com problemas técnicos</span>
                </div>

                <div className={`${styles.card} ${styles.info}`}>
                    <span className={styles.cardLabel}>Agendamentos</span>
                    <p className={styles.cardValue}>{stats.agendamentosHoje}</p>
                    <span className={styles.cardSub}>Solicitados para hoje</span>
                </div>
            </div>

            <div className={styles.mainGrid}>
                <section className={styles.progressSection}>
                    <h3>Progresso Geral</h3>
                    <div className={styles.progressBarWrapper}>
                        <div
                            className={styles.progressBar}
                            style={{ width: `${(stats.concluidos / stats.totalImoveis) * 100}%` }}
                        ></div>
                    </div>
                    <p><strong>{((stats.concluidos / stats.totalImoveis) * 100).toFixed(1)}%</strong> da base total já foi numerada.</p>
                </section>

                <section className={styles.activityCard}>
                    <h3>Configurações Rápidas</h3>
                    <div className={styles.quickActions}>
                        <button onClick={() => router.push('/admin/importar')}>Importar Novo Lote</button>
                        <button onClick={() => router.push('/admin/imoveis')}>Ver Mapa de Execução</button>
                        <button onClick={() => router.push('/admin/usuarios')}>Gerenciar Equipe</button>
                    </div>
                </section>
            </div>
        </div>
    );
}
