'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Home, Loader2, Search } from 'lucide-react';
import ui from '../../admin.module.css';
import { statusLabel, STATUS_LABELS } from '@/utils/status';
import { formatBrazil } from '@/lib/timezone';

export default function BairroDetalhesPage() {
    const { id } = useParams();
    const [bairro, setBairro] = useState<{ nome: string } | null>(null);
    const [imoveis, setImoveis] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        async function fetchImoveis() {
            try {
                const res = await fetch(`/api/admin/bairros/${id}/imoveis`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                setBairro(data.bairro);
                // Ordenação natural: 2, 10, 100 (o banco ordena como texto: 10, 100, 2)
                const collator = new Intl.Collator('pt-BR', { numeric: true });
                setImoveis((data.imoveis || []).sort((a: any, b: any) => collator.compare(a.numeroAInstalar || '', b.numeroAInstalar || '')));
            } catch (e: any) {
                setError(e.message || 'Erro ao carregar os imóveis.');
            } finally {
                setLoading(false);
            }
        }
        fetchImoveis();
    }, [id]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return imoveis.filter(im =>
            (!statusFilter || im.status === statusFilter) &&
            (!q || im.inscimob.toLowerCase().includes(q) || im.numeroAInstalar?.toLowerCase().includes(q) || im.endereco?.toLowerCase().includes(q))
        );
    }, [imoveis, search, statusFilter]);

    const concluidos = imoveis.filter(i => i.status === 'CONCLUIDO').length;

    return (
        <div className={ui.container}>
            <header className={ui.header}>
                <div>
                    <Link href="/admin/bairros" className={ui.backLink}><ArrowLeft size={16} /> Bairros</Link>
                    <h1>{bairro?.nome || 'Detalhes do Lote'}</h1>
                    <p>
                        {loading ? 'Carregando...' : `${imoveis.length.toLocaleString('pt-BR')} imóveis • ${concluidos.toLocaleString('pt-BR')} concluídos`}
                    </p>
                </div>
            </header>

            <div className={ui.toolbar}>
                <label className={ui.searchBox}>
                    <Search size={16} aria-hidden />
                    <span className="sr-only">Buscar</span>
                    <input
                        type="search"
                        placeholder="Buscar por inscrição, número ou endereço..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </label>
                <select className={ui.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtrar por status">
                    <option value="">Todos os status</option>
                    {['NAO_INICIADO', 'LIBERADO', 'AGENDADO', 'AUSENTE', 'PENDENTE', 'CONCLUIDO'].map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                </select>
            </div>

            <section className={ui.card}>
                <div className={ui.tableWrap}>
                    <table className={ui.table}>
                        <thead>
                            <tr>
                                <th>Inscrição</th>
                                <th>Nº a instalar</th>
                                <th>Endereço</th>
                                <th>Status</th>
                                <th>Execução</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5}><div className={ui.emptyState}><Loader2 className="spin" /> Carregando imóveis...</div></td></tr>
                            ) : error ? (
                                <tr><td colSpan={5}><div className={ui.emptyState}><strong>{error}</strong></div></td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={5}><div className={ui.emptyState}><Home size={40} /><strong>Nenhum imóvel encontrado</strong></div></td></tr>
                            ) : filtered.map(im => (
                                <tr key={im.inscimob}>
                                    <td className={ui.mono}>{im.inscimob}</td>
                                    <td>
                                        <strong>{im.numeroAInstalar || 'S/N'}</strong>
                                        {im._count?.complementos > 0 && <span className={ui.cellSub}>+{im._count.complementos} complementos</span>}
                                    </td>
                                    <td>{im.endereco || '—'}</td>
                                    <td><span className={`${ui.badge} ${ui[im.status] || ''}`}>{statusLabel(im.status)}</span></td>
                                    <td>
                                        {im.dataExecucao ? formatBrazil(im.dataExecucao) : '—'}
                                        {im.instaladorResp && <span className={ui.cellSub}>{im.instaladorResp}</span>}
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
