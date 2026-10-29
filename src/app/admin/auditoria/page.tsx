'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Filter, Loader2, ShieldCheck } from 'lucide-react';
import ui from '../admin.module.css';
import styles from './page.module.css';
import { formatBrazil } from '@/lib/timezone';
import { toast } from '@/utils/toast';

// Rótulos legíveis para as ações registradas
const ACTION_LABELS: Record<string, string> = {
    UPDATE_IMOVEL: 'Imóvel editado',
    CREATE_IMOVEL: 'Imóvel cadastrado',
    UPDATE_IMOVEL_LOTE: 'Instalação registrada',
    UPDATE_COMPLEMENTO: 'Complemento atualizado',
    RELEASE_COMPLEMENTO: 'Complemento liberado',
    BLOCK_COMPLEMENTO: 'Complemento bloqueado',
    UPDATE_AGENDAMENTO: 'Agendamento editado',
    DELETE_AGENDAMENTO: 'Agendamento excluído',
    CADASTRAR_AGENDAMENTO: 'Agendamento criado',
    EDITAR_AGENDAMENTO: 'Agendamento alterado',
    VINCULAR_AGENDAMENTO: 'Agendamento vinculado',
    DELETE_BAIRRO: 'Bairro excluído',
    BAIRRO_CONCLUIDO: 'Bairro concluído',
    BAIRRO_REABERTO: 'Bairro reaberto',
    CREATE_USER: 'Usuário criado',
    UPDATE_USER: 'Usuário editado',
    DELETE_USER: 'Usuário excluído',
    ESTOQUE_ENTRADA: 'Entrada de estoque',
    ESTOQUE_AJUSTE: 'Ajuste de estoque',
};
const CAMPO_LABELS: Record<string, string> = {
    nome: 'Nome',
    telefone: 'Telefone',
    dataHora: 'Data/hora',
    status: 'Status',
    inscimobVinculo: 'Imóvel vinculado',
    'imovel.status': 'Status do imóvel',
    'imovel.obsPendente': 'Observação',
    'complemento.numeroPredial': 'Número da unidade',
    numeroAInstalar: 'Número do imóvel',
};
const valorCampo = (campo: string, v: any) =>
    v === null || v === undefined ? '—' : campo === 'dataHora' ? formatBrazil(v, true) : String(v);

const actionLabel = (action: string) =>
    ACTION_LABELS[action] || (action.startsWith('CONCLUIR_IMOVEL_') ? `Status → ${action.replace('CONCLUIR_IMOVEL_', '')}` : action);

export default function AuditoriaPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ totalCount: 0, totalPages: 1, currentPage: 1, limit: 50 });
    const [filters, setFilters] = useState({ imovel: '', userEmail: '', startDate: '', endDate: '', sortOrder: 'desc' });

    const fetchLogs = useCallback((page = 1, currentFilters = filters) => {
        setLoading(true);
        const params = new URLSearchParams({ page: page.toString(), ...currentFilters });
        fetch(`/api/admin/auditoria?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                setLogs(data.logs || []);
                if (data.pagination) setPagination(data.pagination);
            })
            .catch(() => toast.error('Erro ao carregar o histórico.'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchLogs(1);
    }, [fetchLogs]);

    const handleFilter = (e: React.FormEvent) => {
        e.preventDefault();
        fetchLogs(1, filters);
    };

    return (
        <div className={ui.container}>
            <header className={ui.header}>
                <div>
                    <h1>Auditoria</h1>
                    <p>Histórico de alterações realizadas no sistema por todos os usuários.</p>
                </div>
            </header>

            <form className={`${ui.cardPadded} ${styles.filterBar}`} onSubmit={handleFilter}>
                <div className={ui.field}>
                    <label htmlFor="f-imovel">Nº do imóvel / inscrição</label>
                    <input id="f-imovel" type="search" placeholder="Ex: 311" value={filters.imovel} onChange={e => setFilters({ ...filters, imovel: e.target.value })} />
                </div>
                <div className={ui.field}>
                    <label htmlFor="f-email">E-mail do usuário</label>
                    <input id="f-email" type="search" placeholder="Ex: joao@email.com" value={filters.userEmail} onChange={e => setFilters({ ...filters, userEmail: e.target.value })} />
                </div>
                <div className={ui.field}>
                    <label htmlFor="f-start">De</label>
                    <input id="f-start" type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
                </div>
                <div className={ui.field}>
                    <label htmlFor="f-end">Até</label>
                    <input id="f-end" type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
                </div>
                <div className={ui.field}>
                    <label htmlFor="f-order">Ordem</label>
                    <select id="f-order" value={filters.sortOrder} onChange={e => setFilters({ ...filters, sortOrder: e.target.value })}>
                        <option value="desc">Mais recentes</option>
                        <option value="asc">Mais antigos</option>
                    </select>
                </div>
                <button type="submit" className={ui.btnPrimary}><Filter size={16} /> Filtrar</button>
            </form>

            <section className={ui.card}>
                <div className={ui.tableWrap}>
                    <table className={ui.table}>
                        <thead>
                            <tr>
                                <th>Data/Hora</th>
                                <th>Usuário</th>
                                <th>Ação</th>
                                <th>Detalhes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4}><div className={ui.emptyState}><Loader2 className="spin" /> Carregando registros...</div></td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={4}><div className={ui.emptyState}><ShieldCheck size={40} /><strong>Nenhum registro encontrado</strong></div></td></tr>
                            ) : logs.map((log: any) => (
                                <tr key={log.id}>
                                    <td className={styles.dateCol}>{formatBrazil(log.createdAt, true)}</td>
                                    <td>
                                        <strong>{log.userEmail}</strong>
                                        {log.ip && <span className={ui.cellSub}>IP {log.ip}</span>}
                                    </td>
                                    <td>
                                        <span className={styles.actionBadge}>{actionLabel(log.action)}</span>
                                        {log.imovel && (
                                            <span className={styles.imovelRef}>
                                                Nº {log.imovel.numero}{log.imovel.complemento ? ` (${log.imovel.complemento})` : ''}
                                                {log.imovel.bairro ? ` • ${log.imovel.bairro}` : ''}
                                            </span>
                                        )}
                                        <span className={ui.cellSub}>{log.resource}{log.resourceId ? `: ${log.resourceId}` : ''}</span>
                                    </td>
                                    <td className={styles.detailsCol}>
                                        {Array.isArray(log.details?.alteracoes) && log.details.alteracoes.length > 0 && (
                                            <ul className={styles.changes}>
                                                {log.details.alteracoes.map((a: any, i: number) => (
                                                    <li key={`${a.campo}-${i}`}>
                                                        <strong>{CAMPO_LABELS[a.campo] || a.campo}:</strong>{' '}
                                                        <span className={styles.changeOld}>{valorCampo(a.campo, a.antes)}</span> → {valorCampo(a.campo, a.depois)}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <details>
                                            <summary>Ver dados</summary>
                                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                        </details>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {pagination.totalPages > 1 && (
                    <div className={ui.pagination}>
                        <button className={ui.btnSecondary} disabled={pagination.currentPage <= 1 || loading} onClick={() => fetchLogs(pagination.currentPage - 1, filters)}>
                            <ChevronLeft size={16} /> Anterior
                        </button>
                        <span>Página {pagination.currentPage} de {pagination.totalPages} • {pagination.totalCount.toLocaleString('pt-BR')} registros</span>
                        <button className={ui.btnSecondary} disabled={pagination.currentPage >= pagination.totalPages || loading} onClick={() => fetchLogs(pagination.currentPage + 1, filters)}>
                            Próxima <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
