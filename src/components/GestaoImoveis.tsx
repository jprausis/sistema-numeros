'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import styles from './gestaoImoveis.module.css';
import * as XLSX from 'xlsx';
import { Download, Loader2, MapPin, Navigation, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from '@/utils/toast';
import { parseFotos, limparLinksImagens, temFotosReais, fotoDestaque } from '@/utils/fotos';
import { statusLabel } from '@/utils/status';
import { formatBrazil, todayBrazil } from '@/lib/timezone';
import { MOTIVOS_PENDENCIA } from '@/lib/motivosPendencia';
import type { InstaladorLocalizacao } from '@/components/InstallerMap';
import ImovelInfoModal from '@/components/ImovelInfoModal';
import { useDialog } from '@/utils/useDialog';

const PAGE_SIZE = 100;

const InstallerMap = dynamic(() => import('@/components/InstallerMap'), {
    ssr: false,
    loading: () => <div className={styles.loader}>Preparando Mapa...</div>
});

interface Props {
    /** Mostra no mapa a posição dos instaladores (só no painel administrativo). */
    mostrarInstaladores?: boolean;
    /** "prefeitura": tela de consulta do Painel Prefeitura (título e textos próprios). */
    modo?: 'admin' | 'prefeitura';
}

// Perfis que podem cadastrar imóvel (mesma regra do botão "Novo imóvel")
const PODE_CADASTRAR = ['ADMIN', 'OPERATOR', 'PREFEITURA'];

export default function GestaoImoveis({ mostrarInstaladores = false, modo = 'admin' }: Props) {
    const [imoveis, setImoveis] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [saving, setSaving] = useState(false);
    const [view, setView] = useState<'table' | 'map'>('table');
    const [selectedImovel, setSelectedImovel] = useState<any | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);
    const [instaladores, setInstaladores] = useState<InstaladorLocalizacao[]>([]);
    // Ficha somente leitura para quem não edita (operador, painel da prefeitura)
    const [fichaImovel, setFichaImovel] = useState<any | null>(null);
    
    // Novo estado para cadastro de imóvel
    const [isCreating, setIsCreating] = useState(false);
    const [newImovelData, setNewImovelData] = useState({
        inscimob: '',
        x: '',
        y: '',
        numeroAInstalar: '',
        bairroId: '',
        endereco: ''
    });

    const [bairros, setBairros] = useState<any[]>([]);
    const [bairroFilter, setBairroFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [motivoFilter, setMotivoFilter] = useState('');

    async function fetchImoveis() {
        try {
            const [resImoveis, resBairros] = await Promise.all([
                fetch('/api/admin/imoveis'),
                fetch('/api/admin/bairros')
            ]);

            const dataImoveis = await resImoveis.json();
            const dataBairros = await resBairros.json();
            if (!resImoveis.ok) throw new Error(dataImoveis.error);

            setImoveis(dataImoveis.imoveis || []);
            setBairros(dataBairros.bairros || []);
        } catch (e: any) {
            toast.error(e?.message || "Erro ao carregar os imóveis.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const checkUser = async () => {
            try {
                const resProfile = await fetch('/api/auth/me');
                if (resProfile.ok) {
                    const profileData = await resProfile.json();
                    setRole(profileData.user?.role || null);
                    setUser(profileData.user);
                    // Atalho ?cadastrar=true (dashboard do admin) só abre o cadastro para quem pode cadastrar
                    const query = new URLSearchParams(window.location.search);
                    if (query.get('cadastrar') === 'true' && PODE_CADASTRAR.includes(profileData.user?.role)) {
                        setIsCreating(true);
                    }
                }
            } catch (error) {
                console.error("Erro ao verificar usuário:", error);
            }
        };
        checkUser();
        fetchImoveis();
    }, []);

    const editDialogRef = useDialog(editMode && !!selectedImovel, () => { if (!saving) setEditMode(false); });
    const createDialogRef = useDialog(isCreating, () => setIsCreating(false));

    const verInstaladores = mostrarInstaladores && (role === 'ADMIN' || role === 'OPERATOR');

    // Posição dos instaladores (registrada pelo app) enquanto o mapa estiver aberto
    useEffect(() => {
        // Posição da equipe é visível só para a gestão interna
        if (view !== 'map' || !verInstaladores) return;
        let ativo = true;
        const carregar = () => fetch('/api/admin/localizacoes')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (ativo && data) setInstaladores(data.localizacoes || []); })
            .catch(() => {});
        carregar();
        const timer = setInterval(carregar, 60000);
        return () => { ativo = false; clearInterval(timer); };
    }, [view, verInstaladores]);

    const isAdmin = role === 'ADMIN';

    const handleDeletePhoto = async () => {
        if (!selectedImovel || !window.confirm("Tem certeza que deseja excluir esta foto?")) return;

        try {
            const res = await fetch(`/api/admin/imoveis/${selectedImovel.inscimob}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fotos: null })
            });

            if (!res.ok) throw new Error();
            setSelectedImovel({ ...selectedImovel, fotos: null });
            toast.success("Foto excluída.");
            fetchImoveis();
        } catch (e) {
            toast.error("Erro ao excluir foto.");
        }
    };

    const handleDeleteCompPhoto = async (compId: string) => {
        if (!selectedImovel || !window.confirm("Tem certeza que deseja excluir a foto deste complemento?")) return;

        try {
            const res = await fetch('/api/instalador/complemento/atualizar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: compId, fotos: null })
            });

            if (res.ok) {
                const updatedComps = selectedImovel.complementos.map((c: any) => {
                    if (c.id === compId) {
                        return { ...c, fotos: null };
                    }
                    return c;
                });
                setSelectedImovel({ ...selectedImovel, complementos: updatedComps });
                fetchImoveis();
            } else {
                toast.error("Erro ao excluir foto do complemento.");
            }
        } catch (e) {
            toast.error("Erro ao excluir foto do complemento.");
        }
    };

    const handleUploadCompPhoto = async (compId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedImovel) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', selectedImovel.bairro?.nome || 'geral');

        try {
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadRes.ok) throw new Error("Falha no upload");
            toast.info("Foto enviada, salvando...");

            const uploadData = await uploadRes.json();
            const photoUrl = uploadData.url;

            const res = await fetch('/api/instalador/complemento/atualizar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: compId, fotos: [photoUrl] })
            });

            if (res.ok) {
                const updatedComps = selectedImovel.complementos.map((c: any) => {
                    if (c.id === compId) {
                        return { ...c, fotos: JSON.stringify([photoUrl]) };
                    }
                    return c;
                });
                setSelectedImovel({ ...selectedImovel, complementos: updatedComps });
                fetchImoveis();
            } else {
                toast.error("Erro ao enviar foto do complemento.");
            }
        } catch (err) {
            toast.error("Erro ao enviar foto do complemento.");
        }
    };

    const handleUpdateCompStatus = async (compId: string, newStatus: string) => {
        if (!selectedImovel) return;

        try {
            const res = await fetch('/api/instalador/complemento/atualizar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: compId, status: newStatus })
            });

            if (res.ok) {
                const updatedComps = selectedImovel.complementos.map((c: any) => {
                    if (c.id === compId) {
                        return { ...c, status: newStatus };
                    }
                    return c;
                });
                setSelectedImovel({ ...selectedImovel, complementos: updatedComps });
                fetchImoveis();
            } else {
                toast.error("Erro ao atualizar status do complemento.");
            }
        } catch (e) {
            toast.error("Erro ao atualizar status do complemento.");
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedImovel) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/admin/imoveis/${selectedImovel.inscimob}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: selectedImovel.status,
                    obsPendente: selectedImovel.obsPendente,
                    numeroAInstalar: selectedImovel.numeroAInstalar,
                    instaladorResp: user?.name || user?.email
                })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Erro ao atualizar.");
            toast.success("Imóvel atualizado.");
            setEditMode(false);
            fetchImoveis();
        } catch (e: any) {
            toast.error(e.message || "Erro ao atualizar.");
        } finally {
            setSaving(false);
        }
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocalização não é suportada por este navegador.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setNewImovelData(prev => ({
                    ...prev,
                    x: position.coords.latitude.toString(),
                    y: position.coords.longitude.toString()
                }));
            },
            (error) => {
                console.error("Erro ao obter localização:", error);
                toast.error("Não foi possível obter a localização. Verifique a permissão de GPS.");
            },
            { enableHighAccuracy: true }
        );
    };

    const handleCreateImovel = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/admin/imoveis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inscimob: newImovelData.inscimob,
                    x: parseFloat(newImovelData.x),
                    y: parseFloat(newImovelData.y),
                    numeroAInstalar: newImovelData.numeroAInstalar,
                    bairroId: newImovelData.bairroId,
                    endereco: newImovelData.endereco || undefined
                })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("Imóvel cadastrado.");
                setIsCreating(false);
                setNewImovelData({
                    inscimob: '',
                    x: '',
                    y: '',
                    numeroAInstalar: '',
                    bairroId: '',
                    endereco: ''
                });
                fetchImoveis();
            } else {
                toast.error(data.error || "Erro ao cadastrar imóvel.");
            }
        } catch (err) {
            console.error("Erro ao cadastrar imóvel:", err);
            toast.error("Erro de conexão ao cadastrar imóvel.");
        }
    };

    const handleExport = () => {
        const dataToExport: any[] = [];

        filtered.forEach((i: any) => {
            // Imóvel Principal
            dataToExport.push({
                'Inscimob': i.inscimob,
                'Bairro': i.bairro?.nome || '',
                'Número': i.numeroAInstalar || '',
                'Status': i.status,
                'Instalador': i.instaladorResp || '',
                'Foto Orientação': limparLinksImagens(i.fotoLocalInstalacao) || 'Nenhuma',
                'Foto Instalação': limparLinksImagens(i.fotos) || 'Nenhuma',
                'Motivo Pendência': i.status === 'PENDENTE' ? (i.motivoPendencia || '') : '',
                'Observações': (i.status === 'CONCLUIDO' ? i.obsInstalacao : i.obsPendente) || '',
                'Data Execução': i.dataExecucao ? formatBrazil(i.dataExecucao) : 'N/A',
                'Tipo': 'Principal'
            });

            // Complementos do Imóvel
            if (i.complementos && i.complementos.length > 0) {
                i.complementos.forEach((c: any) => {
                    const cConcluido = c.status === "CONCLUIDO" && temFotosReais(c.fotos);
                    const statusText = cConcluido ? "CONCLUIDO" : (c.status === "CONCLUIDO" ? "PENDENTE" : c.status);
                    const instaladorName = cConcluido ? (i.instaladorResp || '') : '';
                    dataToExport.push({
                        'Inscimob': c.inscimob,
                        'Bairro': i.bairro?.nome || '',
                        'Número': `${i.numeroAInstalar || ''} - ${c.numeroPredial}`,
                        'Status': statusText,
                        'Instalador': instaladorName,
                        'Foto Orientação': limparLinksImagens(c.fotoLocalInstalacao) || 'Nenhuma',
                        'Foto Instalação': limparLinksImagens(c.fotos) || 'Nenhuma',
                        'Motivo Pendência': '',
                        'Observações': '',
                        'Data Execução': c.dataExecucao ? formatBrazil(c.dataExecucao) : 'N/A',
                        'Tipo': 'Complemento'
                    });
                });
            }
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Imoveis");
        XLSX.writeFile(wb, `Relatorio_Instalacoes_${todayBrazil()}.xlsx`);
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return imoveis.filter(i => {
            const matchesSearch = !q || i.inscimob.toLowerCase().includes(q) || i.numeroAInstalar?.toLowerCase().includes(q) || i.endereco?.toLowerCase().includes(q);
            const matchesBairro = bairroFilter === '' || i.bairroId === bairroFilter;
            const matchesStatus = statusFilter === '' || i.status === statusFilter;
            const matchesMotivo = motivoFilter === '' || (i.status === 'PENDENTE' && (motivoFilter === 'SEM_MOTIVO' ? !i.motivoPendencia : i.motivoPendencia === motivoFilter));
            return matchesSearch && matchesBairro && matchesStatus && matchesMotivo;
        });
    }, [imoveis, search, bairroFilter, statusFilter, motivoFilter]);

    // Volta para a primeira "página" quando os filtros mudam
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [search, bairroFilter, statusFilter, motivoFilter]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>{modo === 'prefeitura' ? 'Imóveis' : 'Gestão de imóveis'}</h1>
                    <p>{modo === 'prefeitura'
                        ? 'Consulte a situação, as fotos e a localização de cada imóvel.'
                        : 'Controle total sobre os números instalados e pendências.'}</p>
                </div>
                <div className={styles.headerActions}>
                    {role && PODE_CADASTRAR.includes(role) && (
                        <button onClick={() => setIsCreating(true)} className={styles.primaryBtn}>
                            <Plus size={18} /> Novo imóvel
                        </button>
                    )}
                    <button onClick={handleExport} className={styles.exportBtn} disabled={filtered.length === 0}>
                        <Download size={16} /> Baixar planilha
                    </button>

                    <select
                        className={styles.filterSelect}
                        aria-label="Filtrar por bairro"
                        value={bairroFilter}
                        onChange={e => setBairroFilter(e.target.value)}
                    >
                        <option value="">Todos os bairros</option>
                        {bairros.map(b => (
                            <option key={b.id} value={b.id}>{b.nome}</option>
                        ))}
                    </select>

                    <select
                        className={styles.filterSelect}
                        aria-label="Filtrar por situação"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="">Todas as situações</option>
                        <option value="NAO_INICIADO">Não iniciado</option>
                        <option value="LIBERADO">Liberado</option>
                        <option value="AUSENTE">Ausente</option>
                        <option value="PENDENTE">Pendente</option>
                        <option value="AGENDADO">Agendado</option>
                        <option value="CONCLUIDO">Concluído</option>
                    </select>

                    <select
                        className={styles.filterSelect}
                        aria-label="Filtrar por motivo da pendência"
                        value={motivoFilter}
                        onChange={e => setMotivoFilter(e.target.value)}
                    >
                        <option value="">Todos os motivos</option>
                        {MOTIVOS_PENDENCIA.map(m => <option key={m} value={m}>{m}</option>)}
                        <option value="SEM_MOTIVO">Pendente sem motivo</option>
                    </select>

                    <div className={styles.viewToggle} role="group" aria-label="Forma de exibição">
                        <button
                            type="button"
                            aria-pressed={view === 'table'}
                            className={view === 'table' ? styles.activeToggle : ''}
                            onClick={() => setView('table')}
                        >
                            Lista
                        </button>
                        <button
                            type="button"
                            aria-pressed={view === 'map'}
                            className={view === 'map' ? styles.activeToggle : ''}
                            onClick={() => { setView('map'); setMapFocus(null); }}
                        >
                            Mapa
                        </button>
                    </div>
                </div>
            </header>

            <div className={styles.searchWrapper}>
                <Search size={18} className={styles.searchIcon} aria-hidden />
                <input
                    type="search"
                    aria-label="Buscar imóveis"
                    placeholder="Buscar por inscrição, número ou endereço..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className={styles.searchBar}
                />
                <span className={styles.resultCount}>{loading ? '' : `${filtered.length.toLocaleString('pt-BR')} imóveis`}</span>
            </div>

            {view === 'map' ? (
                <div className={styles.mapContainer}>
                    <InstallerMap
                        properties={filtered}
                        focusOn={mapFocus}
                        instaladores={verInstaladores ? instaladores : undefined}
                        onEdit={isAdmin ? (i) => {
                            setSelectedImovel(i);
                            setEditMode(true);
                        } : undefined}
                    />
                </div>
            ) : (
                <section className={styles.listCard}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Foto</th>
                                <th>Inscimob</th>
                                <th>Bairro</th>
                                <th>Número</th>
                                <th>Comp.</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className={styles.emptyCell}><Loader2 size={20} className="spin" /> Carregando imóveis...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className={styles.emptyCell}>Nenhum imóvel encontrado com os filtros atuais.</td></tr>
                            ) : filtered.slice(0, visibleCount).map(i => {
                                const destaque = fotoDestaque(i);
                                return (
                                <tr key={i.inscimob}>
                                    <td>
                                        {destaque ? (
                                            <a className={styles.tableThumb} href={destaque.url} target="_blank" rel="noopener noreferrer" title={`Abrir foto de ${destaque.tipo.toLowerCase()}`}>
                                                <img src={destaque.url} alt={`Foto de ${destaque.tipo.toLowerCase()} do imóvel ${i.numeroAInstalar}`} loading="lazy" />
                                                <span className={styles.photoBadge}>{destaque.tipo}</span>
                                            </a>
                                        ) : (
                                            <span className={styles.noPhoto}>Sem foto</span>
                                        )}
                                    </td>
                                    <td><strong>{i.inscimob}</strong></td>
                                    <td>{i.bairro?.nome}</td>
                                    <td>{i.numeroAInstalar}</td>
                                    <td>
                                        {i.complementos?.length > 0 ? (
                                            <span className={styles.compBadge}>{i.complementos.length} unidades</span>
                                        ) : '-'}
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${styles[i.status]}`}>
                                            {statusLabel(i.status)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.actions}>
                                            <button
                                                className={styles.locateBtn}
                                                title="Ver no Mapa"
                                                aria-label={`Ver imóvel ${i.numeroAInstalar} no mapa`}
                                                onClick={() => {
                                                    setMapFocus([i.x, i.y]);
                                                    setView('map');
                                                }}
                                            >
                                                <MapPin size={18} />
                                            </button>
                                            {isAdmin ? (
                                                <button
                                                    className={styles.editBtn}
                                                    onClick={() => {
                                                        setSelectedImovel(i);
                                                        setEditMode(true);
                                                    }}
                                                >
                                                    Editar
                                                </button>
                                            ) : (
                                                <button className={styles.editBtn} onClick={() => setFichaImovel(i)}>
                                                    Ver ficha
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {!loading && filtered.length > visibleCount && (
                        <div className={styles.loadMore}>
                            <span>Exibindo {visibleCount.toLocaleString('pt-BR')} de {filtered.length.toLocaleString('pt-BR')}</span>
                            <button type="button" className={styles.exportBtn} onClick={() => setVisibleCount(c => c + PAGE_SIZE * 2)}>
                                Carregar mais
                            </button>
                        </div>
                    )}
                </section>
            )}

            {editMode && selectedImovel && (
                <div className={styles.modalOverlay} onClick={() => !saving && setEditMode(false)}>
                    <div ref={editDialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="edit-imovel-title" onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHead}>
                            <div>
                                <h3 id="edit-imovel-title">Editar imóvel Nº {selectedImovel.numeroAInstalar}</h3>
                                <p>Inscrição {selectedImovel.inscimob} • {selectedImovel.bairro?.nome}</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setEditMode(false)} aria-label="Fechar"><X size={18} /></button>
                        </div>

                        <form onSubmit={handleUpdate} className={styles.form}>
                            {selectedImovel.fotos && (
                                <div className={styles.modalPhotoArea}>
                                    <div className={styles.photoHeader}>
                                        <label>Foto da Instalação:</label>
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                className={styles.deletePhotoBtn}
                                                onClick={handleDeletePhoto}
                                            >
                                                <Trash2 size={16} style={{ marginRight: '6px' }} />
                                                Excluir Foto
                                            </button>
                                        )}
                                    </div>
                                    <a href={parseFotos(selectedImovel.fotos) || ''} target="_blank" rel="noopener noreferrer">
                                        <img src={parseFotos(selectedImovel.fotos) || ''} alt="Foto da instalação" className={styles.modalImg} />
                                    </a>
                                </div>
                            )}

                            <div className={styles.formGroup}>
                                <label htmlFor="edit-numero">Número do Imóvel</label>
                                <input
                                    id="edit-numero"
                                    type="text"
                                    className={styles.formInput}
                                    value={selectedImovel.numeroAInstalar || ''}
                                    onChange={e => setSelectedImovel({ ...selectedImovel, numeroAInstalar: e.target.value })}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="edit-status">Status</label>
                                <select
                                    id="edit-status"
                                    value={selectedImovel.status}
                                    onChange={e => setSelectedImovel({ ...selectedImovel, status: e.target.value })}
                                >
                                    <option value="NAO_INICIADO">Não Iniciado</option>
                                    <option value="LIBERADO">Liberado</option>
                                    <option value="AUSENTE">Ausente</option>
                                    <option value="PENDENTE">Pendente</option>
                                    <option value="AGENDADO">Agendado</option>
                                    <option value="CONCLUIDO">Concluído</option>
                                </select>
                            </div>

                            {selectedImovel.complementos?.length > 0 && (
                                <div className={styles.modalComplementSection}>
                                    <label>Complementos ({selectedImovel.complementos.length})</label>
                                    <div className={styles.compactCompList}>
                                        {selectedImovel.complementos.map((c: any) => {
                                            let statusClass = styles.compBlocked;
                                            if (c.status === 'CONCLUIDO') statusClass = styles.compDone;
                                            else if (c.liberadoInstalacao) statusClass = styles.compReleased;

                                            const foto = parseFotos(c.fotos);

                                            return (
                                                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', minWidth: '120px' }}>
                                                    <div className={`${styles.compIndicator} ${statusClass}`} title={`${c.numeroPredial} - ${c.status}`} style={{ margin: 0 }}>
                                                        {c.numeroPredial}
                                                    </div>
                                                    <select
                                                        aria-label={`Status da unidade ${c.numeroPredial}`}
                                                        value={c.status}
                                                        onChange={(e) => handleUpdateCompStatus(c.id, e.target.value)}
                                                        style={{ padding: '2px 4px', fontSize: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', width: '100%', cursor: 'pointer', fontWeight: '600' }}
                                                    >
                                                        <option value="NAO_INICIADO">Não Iniciado</option>
                                                        <option value="LIBERADO">Liberado</option>
                                                        <option value="AUSENTE">Ausente</option>
                                                        <option value="PENDENTE">Pendente</option>
                                                        <option value="CONCLUIDO">Concluído</option>
                                                    </select>
                                                    {foto ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                            <img src={foto} onClick={() => window.open(foto, '_blank')} style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in', border: '1px solid #cbd5e1' }} title="Clique para ver tamanho real" alt="foto comp" />
                                                            <div style={{ display: 'flex', gap: '3px' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteCompPhoto(c.id)}
                                                                    style={{ padding: '2px 4px', fontSize: '9px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                                    title="Excluir Foto"
                                                                >
                                                                    Excluir
                                                                </button>
                                                                <label
                                                                    style={{ padding: '2px 4px', fontSize: '9px', backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-block' }}
                                                                    title="Alterar Foto"
                                                                >
                                                                    Alterar
                                                                    <input type="file" accept="image/*" onChange={(e) => handleUploadCompPhoto(c.id, e)} style={{ display: 'none' }} />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>Sem foto</span>
                                                            <label
                                                                style={{ padding: '2px 8px', fontSize: '9px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-block' }}
                                                                title="Enviar Foto"
                                                            >
                                                                Enviar
                                                                <input type="file" accept="image/*" onChange={(e) => handleUploadCompPhoto(c.id, e)} style={{ display: 'none' }} />
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className={styles.formGroup}>
                                <label htmlFor="edit-obs">Observações</label>
                                <textarea
                                    id="edit-obs"
                                    value={selectedImovel.obsPendente || ''}
                                    placeholder="Ex: Portão trancado, número incorreto..."
                                    onChange={e => setSelectedImovel({ ...selectedImovel, obsPendente: e.target.value })}
                                />
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" onClick={() => setEditMode(false)} className={styles.cancelBtn} disabled={saving}>Cancelar</button>
                                <button type="submit" className={styles.saveBtn} disabled={saving}>
                                    {saving && <Loader2 size={16} className="spin" />} Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isCreating && (
                <div className={styles.modalOverlay} onClick={() => setIsCreating(false)}>
                    <div ref={createDialogRef} tabIndex={-1} className={styles.modal} style={{ maxWidth: '600px' }} role="dialog" aria-modal="true" aria-labelledby="create-imovel-title" onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHead}>
                            <div>
                                <h3 id="create-imovel-title">Cadastrar novo imóvel</h3>
                                <p>Use o GPS no local ou informe as coordenadas manualmente.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setIsCreating(false)} aria-label="Fechar"><X size={18} /></button>
                        </div>
                        
                        <form onSubmit={handleCreateImovel} className={styles.form}>
                            <div className={styles.formGrid}>
                                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                                    <label>INSCIMOB (Identificação)</label>
                                    <input
                                        type="text"
                                        className={styles.formInput}
                                        value={newImovelData.inscimob}
                                        onChange={e => setNewImovelData({ ...newImovelData, inscimob: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Bairro</label>
                                    <select
                                        className={styles.formSelect}
                                        value={newImovelData.bairroId}
                                        onChange={e => setNewImovelData({ ...newImovelData, bairroId: e.target.value })}
                                        required
                                    >
                                        <option value="">Selecione o Bairro...</option>
                                        {bairros.map(b => (
                                            <option key={b.id} value={b.id}>{b.nome}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Número do Imóvel</label>
                                    <input
                                        type="text"
                                        className={styles.formInput}
                                        value={newImovelData.numeroAInstalar}
                                        onChange={e => setNewImovelData({ ...newImovelData, numeroAInstalar: e.target.value })}
                                        required
                                        placeholder="Ex: 123"
                                    />
                                </div>

                                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '8px' }}>
                                        <label style={{ margin: 0 }}>Coordenadas (Eixos X e Y)</label>
                                        <button
                                            type="button"
                                            onClick={handleGetLocation}
                                            className={styles.geoButton}
                                        >
                                            <Navigation size={14} /> Usar minha localização (GPS)
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <input
                                                type="number"
                                                step="any"
                                                className={styles.formInput}
                                                value={newImovelData.x}
                                                onChange={e => setNewImovelData({ ...newImovelData, x: e.target.value })}
                                                aria-label="Latitude ou coordenada X"
                                                placeholder="Latitude / X (ex: -25.263884)"
                                                required
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <input
                                                type="number"
                                                step="any"
                                                className={styles.formInput}
                                                value={newImovelData.y}
                                                onChange={e => setNewImovelData({ ...newImovelData, y: e.target.value })}
                                                aria-label="Longitude ou coordenada Y"
                                                placeholder="Longitude / Y (ex: -49.208394)"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.modalActions} style={{ marginTop: '1.5rem' }}>
                                <button type="button" onClick={() => setIsCreating(false)} className={styles.cancelBtn}>Cancelar</button>
                                <button type="submit" className={styles.saveBtn}>Cadastrar Imóvel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {fichaImovel && (
                <ImovelInfoModal inscimob={fichaImovel.inscimob} initial={fichaImovel} onClose={() => setFichaImovel(null)} />
            )}
        </div>
    );
}
