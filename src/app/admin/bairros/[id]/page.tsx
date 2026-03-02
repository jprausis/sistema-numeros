'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from '../page.module.css'; // Usando o mesmo CSS de bairros para manter padrão

export default function BairroDetalhesPage() {
    const { id } = useParams();
    const router = useRouter();
    const [imoveis, setImoveis] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchImoveis() {
            try {
                const res = await fetch(`/api/admin/bairros/${id}/imoveis`);
                const data = await res.json();
                setImoveis(data.imoveis || []);
            } catch (e) {
                console.error("Erro ao carregar detalhes");
            } finally {
                setLoading(false);
            }
        }
        fetchImoveis();
    }, [id]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Detalhes do Lote</h1>
                    <p>Lista de imóveis vinculados a este bairro.</p>
                </div>
                <button className={styles.addButton} onClick={() => router.back()}>
                    Voltar
                </button>
            </header>

            <section className={styles.listCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Insc. Imob.</th>
                            <th>Nº Antigo / Novo</th>
                            <th>Logradouro</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4}>Carregando imóveis...</td></tr>
                        ) : imoveis.length > 0 ? (
                            imoveis.map(im => (
                                <tr key={im.id}>
                                    <td>{im.inscimob}</td>
                                    <td><strong>{im.numeroAntigo || 'S/N'}</strong> {'->'} <strong>{im.numeroAInstalar}</strong></td>
                                    <td>{im.logradouro}</td>
                                    <td>{im.status || 'Pendente'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={4}>Nenhum imóvel encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
