'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, Loader2, MapPinned, RotateCcw, Trash2 } from 'lucide-react';
import ui from '../admin.module.css';
import { toast } from '@/utils/toast';
import { formatBrazil } from '@/lib/timezone';

export default function BairrosPage() {
    const [bairros, setBairros] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [statusId, setStatusId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const [resProfile, res] = await Promise.all([
                    fetch('/api/auth/me'),
                    fetch('/api/admin/bairros')
                ]);
                if (resProfile.ok) {
                    const profileData = await resProfile.json();
                    setRole(profileData.user?.role || null);
                }
                const data = await res.json();
                setBairros(data.bairros || []);
            } catch {
                toast.error('Erro ao carregar os bairros.');
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleToggleVisibility = async (id: string, currentStatus: boolean) => {
        // Atualização otimista: reverte em caso de erro
        setBairros(prev => prev.map(b => b.id === id ? { ...b, visivelInstalacao: !currentStatus } : b));
        try {
            const res = await fetch(`/api/admin/bairros/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visivelInstalacao: !currentStatus })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Erro ao salvar visibilidade');
            }
            toast.success(!currentStatus ? 'Bairro visível para os instaladores.' : 'Bairro oculto para os instaladores.');
        } catch (e: any) {
            setBairros(prev => prev.map(b => b.id === id ? { ...b, visivelInstalacao: currentStatus } : b));
            toast.error(e.message || 'Erro ao se conectar ao servidor.');
        }
    };

    // Concluir: o bairro conta como finalizado mesmo com imóveis que não serão instalados
    const handleStatus = async (b: any) => {
        const concluir = b.status !== 'CONCLUIDO';
        const msg = concluir
            ? `Marcar o bairro "${b.nome}" como concluído?\n\nOs imóveis que ainda não foram instalados passam a contar como "não serão instalados" no painel da prefeitura e saem da previsão de estoque.`
            : `Reabrir o bairro "${b.nome}"? Os imóveis sem instalação voltam a contar como restantes.`;
        if (!confirm(msg)) return;
        setStatusId(b.id);
        try {
            const res = await fetch(`/api/admin/bairros/${b.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: concluir ? 'CONCLUIDO' : 'ATIVO' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Erro ao atualizar o bairro');
            setBairros(prev => prev.map(item => item.id === b.id ? { ...item, status: data.bairro.status } : item));
            toast.success(concluir ? `Bairro "${b.nome}" concluído.` : `Bairro "${b.nome}" reaberto.`);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setStatusId(null);
        }
    };

    const handleDelete = async (b: any) => {
        if (!confirm(`Excluir o bairro "${b.nome}" e todos os seus ${b._count.imoveis} imóveis?\n\nEsta ação não pode ser desfeita.`)) return;
        setDeletingId(b.id);
        try {
            const res = await fetch(`/api/admin/bairros/${b.id}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Erro ao excluir bairro');
            setBairros(prev => prev.filter(item => item.id !== b.id));
            toast.success(`Bairro "${b.nome}" excluído.`);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setDeletingId(null);
        }
    };

    const isAdmin = role === 'ADMIN';

    return (
        <div className={ui.container}>
            <header className={ui.header}>
                <div>
                    <h1>Bairros e Lotes</h1>
                    <p>Lotes de imóveis importados da prefeitura e sua visibilidade para a equipe de campo.</p>
                </div>
            </header>

            <section className={ui.card}>
                <div className={ui.tableWrap}>
                    <table className={ui.table}>
                        <thead>
                            <tr>
                                <th>Bairro</th>
                                <th>Importado em</th>
                                <th>Imóveis</th>
                                <th>Visível p/ instalador</th>
                                <th><span className="sr-only">Ações</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5}><div className={ui.emptyState}><Loader2 className="spin" /> Carregando...</div></td></tr>
                            ) : bairros.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <div className={ui.emptyState}>
                                            <MapPinned size={40} />
                                            <strong>Nenhum bairro importado</strong>
                                            {isAdmin && <Link href="/admin/importar" className={ui.btnPrimary}>Importar planilha</Link>}
                                        </div>
                                    </td>
                                </tr>
                            ) : bairros.map(b => (
                                <tr key={b.id}>
                                    <td>
                                        <strong>{b.nome}</strong>
                                        <span className={ui.cellSub}>
                                            {b.status === 'CONCLUIDO' ? <span className={`${ui.badge} ${ui.OPERATOR}`}>Concluído</span> : b.status === 'ATIVO' ? 'Em andamento' : b.status}
                                        </span>
                                    </td>
                                    <td>{formatBrazil(b.dataImportacao)}</td>
                                    <td>{b._count.imoveis.toLocaleString('pt-BR')}</td>
                                    <td>
                                        <label className={ui.switch}>
                                            <input
                                                type="checkbox"
                                                role="switch"
                                                aria-label={`Visível para instaladores: ${b.nome}`}
                                                checked={b.visivelInstalacao ?? true}
                                                onChange={() => handleToggleVisibility(b.id, b.visivelInstalacao ?? true)}
                                            />
                                            <span className={ui.slider}></span>
                                        </label>
                                    </td>
                                    <td>
                                        <div className={ui.actions}>
                                            <Link href={`/admin/bairros/${b.id}`} className={ui.btnSecondary}>
                                                Ver imóveis <ChevronRight size={16} />
                                            </Link>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleStatus(b)}
                                                    className={ui.btnSecondary}
                                                    disabled={statusId === b.id}
                                                    title={b.status === 'CONCLUIDO' ? 'Reabrir bairro' : 'Marcar bairro como concluído'}
                                                >
                                                    {statusId === b.id
                                                        ? <Loader2 size={16} className="spin" />
                                                        : b.status === 'CONCLUIDO' ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
                                                    {b.status === 'CONCLUIDO' ? 'Reabrir' : 'Concluir bairro'}
                                                </button>
                                            )}
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleDelete(b)}
                                                    className={ui.iconBtnDanger}
                                                    disabled={deletingId === b.id}
                                                    aria-label={`Excluir bairro ${b.nome}`}
                                                    title="Excluir bairro"
                                                >
                                                    {deletingId === b.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
