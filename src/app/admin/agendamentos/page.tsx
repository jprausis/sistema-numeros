'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function AdminAgendamentosPage() {
    const [agendamentos, setAgendamentos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [vinculando, setVinculando] = useState<string | null>(null);
    const [inscimobInput, setInscimobInput] = useState('');

    useEffect(() => {
        fetchAgendamentos();
    }, []);

    async function fetchAgendamentos() {
        try {
            const res = await fetch('/api/agendamentos/listar');
            const data = await res.json();
            setAgendamentos(data.agendamentos || []);
        } catch (e) {
            console.error("Erro ao buscar agendamentos");
        } finally {
            setLoading(false);
        }
    }

    const handleVincular = async (protocolo: string) => {
        if (!inscimobInput) return alert("Informe o inscimob");

        try {
            const res = await fetch('/api/admin/agendamentos/vincular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ protocolo, inscimob: inscimobInput })
            });

            if (res.ok) {
                alert("Vínculo realizado com sucesso!");
                setVinculando(null);
                setInscimobInput('');
                fetchAgendamentos();
            } else {
                const data = await res.json();
                alert(data.error || "Erro ao vincular");
            }
        } catch (e) {
            alert("Erro na conexão");
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Gestão de Agendamentos</h1>
                <p>Vincule os pedidos dos moradores à base oficial do município.</p>
            </header>

            <section className={styles.listCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Protocolo</th>
                            <th>Morador</th>
                            <th>Endereço</th>
                            <th>Data/Hora</th>
                            <th>Vínculo (Inscimob)</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6}>Carregando...</td></tr>
                        ) : agendamentos.map(ag => (
                            <tr key={ag.protocolo}>
                                <td><span className={styles.protoBadge}>{ag.protocolo}</span></td>
                                <td>
                                    <strong>{ag.nome}</strong><br />
                                    <small>{ag.telefone}</small>
                                </td>
                                <td>{ag.enderecoCompleto}</td>
                                <td>
                                    {new Date(ag.dataHora).toLocaleDateString()}<br />
                                    {new Date(ag.dataHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td>
                                    {ag.inscimobVinculo ? (
                                        <span className={styles.linkedBadge}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"></path></svg>
                                            {ag.inscimobVinculo}
                                        </span>
                                    ) : (
                                        <span className={styles.unlinkedBadge}>Não vinculado</span>
                                    )}
                                </td>
                                <td>
                                    {vinculando === ag.protocolo ? (
                                        <div className={styles.vincularForm}>
                                            <input
                                                type="text"
                                                placeholder="Inscimob"
                                                value={inscimobInput}
                                                onChange={e => setInscimobInput(e.target.value)}
                                                className={styles.miniInput}
                                            />
                                            <button onClick={() => handleVincular(ag.protocolo)} className={styles.vincBtn}>OK</button>
                                            <button onClick={() => setVinculando(null)} className={styles.cancelBtn}>X</button>
                                        </div>
                                    ) : (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => {
                                                setVinculando(ag.protocolo);
                                                setInscimobInput(ag.inscimobVinculo || '');
                                            }}
                                        >
                                            {ag.inscimobVinculo ? "Alterar" : "Vincular"}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
