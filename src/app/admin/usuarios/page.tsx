'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function UsuariosPage() {
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'INSTALLER'
    });

    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchUsuarios();
    }, []);

    async function fetchUsuarios() {
        try {
            const res = await fetch('/api/admin/usuarios');
            const data = await res.json();
            setUsuarios(data.usuarios || []);
        } catch (e) {
            console.error("Erro ao buscar usuários");
        } finally {
            setLoading(false);
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const method = editingId ? 'PATCH' : 'POST';
            const url = editingId ? `/api/admin/usuarios/${editingId}` : '/api/admin/usuarios';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (res.ok) {
                alert(editingId ? "Usuário atualizado!" : "Usuário criado!");
                setIsAdding(false);
                setEditingId(null);
                setFormData({ name: '', email: '', password: '', role: 'INSTALLER' });
                fetchUsuarios();
            } else {
                alert(data.error || "Erro ao salvar usuário.");
            }
        } catch (e: any) {
            console.error("Erro no handleCreate:", e);
            alert("Erro de conexão ou erro interno ao salvar usuário.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este acesso?")) return;

        try {
            const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert("Usuário removido.");
                fetchUsuarios();
            }
        } catch (e) {
            alert("Erro ao excluir usuário.");
        }
    };

    const startEdit = (user: any) => {
        setEditingId(user.id);
        setFormData({
            name: user.name || '',
            email: user.email || '',
            password: '***', // Password won't be changed here for now
            role: user.role || 'INSTALLER'
        });
        setIsAdding(true);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Gestão de Usuários</h1>
                    <p>Gerencie quem tem acesso operacional e administrativo ao sistema.</p>
                </div>
                <button
                    className={styles.addButton}
                    onClick={() => {
                        setIsAdding(!isAdding);
                        if (editingId) {
                            setEditingId(null);
                            setFormData({ name: '', email: '', password: '', role: 'INSTALLER' });
                        }
                    }}
                >
                    {isAdding ? "Cancelar" : (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Novo Usuário
                        </>
                    )}
                </button>
            </header>

            {isAdding && (
                <section className={styles.formCard}>
                    <h3>{editingId ? "Editar Usuário" : "Cadastrar Novo Membro"}</h3>
                    <form onSubmit={handleCreate} className={styles.form}>
                        <div className={styles.row}>
                            <div className={styles.formGroup}>
                                <label>Nome</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    disabled={!!editingId} // Email não muda no Supabase Auth facilmente
                                />
                            </div>
                        </div>
                        <div className={styles.row}>
                            {!editingId && (
                                <div className={styles.formGroup}>
                                    <label>Senha Inicial</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        required
                                    />
                                </div>
                            )}
                            <div className={styles.formGroup}>
                                <label>Papel no Sistema</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="INSTALLER">Instalador</option>
                                    <option value="PREFEITURA">Operador Prefeitura</option>
                                    <option value="OPERATOR">Operador (Admin Parcial)</option>
                                    <option value="ADMIN">Administrador Geral</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" className={styles.submitButton}>
                            {editingId ? "Salvar Alterações" : "Salvar Usuário"}
                        </button>
                    </form>
                </section>
            )}

            <section className={styles.listCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Papel</th>
                            <th>Status Admin</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5}>Carregando...</td></tr>
                        ) : usuarios.map(user => (
                            <tr key={user.id}>
                                <td><strong>{user.name}</strong></td>
                                <td>{user.email}</td>
                                <td><span className={`${styles.badge} ${styles[user.role]}`}>{user.role}</span></td>
                                <td>{user.id.includes('@') ? '⚠️ Local' : '✅ Auth'}</td>
                                <td className={styles.actions}>
                                    <button onClick={() => startEdit(user)} className={styles.editBtn}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button onClick={() => handleDelete(user.id)} className={styles.deleteBtn}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
