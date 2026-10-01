'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function AdminAgendamentosPage() {
    const [activeTab, setActiveTab] = useState<'agendamentos' | 'contatos'>('agendamentos');
    const [items, setItems] = useState<any[]>([]);
    const [totalAgendamentos, setTotalAgendamentos] = useState(0);
    const [totalContatos, setTotalContatos] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Estado para Vincular em Contatos
    const [vinculando, setVinculando] = useState<string | null>(null);
    const [inscimobInput, setInscimobInput] = useState('');

    // Estado para Edição de Agendamento/Contato
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [editData, setEditData] = useState('');
    const [editHorario, setEditHorario] = useState('09:00');
    const [editNome, setEditNome] = useState('');
    const [editTelefone, setEditTelefone] = useState('');
    const [editObservacao, setEditObservacao] = useState('');
    const [editStatus, setEditStatus] = useState('AGENDADO');
    const [savingEdit, setSavingEdit] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    async function fetchData(querySearch = search) {
        setLoading(true);
        try {
            const params = new URLSearchParams({ tipo: activeTab });
            if (querySearch.trim()) {
                params.set('q', querySearch.trim());
            }
            const res = await fetch(`/api/agendamentos/listar?${params.toString()}`);
            const data = await res.json();
            if (res.ok) {
                setItems(data.items || []);
                if (data.totalAgendamentos !== undefined) setTotalAgendamentos(data.totalAgendamentos);
                if (data.totalContatos !== undefined) setTotalContatos(data.totalContatos);
            }
        } catch (e) {
            console.error("Erro ao buscar dados:", e);
        } finally {
            setLoading(false);
        }
    }

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchData(search);
    };

    const handleOpenEdit = (item: any) => {
        setEditingItem(item);
        setEditNome(item.nome || '');
        setEditTelefone(item.telefone || '');
        setEditStatus(item.status || 'AGENDADO');
        setEditObservacao(item.observacao || item.imovel?.obsPendente || '');

        if (item.dataStr) {
            setEditData(item.dataStr);
        } else if (item.dataHora) {
            const d = new Date(item.dataHora);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            setEditData(`${yyyy}-${mm}-${dd}`);
        } else {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const yyyy = tomorrow.getFullYear();
            const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
            const dd = String(tomorrow.getDate()).padStart(2, '0');
            setEditData(`${yyyy}-${mm}-${dd}`);
        }

        if (item.horarioStr) {
            setEditHorario(item.horarioStr);
        } else if (item.dataHora) {
            const d = new Date(item.dataHora);
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            setEditHorario(`${hh}:${min}`);
        } else {
            setEditHorario('09:00');
        }
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;

        setSavingEdit(true);
        try {
            const res = await fetch('/api/admin/agendamentos/editar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    protocolo: editingItem.protocolo,
                    data: editData,
                    horario: editHorario,
                    nome: editNome,
                    telefone: editTelefone,
                    observacao: editObservacao,
                    status: editStatus
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                alert("Agendamento atualizado com sucesso!");
                setEditingItem(null);
                fetchData();
            } else {
                alert(data.error || "Erro ao salvar alterações");
            }
        } catch (e: any) {
            alert("Erro ao conectar ao servidor: " + (e.message || ""));
        } finally {
            setSavingEdit(false);
        }
    };

    const handleVincular = async (protocolo: string) => {
        if (!inscimobInput.trim()) return alert("Informe a inscrição imobiliária (inscimob).");

        try {
            const res = await fetch('/api/admin/agendamentos/vincular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ protocolo, inscimob: inscimobInput.trim() })
            });

            if (res.ok) {
                alert("Vínculo realizado com sucesso!");
                setVinculando(null);
                setInscimobInput('');
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error || "Erro ao vincular");
            }
        } catch (e) {
            alert("Erro na conexão");
        }
    };

    const handleExcluir = async (protocolo: string) => {
        if (!confirm(`Tem certeza que deseja excluir o agendamento ${protocolo}?`)) return;

        try {
            const res = await fetch(`/api/admin/agendamentos/excluir?protocolo=${protocolo}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                alert("Registro excluído com sucesso!");
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error || "Erro ao excluir");
            }
        } catch (e) {
            alert("Erro na conexão");
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.headerRow}>
                <div>
                    <h1>Gestão de Agendamentos</h1>
                    <p>
                        {activeTab === 'agendamentos'
                            ? 'Agendamentos oficiais enviados para a fila de instalação dos operadores.'
                            : 'Cadastros e solicitações prévias enviadas através do formulário de contato dos moradores.'}
                    </p>
                </div>

                <div className={styles.tabGroup}>
                    <button
                        type="button"
                        className={activeTab === 'agendamentos' ? styles.tabBtnActive : styles.tabBtn}
                        onClick={() => { setActiveTab('agendamentos'); setSearch(''); }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>Agendamentos</span>
                        {totalAgendamentos > 0 && <span className={styles.badgeCount}>{totalAgendamentos}</span>}
                    </button>

                    <button
                        type="button"
                        className={activeTab === 'contatos' ? styles.tabBtnActive : styles.tabBtn}
                        onClick={() => { setActiveTab('contatos'); setSearch(''); }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>Lista de Contatos</span>
                        {totalContatos > 0 && <span className={styles.badgeCount}>{totalContatos}</span>}
                    </button>
                </div>
            </header>

            <div className={styles.controlsBar}>
                <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder={activeTab === 'agendamentos' ? 'Buscar por protocolo, morador, inscimob...' : 'Buscar por nome, telefone, endereço...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={styles.searchInput}
                    />
                </form>
            </div>

            <section className={styles.listCard}>
                {activeTab === 'agendamentos' ? (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Protocolo</th>
                                <th>Imóvel</th>
                                <th>Data & Horário</th>
                                <th>Contato / Morador</th>
                                <th>Observações</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                                        Carregando agendamentos...
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
                                        <div className={styles.emptyState}>
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                <line x1="16" y1="2" x2="16" y2="6" />
                                                <line x1="8" y1="2" x2="8" y2="6" />
                                                <line x1="3" y1="10" x2="21" y2="10" />
                                            </svg>
                                            <p style={{ margin: 0, fontWeight: 600 }}>Nenhum agendamento encontrado.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : items.map(ag => (
                                <tr key={ag.protocolo}>
                                    <td>
                                        <span className={styles.protoBadge}>{ag.protocolo}</span>
                                    </td>
                                    <td>
                                        <div className={styles.imovelCell}>
                                            <span className={styles.imovelNumber}>
                                                Nº {ag.imovel?.numeroAInstalar || 'S/N'}
                                            </span>
                                            <span className={styles.inscBadge}>
                                                Insc: {ag.inscimobVinculo || '—'}
                                            </span>
                                            <span className={styles.imovelSub}>
                                                {ag.imovel?.bairro?.nome || 'Bairro'}
                                                {ag.imovel?.endereco ? ` • ${ag.imovel.endereco}` : ''}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.dateTimeCell}>
                                            <span className={styles.dateBold}>
                                                {ag.dataHora ? new Date(ag.dataHora).toLocaleDateString('pt-BR') : '—'}
                                            </span>
                                            <span className={styles.timeSub}>
                                                {ag.dataHora ? `${new Date(ag.dataHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <strong>{ag.nome || '—'}</strong><br />
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{ag.telefone || '—'}</span>
                                    </td>
                                    <td style={{ maxWidth: '200px' }}>
                                        <span style={{ fontSize: '0.82rem', color: '#475569', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {ag.observacao || ag.imovel?.obsPendente || '—'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`${styles.statusPill} ${styles['status' + (ag.status || 'AGENDADO')] || styles.statusAGENDADO}`}>
                                            {ag.status === 'AGENDADO' ? 'Agendado' :
                                             ag.status === 'CONCLUIDO' ? 'Concluído' :
                                             ag.status === 'CANCELADO' ? 'Cancelado' :
                                             ag.status === 'REAGENDAR' ? 'Reagendar' : ag.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.actionRow}>
                                            <button
                                                type="button"
                                                className={styles.editBtn}
                                                onClick={() => handleOpenEdit(ag)}
                                                title="Editar Agendamento"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                                <span>Editar</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.deleteBtn}
                                                onClick={() => handleExcluir(ag.protocolo)}
                                                title="Excluir Agendamento"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                                <span>Excluir</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Protocolo</th>
                                <th>Morador / Solicitante</th>
                                <th>Endereço Informado</th>
                                <th>Data do Pedido</th>
                                <th>Vínculo (Inscimob)</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                                        Carregando lista de contatos...
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <div className={styles.emptyState}>
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                <circle cx="9" cy="7" r="4" />
                                            </svg>
                                            <p style={{ margin: 0, fontWeight: 600 }}>Nenhum contato encontrado.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : items.map(ct => (
                                <tr key={ct.protocolo}>
                                    <td>
                                        <span className={styles.contactBadge}>{ct.protocolo}</span>
                                    </td>
                                    <td>
                                        <strong>{ct.nome}</strong><br />
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{ct.telefone || '—'}</span>
                                    </td>
                                    <td style={{ maxWidth: '280px' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#334155' }}>{ct.enderecoCompleto}</span>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                                            {new Date(ct.createdAt).toLocaleDateString('pt-BR')} às {new Date(ct.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </td>
                                    <td>
                                        {ct.inscimobVinculo ? (
                                            <span className={styles.inscBadge}>
                                                {ct.inscimobVinculo}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Não vinculado</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className={styles.actionRow}>
                                            {vinculando === ct.protocolo ? (
                                                <div className={styles.vincularForm}>
                                                    <input
                                                        type="text"
                                                        placeholder="Inscimob"
                                                        value={inscimobInput}
                                                        onChange={e => setInscimobInput(e.target.value)}
                                                        className={styles.miniInput}
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleVincular(ct.protocolo)} className={styles.vincBtn}>OK</button>
                                                    <button onClick={() => setVinculando(null)} className={styles.cancelMiniBtn}>X</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={styles.vincularTriggerBtn}
                                                        onClick={() => {
                                                            setVinculando(ct.protocolo);
                                                            setInscimobInput(ct.inscimobVinculo || '');
                                                        }}
                                                        title="Vincular a um Imóvel Oficial"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                                        </svg>
                                                        <span>{ct.inscimobVinculo ? 'Alterar' : 'Vincular'}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.editBtn}
                                                        onClick={() => handleOpenEdit(ct)}
                                                        title="Editar Dados"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                        <span>Editar</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.deleteBtn}
                                                        onClick={() => handleExcluir(ct.protocolo)}
                                                        title="Excluir Registro"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                        <span>Excluir</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* Modal de Edição de Agendamento / Contato */}
            {editingItem && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    Editar Agendamento ({editingItem.protocolo})
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                    {editingItem.inscimobVinculo
                                        ? `Imóvel vinculado: Insc. ${editingItem.inscimobVinculo}`
                                        : 'Registro da lista de contatos'}
                                </p>
                            </div>
                            <button
                                type="button"
                                className={styles.closeBtn}
                                onClick={() => setEditingItem(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className={styles.formGrid}>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                            <line x1="16" y1="2" x2="16" y2="6" />
                                            <line x1="8" y1="2" x2="8" y2="6" />
                                            <line x1="3" y1="10" x2="21" y2="10" />
                                        </svg>
                                        Data *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={editData}
                                        onChange={e => setEditData(e.target.value)}
                                        className={styles.formInput}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                        Horário *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={editHorario}
                                        onChange={e => setEditHorario(e.target.value)}
                                        className={styles.formInput}
                                    />
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                        Nome do Solicitante / Morador
                                    </label>
                                    <input
                                        type="text"
                                        value={editNome}
                                        onChange={e => setEditNome(e.target.value)}
                                        placeholder="Ex: João da Silva"
                                        className={styles.formInput}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M12 6v6l4 2" />
                                        </svg>
                                        Status
                                    </label>
                                    <select
                                        value={editStatus}
                                        onChange={e => setEditStatus(e.target.value)}
                                        className={styles.formSelect}
                                    >
                                        <option value="AGENDADO">Agendado</option>
                                        <option value="CONCLUIDO">Concluído</option>
                                        <option value="REAGENDAR">Reagendar</option>
                                        <option value="CANCELADO">Cancelado</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                    Telefone / WhatsApp
                                </label>
                                <input
                                    type="tel"
                                    value={editTelefone}
                                    onChange={e => setEditTelefone(e.target.value)}
                                    placeholder="(41) 99999-9999"
                                    className={styles.formInput}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="8" y1="6" x2="21" y2="6" />
                                        <line x1="8" y1="12" x2="21" y2="12" />
                                        <line x1="8" y1="18" x2="21" y2="18" />
                                        <line x1="3" y1="6" x2="3.01" y2="6" />
                                        <line x1="3" y1="12" x2="3.01" y2="12" />
                                        <line x1="3" y1="18" x2="3.01" y2="18" />
                                    </svg>
                                    Observações / Instruções para o Instalador
                                </label>
                                <textarea
                                    value={editObservacao}
                                    onChange={e => setEditObservacao(e.target.value)}
                                    placeholder="Ex: Instruções de acesso, detalhes sobre o morador..."
                                    className={styles.formTextarea}
                                />
                            </div>

                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.modalCancelBtn}
                                    onClick={() => setEditingItem(null)}
                                    disabled={savingEdit}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className={styles.modalSaveBtn}
                                    disabled={savingEdit}
                                >
                                    {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
