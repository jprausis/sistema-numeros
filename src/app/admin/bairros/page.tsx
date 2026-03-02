'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

export default function BairrosPage() {
    const [bairros, setBairros] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchBairros() {
            try {
                const res = await fetch('/api/admin/bairros');
                const data = await res.json();
                setBairros(data.bairros || []);
            } catch (e) {
                console.error("Erro ao buscar bairros");
            } finally {
                setLoading(false);
            }
        }
        fetchBairros();
    }, []);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Lotes e Bairros</h1>
                <p>Acompanhe os lotes de imóveis importados da prefeitura.</p>
            </header>

            <section className={styles.listCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Nome do Bairro</th>
                            <th>Data de Importação</th>
                            <th>Total de Imóveis</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5}>Carregando...</td></tr>
                        ) : bairros.map(b => (
                            <tr key={b.id}>
                                <td><strong>{b.nome}</strong></td>
                                <td>{new Date(b.dataImportacao).toLocaleDateString()}</td>
                                <td>{b._count.imoveis}</td>
                                <td><span className={styles.activeBadge}>{b.status}</span></td>
                                <td>
                                    <div className={styles.actions}>
                                        <Link href={`/admin/bairros/${b.id}`} className={styles.viewButton}>Ver Detalhes</Link>
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Tem certeza que deseja excluir o bairro ${b.nome} e todos os seus imóveis?`)) {
                                                    const res = await fetch(`/api/admin/bairros/${b.id}`, { method: 'DELETE' });
                                                    if (res.ok) {
                                                        alert("Bairro excluído!");
                                                        window.location.reload();
                                                    }
                                                }
                                            }}
                                            className={styles.deleteBtn}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
