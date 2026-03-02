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

            if (res.ok) {
                alert(editingId ? "Usuário atualizado!" : "Usuário criado!");
                setIsAdding(false);
                setEditingId(null);
                setFormData({ name: '', email: '', password: '', role: 'INSTALLER' });
                fetchUsuarios();
            }
        } catch (e) {
            alert("Erro ao salvar usuário.");
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
                    {isAdding ? "Cancelar" : "+ Novo Usuário"}
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
                                    <button onClick={() => startEdit(user)} className={styles.editBtn}>✏️</button>
                                    <button onClick={() => handleDelete(user.id)} className={styles.deleteBtn}>🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
