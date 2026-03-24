'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AuditoriaPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState<any>({
        totalCount: 0,
        totalPages: 1,
        currentPage: 1,
        limit: 50
    });

    const [filters, setFilters] = useState({
        userEmail: '',
        startDate: '',
        endDate: '',
        sortOrder: 'desc'
    });

    const fetchLogs = (page = 1) => {
        setLoading(true);
        const params = new URLSearchParams({
            page: page.toString(),
            userEmail: filters.userEmail,
            startDate: filters.startDate,
            endDate: filters.endDate,
            sortOrder: filters.sortOrder
        });

        fetch(`/api/admin/auditoria?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                setLogs(data.logs || []);
                setPagination(data.pagination || { totalCount: 0, totalPages: 1, currentPage: 1, limit: 50 });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchLogs(1);
    }, []);

    const handleFilter = (e: React.FormEvent) => {
        e.preventDefault();
        fetchLogs(1);
    };

    const formatDetails = (details: any) => {
        try {
            return JSON.stringify(details, null, 2);
        } catch (e) {
            return "Dados ilegíveis";
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Log de Auditoria</h1>
                    <p>Histórico completo de alterações realizadas no sistema por administradores e operadores.</p>
                </div>
            </header>

            <form className={styles.filterBar} onSubmit={handleFilter}>
                <div className={styles.filterGroup}>
                    <label>E-mail do Usuário</label>
                    <input 
                        type="text" 
                        placeholder="Ex: joao@email.com" 
                        value={filters.userEmail}
                        onChange={e => setFilters({...filters, userEmail: e.target.value})}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <label>Data Início</label>
                    <input 
                        type="date" 
                        value={filters.startDate}
                        onChange={e => setFilters({...filters, startDate: e.target.value})}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <label>Data Fim</label>
                    <input 
                        type="date" 
                        value={filters.endDate}
                        onChange={e => setFilters({...filters, endDate: e.target.value})}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <label>Ordenação</label>
                    <select 
                        value={filters.sortOrder}
                        onChange={e => setFilters({...filters, sortOrder: e.target.value})}
                        style={{
                            padding: '0.6rem 1rem',
                            borderRadius: '6px',
                            border: '1px solid var(--card-border)',
                            background: 'var(--background)',
                            color: 'var(--foreground)',
                            fontSize: '0.9rem'
                        }}
                    >
                        <option value="desc">Mais recentes primeiro</option>
                        <option value="asc">Mais antigos primeiro</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <button type="submit">Filtrar</button>
                </div>
            </form>

            <section className={styles.listCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Data/Hora</th>
                            <th>Usuário</th>
                            <th>Ação</th>
                            <th>IP</th>
                            <th>Detalhes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5}>Carregando logs...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={5}>Nenhum registro encontrado.</td></tr>
                        ) : logs.map((log: any) => (
                            <tr key={log.id}>
                                <td className={styles.dateCol}>
                                    {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                </td>
                                <td>
                                    <strong>{log.userEmail}</strong>
                                    <br />
                                    <small>{log.userId}</small>
                                </td>
                                <td>
                                    <span className={styles.badge}>{log.action}</span>
                                    <br />
                                    <small>{log.resource}: {log.resourceId}</small>
                                </td>
                                <td>{log.ip}</td>
                                <td className={styles.detailsCol}>
                                    <pre>{formatDetails(log.details)}</pre>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {pagination.totalPages > 1 && (
                    <div className={styles.pagination}>
                        <button 
                            className={styles.pageBtn} 
                            disabled={pagination.currentPage === 1}
                            onClick={() => fetchLogs(pagination.currentPage - 1)}
                        >
                            Anterior
                        </button>
                        <span>Página {pagination.currentPage} de {pagination.totalPages}</span>
                        <button 
                            className={styles.pageBtn} 
                            disabled={pagination.currentPage === pagination.totalPages}
                            onClick={() => fetchLogs(pagination.currentPage + 1)}
                        >
                            Próxima
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
