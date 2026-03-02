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
                                            🗑️
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
