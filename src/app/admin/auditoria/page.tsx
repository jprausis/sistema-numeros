'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AuditoriaPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/admin/auditoria')
            .then(res => res.json())
            .then(data => {
                setLogs(data.logs || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

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
            </section>
        </div>
    );
}
