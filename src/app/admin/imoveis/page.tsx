'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import styles from './page.module.css';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';

const InstallerMap = dynamic(() => import('@/components/InstallerMap'), {
    ssr: false,
    loading: () => <div className={styles.loader}>Preparando Mapa...</div>
});

export default function AdminImoveisPage() {
    const supabase = createClient();
    const [imoveis, setImoveis] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'table' | 'map'>('table');
    const [selectedImovel, setSelectedImovel] = useState<any | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);
    
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

    const parseFotos = (fotosStr: any): string | null => {
        if (!fotosStr) return null;
        try {
            if (typeof fotosStr === 'string' && (fotosStr.startsWith('[') || fotosStr.startsWith('{'))) {
                const parsed = JSON.parse(fotosStr);
                return Array.isArray(parsed) ? parsed[0] : parsed;
            }
            return fotosStr;
        } catch (e) {
            return fotosStr;
        }
    };

    const limparLinksImagens = (fotosStr: any): string => {
        if (!fotosStr) return '';
        try {
            if (typeof fotosStr === 'string' && (fotosStr.startsWith('[') || fotosStr.startsWith('{'))) {
                const parsed = JSON.parse(fotosStr);
                if (Array.isArray(parsed)) {
                    return parsed.map((item: any) => String(item).trim()).join(', ');
                }
                return String(parsed).trim();
            }
            let cleanStr = String(fotosStr).trim();
            if (cleanStr.startsWith('[') && cleanStr.endsWith(']')) {
                cleanStr = cleanStr.slice(1, -1);
                return cleanStr.split(',').map((s: string) => s.replace(/["']/g, '').trim()).join(', ');
            }
            return cleanStr;
        } catch (e) {
            return String(fotosStr).trim();
        }
    };

    const temFotosReais = (fotosStr: any): boolean => {
        if (!fotosStr) return false;
        const trimmed = String(fotosStr).trim();
        return trimmed !== '' && trimmed !== 'null' && trimmed !== '[]';
    };

    const [bairros, setBairros] = useState<any[]>([]);
    const [bairroFilter, setBairroFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    async function fetchImoveis() {
        try {
            const [resImoveis, resBairros] = await Promise.all([
                fetch('/api/instalador/imoveis'),
                fetch('/api/admin/bairros')
            ]);

            const dataImoveis = await resImoveis.json();
            const dataBairros = await resBairros.json();

            setImoveis(dataImoveis.imoveis || []);
            setBairros(dataBairros.bairros || []);
        } catch (e) {
            console.error("Erro ao buscar dados");
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
                    setRole(profileData.user?.role || 'INSTALLER');
                    setUser(profileData.user);
                } else {
                    const { data: { user } } = await supabase.auth.getUser();
                    setUser(user);
                    setRole(user?.user_metadata?.role || 'INSTALLER');
                }
            } catch (error) {
                console.error("Erro ao verificar usuário:", error);
            }
        };
        checkUser();
        fetchImoveis();

        // Verificar parâmetro cadastrar=true na URL
        const query = new URLSearchParams(window.location.search);
        if (query.get('cadastrar') === 'true') {
            setIsCreating(true);
        }
    }, []);

    const isAdmin = role === 'ADMIN';

    const handleDeletePhoto = async () => {
        if (!selectedImovel || !window.confirm("Tem certeza que deseja excluir esta foto?")) return;

        try {
            const res = await fetch(`/api/admin/imoveis/${selectedImovel.inscimob}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fotos: null,
                    usuarioAlt: `Foto excluída por: ${user?.user_metadata?.name || user?.email}`
                })
            });

            if (res.ok) {
                setSelectedImovel({ ...selectedImovel, fotos: null });
                fetchImoveis();
            }
        } catch (e) {
            alert("Erro ao excluir foto.");
        }
    };

    const handleDeleteCompPhoto = async (compId: string) => {
        if (!selectedImovel || !window.confirm("Tem certeza que deseja excluir a foto deste complemento?")) return;

        try {
            const res = await fetch('/api/instalador/complemento/atualizar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: compId,
                    fotos: null,
                    userId: user?.id,
                    userEmail: user?.email
                })
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
                alert("Erro ao excluir foto do complemento.");
            }
        } catch (e) {
            alert("Erro ao excluir foto do complemento.");
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

            const uploadData = await uploadRes.json();
            const photoUrl = uploadData.url;

            const res = await fetch('/api/instalador/complemento/atualizar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: compId,
                    fotos: [photoUrl],
                    userId: user?.id,
                    userEmail: user?.email
                })
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
                alert("Erro ao enviar foto do complemento.");
            }
        } catch (err) {
            alert("Erro ao enviar foto do complemento.");
        }
    };

    const handleUpdateCompStatus = async (compId: string, newStatus: string) => {
        if (!selectedImovel) return;

        try {
            const res = await fetch('/api/instalador/complemento/atualizar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: compId,
                    status: newStatus,
                    userId: user?.id,
                    userEmail: user?.email
                })
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
                alert("Erro ao atualizar status do complemento.");
            }
        } catch (e) {
            alert("Erro ao atualizar status do complemento.");
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedImovel) return;

        try {
            const res = await fetch(`/api/admin/imoveis/${selectedImovel.inscimob}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: selectedImovel.status,
                    fotos: selectedImovel.fotos,
                    obsPendente: selectedImovel.obsPendente,
                    numeroAInstalar: selectedImovel.numeroAInstalar,
                    usuarioAlt: `Admin: ${user?.user_metadata?.name || user?.email}`
                })
            });

            if (res.ok) {
                alert("Imóvel atualizado com sucesso!");
                setEditMode(false);
                fetchImoveis();
            }
        } catch (e) {
            alert("Erro ao atualizar.");
        }
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert("Geolocalização não é suportada por este navegador.");
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
                alert("Não foi possível obter a localização do dispositivo.");
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
                alert("Imóvel cadastrado com sucesso!");
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
                alert(data.error || "Erro ao cadastrar imóvel.");
            }
        } catch (err) {
            console.error("Erro ao cadastrar imóvel:", err);
            alert("Erro de conexão ao cadastrar imóvel.");
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
                'Observações': i.obsPendente || '',
                'Data Execução': i.dataExecucao ? new Date(i.dataExecucao).toLocaleDateString() : 'N/A',
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
                        'Observações': '',
                        'Data Execução': c.dataExecucao ? new Date(c.dataExecucao).toLocaleDateString() : 'N/A',
                        'Tipo': 'Complemento'
                    });
                });
            }
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Imoveis");
        XLSX.writeFile(wb, `Relatorio_Instalacoes_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filtered = imoveis.filter(i => {
        const matchesSearch = i.inscimob.includes(search) || i.numeroAInstalar?.includes(search);
        const matchesBairro = bairroFilter === '' || i.bairroId === bairroFilter;
        const matchesStatus = statusFilter === '' || i.status === statusFilter;
        return matchesSearch && matchesBairro && matchesStatus;
    });

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Gestão de Imóveis</h1>
                    <p>Controle total sobre os números instalados e pendências.</p>
                </div>
                <div className={styles.headerActions}>
                    {(role === 'ADMIN' || role === 'OPERATOR' || role === 'PREFEITURA') && (
                        <button onClick={() => setIsCreating(true)} className={styles.exportBtn} style={{ backgroundColor: 'var(--primary)' }}>
                            ➕ Novo Imóvel
                        </button>
                    )}
                    <button onClick={handleExport} className={styles.exportBtn}>
                        📥 Exportar Excel
                    </button>

                    <select
                        className={styles.filterSelect}
                        value={bairroFilter}
                        onChange={e => setBairroFilter(e.target.value)}
                    >
                        <option value="">Todos os Bairros</option>
                        {bairros.map(b => (
                            <option key={b.id} value={b.id}>{b.nome}</option>
                        ))}
                    </select>

                    <select
                        className={styles.filterSelect}
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="">Todos os Status</option>
                        <option value="NAO_INICIADO">Não Iniciado</option>
                        <option value="LIBERADO">Liberado</option>
                        <option value="AUSENTE">Ausente</option>
                        <option value="PENDENTE">Pendente</option>
                        <option value="CONCLUIDO">Concluído</option>
                    </select>

                    <div className={styles.viewToggle}>
                        <button
                            className={view === 'table' ? styles.activeToggle : ''}
                            onClick={() => setView('table')}
                        >
                            Lista
                        </button>
                        <button
                            className={view === 'map' ? styles.activeToggle : ''}
                            onClick={() => setView('map')}
                        >
                            Mapa
                        </button>
                    </div>
                </div>
            </header>

            <div className={styles.searchWrapper}>
                <input
                    type="text"
                    placeholder="Buscar por inscimob ou Nº de casa..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className={styles.searchBar}
                />
            </div>

            {view === 'map' ? (
                <div className={styles.mapContainer}>
                    <InstallerMap
                        properties={filtered}
                        focusOn={mapFocus}
                        onEdit={(i) => {
                            if (isAdmin) {
                                setSelectedImovel(i);
                                setEditMode(true);
                            }
                        }}
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
                                <tr><td colSpan={7}>Carregando...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7}>Nenhum imóvel encontrado.</td></tr>
                            ) : filtered.map(i => (
                                <tr key={i.inscimob}>
                                    <td>
                                        {((i.status === 'CONCLUIDO' ? parseFotos(i.fotos) : (parseFotos(i.fotoLocalInstalacao) || parseFotos(i.fotos)))) ? (
                                            <div className={styles.tableThumb} onClick={() => window.open((i.status === 'CONCLUIDO' ? parseFotos(i.fotos) : (parseFotos(i.fotoLocalInstalacao) || parseFotos(i.fotos))) || '', '_blank')}>
                                                <img src={(i.status === 'CONCLUIDO' ? parseFotos(i.fotos) : (parseFotos(i.fotoLocalInstalacao) || parseFotos(i.fotos))) || ''} alt="Foto do Imóvel" />
                                                <span className={styles.photoBadge}>{i.status === 'CONCLUIDO' || (!i.fotoLocalInstalacao && i.fotos) ? 'Instalação' : 'Orientação'}</span>
                                            </div>
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
                                            {i.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.actions}>
                                            <button
                                                className={styles.locateBtn}
                                                title="Ver no Mapa"
                                                onClick={() => {
                                                    setMapFocus([i.x, i.y]);
                                                    setView('map');
                                                }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                                    <circle cx="12" cy="10" r="3" />
                                                </svg>
                                            </button>
                                            {isAdmin && (
                                                <button
                                                    className={styles.editBtn}
                                                    onClick={() => {
                                                        setSelectedImovel(i);
                                                        setEditMode(true);
                                                    }}
                                                >
                                                    Editar
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {editMode && selectedImovel && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3>Editar Imóvel: {selectedImovel.numeroAInstalar}</h3>
                        <p>ID: {selectedImovel.inscimob}</p>

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
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                Excluir Foto
                                            </button>
                                        )}
                                    </div>
                                    <img src={parseFotos(selectedImovel.fotos) || ''} alt="Foto" className={styles.modalImg} onClick={() => window.open(parseFotos(selectedImovel.fotos) || '', '_blank')} />
                                </div>
                            )}

                            <div className={styles.formGroup}>
                                <label>Número do Imóvel</label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    value={selectedImovel.numeroAInstalar || ''}
                                    onChange={e => setSelectedImovel({ ...selectedImovel, numeroAInstalar: e.target.value })}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Status</label>
                                <select
                                    value={selectedImovel.status}
                                    onChange={e => setSelectedImovel({ ...selectedImovel, status: e.target.value })}
                                >
                                    <option value="NAO_INICIADO">Não Iniciado</option>
                                    <option value="LIBERADO">Liberado</option>
                                    <option value="AUSENTE">Ausente</option>
                                    <option value="PENDENTE">Pendente</option>
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

                                            const foto = c.fotos && c.fotos !== 'null' && c.fotos !== '[]' ? JSON.parse(c.fotos)[0] : null;

                                            return (
                                                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', minWidth: '120px' }}>
                                                    <div className={`${styles.compIndicator} ${statusClass}`} title={`${c.numeroPredial} - ${c.status}`} style={{ margin: 0 }}>
                                                        {c.numeroPredial}
                                                    </div>
                                                    <select
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
                                                            <span style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic' }}>Sem foto</span>
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
                                <label>Observações</label>
                                <textarea
                                    value={selectedImovel.obsPendente || ''}
                                    placeholder="Ex: Portão trancado, número incorreto..."
                                    onChange={e => setSelectedImovel({ ...selectedImovel, obsPendente: e.target.value })}
                                />
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" onClick={() => setEditMode(false)} className={styles.cancelBtn}>Cancelar</button>
                                <button type="submit" className={styles.saveBtn}>Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isCreating && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal} style={{ maxWidth: '600px' }}>
                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', fontWeight: 800 }}>
                            ➕ Cadastrar Novo Imóvel
                        </h3>
                        
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
                                            📡 Capturar Localização GPS Atual
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
                                                placeholder="Eixo X (Ex: -25.263884)"
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
                                                placeholder="Eixo Y (Ex: -49.208394)"
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
        </div>
    );
}
