'use client';

import { useState, useEffect } from 'react';
import { Loader2, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import ui from '../admin.module.css';
import { toast } from '@/utils/toast';

const ROLES = [
    { value: 'INSTALLER', label: 'Instalador', desc: 'Executa instalações em campo pelo celular' },
    { value: 'PREFEITURA', label: 'Operador Prefeitura', desc: 'Libera imóveis e agenda instalações' },
    { value: 'PAINEL_PREFEITURA', label: 'Painel Prefeitura', desc: 'Somente leitura: acompanha indicadores e baixa relatórios' },
    { value: 'OPERATOR', label: 'Operador', desc: 'Acompanha o painel, sem funções administrativas' },
    { value: 'ADMIN', label: 'Administrador', desc: 'Acesso total, incluindo usuários e importação' },
];
const roleLabel = (role: string) => ROLES.find(r => r.value === role)?.label || role;

const EMPTY_FORM = { name: '', email: '', password: '', role: 'INSTALLER' };

export default function UsuariosPage() {
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchUsuarios();
    }, []);

    async function fetchUsuarios() {
        try {
            const res = await fetch('/api/admin/usuarios');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setUsuarios(data.usuarios || []);
        } catch (e: any) {
            toast.error(e.message || 'Erro ao buscar usuários.');
        } finally {
            setLoading(false);
        }
    }

    const openCreate = () => {
        setEditingId(null);
        setFormData(EMPTY_FORM);
        setIsFormOpen(true);
    };

    const startEdit = (user: any) => {
        setEditingId(user.id);
        setFormData({ name: user.name || '', email: user.email || '', password: '', role: user.role || 'INSTALLER' });
        setIsFormOpen(true);
    };

    const closeForm = () => {
        if (saving) return;
        setIsFormOpen(false);
        setEditingId(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const url = editingId ? `/api/admin/usuarios/${editingId}` : '/api/admin/usuarios';
            const body = editingId
                ? { name: formData.name, role: formData.role, ...(formData.password ? { password: formData.password } : {}) }
                : formData;

            const res = await fetch(url, {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao salvar usuário.');

            toast.success(editingId ? 'Usuário atualizado.' : 'Usuário criado.');
            setIsFormOpen(false);
            setEditingId(null);
            fetchUsuarios();
        } catch (e: any) {
            toast.error(e.message || 'Erro de conexão ao salvar usuário.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (user: any) => {
        if (!confirm(`Remover o acesso de ${user.name || user.email}?`)) return;
        try {
            const res = await fetch(`/api/admin/usuarios/${user.id}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Erro ao excluir usuário.');
            toast.success('Acesso removido.');
            setUsuarios(prev => prev.filter(u => u.id !== user.id));
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    return (
        <div className={ui.container}>
            <header className={ui.header}>
                <div>
                    <h1>Equipe e Acessos</h1>
                    <p>Gerencie quem tem acesso operacional e administrativo ao sistema.</p>
                </div>
                <div className={ui.headerActions}>
                    <button className={ui.btnPrimary} onClick={openCreate}>
                        <Plus size={18} /> Novo usuário
                    </button>
                </div>
            </header>

            <section className={ui.card}>
                <div className={ui.tableWrap}>
                    <table className={ui.table}>
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>E-mail</th>
                                <th>Papel</th>
                                <th><span className="sr-only">Ações</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4}><div className={ui.emptyState}><Loader2 className="spin" /> Carregando...</div></td></tr>
                            ) : usuarios.length === 0 ? (
                                <tr><td colSpan={4}><div className={ui.emptyState}><Users size={40} /><strong>Nenhum usuário cadastrado</strong></div></td></tr>
                            ) : usuarios.map(user => (
                                <tr key={user.id}>
                                    <td>
                                        <strong>{user.name || '—'}</strong>
                                        {user.id.includes('@') && <span className={ui.cellSub}>Sem login no Supabase (cadastro antigo)</span>}
                                    </td>
                                    <td>{user.email}</td>
                                    <td><span className={`${ui.badge} ${ui[user.role] || ''}`}>{roleLabel(user.role)}</span></td>
                                    <td>
                                        <div className={ui.actions}>
                                            <button onClick={() => startEdit(user)} className={ui.iconBtn} aria-label={`Editar ${user.name || user.email}`} title="Editar">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(user)} className={ui.iconBtnDanger} aria-label={`Excluir ${user.name || user.email}`} title="Excluir">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {isFormOpen && (
                <div className={ui.modalOverlay} onClick={closeForm}>
                    <div className={ui.modal} role="dialog" aria-modal="true" aria-labelledby="user-form-title" onClick={e => e.stopPropagation()}>
                        <div className={ui.modalHeader}>
                            <div>
                                <h3 id="user-form-title">{editingId ? 'Editar usuário' : 'Novo usuário'}</h3>
                                <p className={ui.cardSubtitle}>{editingId ? formData.email : 'O acesso é criado já confirmado.'}</p>
                            </div>
                            <button type="button" className={ui.iconBtn} onClick={closeForm} aria-label="Fechar"><X size={18} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className={ui.form}>
                            <div className={ui.field}>
                                <label htmlFor="user-name">Nome</label>
                                <input id="user-name" type="text" autoComplete="off" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            {!editingId && (
                                <div className={ui.field}>
                                    <label htmlFor="user-email">E-mail</label>
                                    <input id="user-email" type="email" autoComplete="off" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                                </div>
                            )}
                            <div className={ui.field}>
                                <label htmlFor="user-password">{editingId ? 'Nova senha (opcional)' : 'Senha inicial'}</label>
                                <input
                                    id="user-password"
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={6}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    required={!editingId}
                                    placeholder={editingId ? 'Deixe em branco para manter a atual' : ''}
                                />
                                <span className={ui.hint}>Mínimo de 6 caracteres.</span>
                            </div>
                            <div className={ui.field}>
                                <label htmlFor="user-role">Papel no sistema</label>
                                <select id="user-role" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                                <span className={ui.hint}>{ROLES.find(r => r.value === formData.role)?.desc}</span>
                            </div>
                            <div className={ui.formActions}>
                                <button type="button" className={ui.btnGhost} onClick={closeForm} disabled={saving}>Cancelar</button>
                                <button type="submit" className={ui.btnPrimary} disabled={saving}>
                                    {saving && <Loader2 size={16} className="spin" />}
                                    {editingId ? 'Salvar alterações' : 'Criar usuário'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
