'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import styles from './page.module.css';
import { createClient } from '@/utils/supabase/client';
import { compressImage } from '@/utils/imageCompressor';

const InstallerMap = dynamic(() => import('@/components/InstallerMap'), {
    ssr: false,
    loading: () => <div className={styles.loadingText}>Preparando Mapa...</div>
});

export default function PrefeituraPage() {
    const router = useRouter();
    const supabase = createClient();
    const [view, setView] = useState<'map' | 'gps'>('map');
    const [properties, setProperties] = useState<any[]>([]);
    const [searchRadius, setSearchRadius] = useState<number>(80);
    const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loadingGps, setLoadingGps] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedForProcess, setSelectedForProcess] = useState<any | null>(null);
    const [user, setUser] = useState<any>(null);
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    // Estados para edição do número do imóvel principal
    const [editingNumero, setEditingNumero] = useState('');
    const [isEditingNumero, setIsEditingNumero] = useState(false);

    // Estados para o filtro de bairros
    const [selectedBairroId, setSelectedBairroId] = useState<string | null>(null);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    useEffect(() => {
        if (selectedForProcess) {
            setEditingNumero(selectedForProcess.numeroAInstalar || '');
            setIsEditingNumero(false);
        } else {
            setEditingNumero('');
            setIsEditingNumero(false);
        }
    }, [selectedForProcess]);

    // Novos estados para o cadastro de imóveis
    const [isCreating, setIsCreating] = useState(false);
    const [bairros, setBairros] = useState<any[]>([]);
    const [newImovelData, setNewImovelData] = useState({
        inscimob: '',
        x: '',
        y: '',
        numeroAInstalar: '',
        bairroId: ''
    });

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) router.push('/login');
            setUser(user);
        };
        checkUser();
        fetchImoveis();
        fetchBairros();
        handleGpsSearch(); // Ativa GPS automaticamente
    }, []);

    const fetchBairros = async () => {
        try {
            const res = await fetch('/api/admin/bairros');
            const data = await res.json();
            setBairros(data.bairros || []);
        } catch (e) {
            console.error("Erro ao buscar bairros");
        }
    };

    const fetchImoveis = async () => {
        try {
            const res = await fetch('/api/admin/imoveis');
            const data = await res.json();
            setProperties(data.imoveis || []);
        } catch (e) {
            console.error("Erro ao buscar imóveis");
        }
    };

    const handleGetLocationForCreation = () => {
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
                    bairroId: newImovelData.bairroId
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
                    bairroId: ''
                });
                fetchImoveis();
                handleGpsSearch();
            } else {
                alert(data.error || "Erro ao cadastrar imóvel.");
            }
        } catch (err) {
            console.error("Erro ao cadastrar imóvel:", err);
            alert("Erro de conexão ao cadastrar imóvel.");
        }
    };

    const handleGpsSearch = () => {
        if (!navigator.geolocation) return;
        setLoadingGps(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            setLocation({ lat: latitude, lon: longitude });
            try {
                const res = await fetch(`/api/instalador/proximos?lat=${latitude}&lon=${longitude}&radius=${searchRadius}`);
                const data = await res.json();
                setCandidates(data.candidates || []);
            } catch (e) {
                console.error("Erro na busca por GPS");
            } finally {
                setLoadingGps(false);
            }
        }, () => setLoadingGps(false));
    };

    const handleStatusUpdate = async (status: 'LIBERADO' | 'AUSENTE' | 'NAO_INICIADO') => {
        if (!selectedForProcess) return;
        setUploading(true);
        let fotoUrl: string | null = null;

        try {
            if (status === 'LIBERADO' && photo) {
                const compressedBlob = await compressImage(photo);
                const fileName = `prefeitura_${selectedForProcess.inscimob}_${Date.now()}.jpg`;

                const { data, error } = await supabase.storage
                    .from('fotos-imoveis')
                    .upload(fileName, compressedBlob, {
                        contentType: 'image/jpeg'
                    });

                if (error) throw new Error("Falha no upload da foto: " + error.message);

                const { data: { publicUrl } } = supabase.storage
                    .from('fotos-imoveis')
                    .getPublicUrl(fileName);

                fotoUrl = publicUrl;
            }

            const res = await fetch('/api/instalador/concluir', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inscimob: selectedForProcess.inscimob,
                    status: status,
                    fotoUrl: null, // Prefeitura não precisa de foto
                    fotoLocalInstalacao: fotoUrl, // Envia a foto do local de instalação
                    obs: status === 'NAO_INICIADO'
                        ? `Resetado por Operador Prefeitura: ${user?.user_metadata?.name || user?.email}`
                        : `Atualizado por Operador Prefeitura: ${user?.user_metadata?.name || user?.email}`,
                    usuarioAlt: `Prefeitura: ${user?.user_metadata?.name || user?.email}`,
                    userId: user?.id,
                    userEmail: user?.email
                })
            });

            if (res.ok) {
                const msg = status === 'LIBERADO' ? 'Liberado' : (status === 'AUSENTE' ? 'Ausente' : 'Não Iniciado');
                alert(`Imóvel marcado como ${msg}!`);
                setSelectedForProcess(null);
                setPhoto(null);
                setPhotoPreview(null);
                fetchImoveis();
                handleGpsSearch();
            } else {
                alert("Erro ao atualizar status.");
            }
        } catch (e: any) {
            alert("Erro ao processar requisição: " + (e.message || "Erro desconhecido"));
        } finally {
            setUploading(false);
        }
    };

    const handleLiberarComplemento = async (complementoId: string, liberado: boolean) => {
        setUploading(true);
        let fotoUrl: string | null = null;

        try {
            if (liberado && photo) {
                const complemento = selectedForProcess.complementos?.find((c: any) => c.id === complementoId);
                const compressedBlob = await compressImage(photo);
                const fileName = `prefeitura_${selectedForProcess.inscimob}_${complemento?.unidade || 'comp'}_${Date.now()}.jpg`;

                const { data, error } = await supabase.storage
                    .from('fotos-imoveis')
                    .upload(fileName, compressedBlob, {
                        contentType: 'image/jpeg'
                    });

                if (error) throw new Error("Falha no upload da foto do complemento: " + error.message);

                const { data: { publicUrl } } = supabase.storage
                    .from('fotos-imoveis')
                    .getPublicUrl(fileName);

                fotoUrl = publicUrl;
            }

            const res = await fetch('/api/prefeitura/complemento/liberar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: complementoId,
                    liberado,
                    fotoLocalInstalacao: fotoUrl,
                    userId: user?.id,
                    userEmail: user?.email
                })
            });

            if (res.ok) {
                // Atualizar state local do selectedForProcess
                setSelectedForProcess((prev: any) => ({
                    ...prev,
                    complementos: prev.complementos.map((c: any) =>
                        c.id === complementoId ? { ...c, liberadoInstalacao: liberado, fotoLocalInstalacao: fotoUrl } : c
                    )
                }));
                // Recarregar listas globais para manter sincronismo
                fetchImoveis();
                handleGpsSearch();
                setPhoto(null);
                setPhotoPreview(null);
            } else {
                alert("Erro ao liberar complemento.");
            }
        } catch (e: any) {
            alert("Erro ao liberar complemento: " + (e.message || "Erro desconhecido"));
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateNumero = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedForProcess || !editingNumero.trim()) return;
        setUploading(true);

        try {
            const res = await fetch(`/api/admin/imoveis/${selectedForProcess.inscimob}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    numeroAInstalar: editingNumero.trim(),
                    usuarioAlt: `Prefeitura: ${user?.user_metadata?.name || user?.email}`
                })
            });

            if (res.ok) {
                alert("Número do imóvel atualizado com sucesso!");
                setSelectedForProcess((prev: any) => prev ? { ...prev, numeroAInstalar: editingNumero.trim() } : null);
                setIsEditingNumero(false);
                fetchImoveis();
                handleGpsSearch();
            } else {
                const data = await res.json();
                alert(data.error || "Erro ao atualizar o número.");
            }
        } catch (e: any) {
            alert("Erro ao conectar ao servidor: " + (e.message || "Erro desconhecido"));
        } finally {
            setUploading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const filteredProperties = selectedBairroId
        ? properties.filter((p: any) => p.bairroId === selectedBairroId)
        : properties;

    const filteredCandidates = selectedBairroId
        ? candidates.filter((c: any) => c.bairroId === selectedBairroId)
        : candidates;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.userInfo}>
                    <h1>Operador Prefeitura</h1>
                    <p>{user?.email}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button 
                        onClick={() => setIsCreating(true)} 
                        style={{
                            padding: '0.6rem 1rem',
                            borderRadius: '8px',
                            background: '#22c55e',
                            color: 'white',
                            border: 'none',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.85rem',
                            boxShadow: '0 4px 10px rgba(34, 197, 94, 0.2)'
                        }}
                    >
                        ➕ Novo Imóvel
                    </button>
                    <button onClick={handleLogout} className={styles.logoutBtn}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                    </button>
                </div>
            </header>

            <nav className={styles.nav}>
                <button
                    className={`${styles.navBtn} ${view === 'map' ? styles.activeNav : ''}`}
                    onClick={() => setView('map')}
                >
                    <svg width="18" height="18" style={{ marginRight: '6px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                    </svg>
                    Mapa Geral
                </button>
                <button
                    className={`${styles.navBtn} ${view === 'gps' ? styles.activeNav : ''}`}
                    onClick={() => { setView('gps'); handleGpsSearch(); }}
                >
                    <svg width="18" height="18" style={{ marginRight: '6px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v3m0 14v3m-7-10H2m17 0h3" />
                    </svg>
                    Estou no Local
                </button>
            </nav>
            
            {selectedBairroId && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    margin: '0 1rem 1rem 1rem',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    boxShadow: '0 2px 5px rgba(22, 163, 74, 0.05)'
                }}>
                    <span style={{ color: '#166534', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🔍 Filtrado por: {bairros.find(b => b.id === selectedBairroId)?.nome || 'Bairro'}
                    </span>
                    <button
                        onClick={() => setSelectedBairroId(null)}
                        style={{
                            background: '#dcfce7',
                            border: 'none',
                            color: '#166534',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                        }}
                    >
                        ❌ Limpar
                    </button>
                </div>
            )}

            <main className={styles.content}>
                {view === 'map' && (
                    <div className={styles.mapContainer}>
                        <InstallerMap
                            properties={filteredProperties}
                            userLocation={location}
                            onEdit={(p) => setSelectedForProcess(p)}
                            onFilterClick={() => setIsFilterModalOpen(true)}
                            filterActive={!!selectedBairroId}
                        />
                    </div>
                )}

                {view === 'gps' && (
                    <div className={styles.gpsView}>
                        <div className={styles.gpsHeader}>
                            <h2>Imóveis Próximos</h2>
                            <div className={styles.radiusSelector}>
                                <span>Raio:</span>
                                {[80, 200, 500, 1000].map(r => (
                                    <button
                                        key={r}
                                        className={searchRadius === r ? styles.activeRadius : styles.radiusBtn}
                                        onClick={() => { setSearchRadius(r); setTimeout(() => handleGpsSearch(), 50); }}
                                    >
                                        {r >= 1000 ? (r / 1000) + 'km' : r + 'm'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loadingGps ? (
                            <p className={styles.loadingText}>📡 Buscando localização...</p>
                        ) : filteredCandidates.length > 0 ? (
                            <div className={styles.candidateList}>
                                {filteredCandidates.map(candidate => (
                                    <div key={candidate.inscimob} className={styles.candidateCard}>
                                        <div className={styles.candidateInfo}>
                                            <h3>Nº {candidate.numeroAInstalar}</h3>
                                            <p>{candidate.bairro?.nome} - ID: {candidate.inscimob}</p>
                                            <span className={styles.distance}>a {Math.round(candidate.distance)}m</span>
                                            <span className={`${styles.statusPill} ${styles[candidate.status]}`}>
                                                {candidate.status === 'NAO_INICIADO' ? 'Não Iniciado' :
                                                    candidate.status === 'LIBERADO' ? 'Liberado' :
                                                        candidate.status === 'AUSENTE' ? 'Ausente' :
                                                            candidate.status === 'PENDENTE' ? 'Pendente' : candidate.status}
                                            </span>
                                        </div>
                                        <button
                                            className={styles.openButton}
                                            onClick={() => setSelectedForProcess(candidate)}
                                        >
                                            🚀 Ação
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p>Nenhum imóvel encontrado por perto.</p>
                        )}
                    </div>
                )}
            </main>

            {selectedForProcess && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        {uploading && (
                            <div className={styles.loadingOverlay}>
                                <div className={styles.spinner}></div>
                                <p className={styles.loadingText}>Atualizando...</p>
                            </div>
                        )}
                        <div className={styles.modalHeader}>
                            <h3>Imóvel {selectedForProcess.numeroAInstalar}</h3>
                            <button className={styles.closeBtn} onClick={() => { setSelectedForProcess(null); setPhoto(null); setPhotoPreview(null); }}>×</button>
                        </div>

                        <div className={styles.prefeituraActions}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '12px', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#334155' }}>Nº Principal a Instalar:</span>
                                    {!isEditingNumero && (
                                        <button 
                                            onClick={() => setIsEditingNumero(true)} 
                                            title="Editar número"
                                            style={{ 
                                                background: '#eff6ff', 
                                                border: 'none', 
                                                color: '#2563eb', 
                                                cursor: 'pointer', 
                                                padding: '8px', 
                                                borderRadius: '10px', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                transition: 'all 0.2s',
                                                width: '42px',
                                                height: '42px'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                {isEditingNumero ? (
                                    <form onSubmit={handleUpdateNumero} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <input 
                                            type="text" 
                                            value={editingNumero} 
                                            onChange={e => setEditingNumero(e.target.value)} 
                                            required
                                            style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                        />
                                        <button type="submit" disabled={uploading} style={{ padding: '6px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            Salvar
                                        </button>
                                        <button type="button" onClick={() => { setIsEditingNumero(false); setEditingNumero(selectedForProcess.numeroAInstalar || ''); }} style={{ padding: '6px 12px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            Cancelar
                                        </button>
                                    </form>
                                ) : (
                                    <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1e293b' }}>
                                        {selectedForProcess.numeroAInstalar}
                                    </span>
                                )}
                            </div>

                            <div className={styles.photoSection} style={{ marginBottom: '15px' }}>
                                {photoPreview ? (
                                    <div className={styles.previewContainer} style={{ position: 'relative', textAlign: 'center' }}>
                                        <img src={photoPreview} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                                        <button onClick={() => { setPhotoPreview(null); setPhoto(null); }} style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Excluir e tirar outra foto</button>
                                        <span style={{ fontSize: '12px', color: '#666', marginTop: '5px', display: 'block' }}>ℹ️ A foto será anexada ao item que você liberar.</span>
                                    </div>
                                ) : (
                                    <label className={styles.captureBtnHuge} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                                        <span className={styles.cameraIcon} style={{ color: '#4f46e5', marginBottom: '10px' }}>
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                                                <circle cx="12" cy="13" r="4" />
                                            </svg>
                                        </span>
                                        <span style={{ fontWeight: 'bold', color: '#1e293b' }}>Tirar Foto de Orientação</span>
                                        <p style={{ fontSize: '12px', color: '#64748b', margin: '5px 0 0 0' }}>Opcional para instruir o instalador</p>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setPhoto(file);
                                                    setPhotoPreview(URL.createObjectURL(file));
                                                }
                                            }}
                                            disabled={uploading}
                                            hidden
                                        />
                                    </label>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '10px' }}>
                                <button
                                    className={styles.liberarBtn}
                                    onClick={() => handleStatusUpdate('LIBERADO')}
                                    disabled={uploading}
                                    style={{ width: '100%' }}
                                >
                                    Liberar Número
                                </button>
                                <button
                                    className={styles.ausenteBtn}
                                    onClick={() => handleStatusUpdate('AUSENTE')}
                                    disabled={uploading}
                                    style={{ width: '100%' }}
                                >
                                    Morador Ausente
                                </button>
                                <button
                                    className={styles.resetBtn}
                                    onClick={() => handleStatusUpdate('NAO_INICIADO')}
                                    disabled={uploading}
                                    style={{ width: '100%' }}
                                >
                                    Resetar
                                </button>
                            </div>
                        </div>

                        {selectedForProcess.complementos && selectedForProcess.complementos.length > 0 && (
                            <div className={styles.complementSection}>
                                <div className={styles.divider}></div>
                                <p className={styles.sectionLabel}>Casas / Unidades Internas:</p>
                                <div className={styles.complementTable}>
                                    {selectedForProcess.complementos.map((c: any) => (
                                        <div key={c.id} className={styles.complementRow}>
                                            <div className={styles.complementMeta}>
                                                <strong>{c.numeroPredial}</strong>
                                                <span>Unidade: {c.unidade}</span>
                                            </div>
                                            <div className={styles.complementStatusPill}>
                                                {c.status === 'CONCLUIDO' ? '✅ Concluído' :
                                                    c.status === 'PENDENTE' ? '⚠️ Pendente' : '⏳ Aguardando'}
                                            </div>
                                            <button
                                                className={c.liberadoInstalacao ? styles.liberadoBtn : styles.bloqueadoBtn}
                                                onClick={() => handleLiberarComplemento(c.id, !c.liberadoInstalacao)}
                                                disabled={uploading}
                                            >
                                                {c.liberadoInstalacao ? 'Liberado' : 'Bloqueado'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isCreating && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal} style={{ maxWidth: '550px' }}>
                        <h3 style={{ marginBottom: '1.2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', fontWeight: 800 }}>
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
                                            onClick={handleGetLocationForCreation}
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

            {isFilterModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal} style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column' }}>
                        <div className={styles.modalHeader}>
                            <h3>Filtrar por Bairro</h3>
                            <button className={styles.closeBtn} onClick={() => setIsFilterModalOpen(false)}>×</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px', marginTop: '10px', marginBottom: '15px' }}>
                            <button
                                onClick={() => {
                                    setSelectedBairroId(null);
                                    setIsFilterModalOpen(false);
                                }}
                                style={{
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: '1px solid #cbd5e1',
                                    background: !selectedBairroId ? '#eff6ff' : 'white',
                                    color: !selectedBairroId ? '#1e40af' : '#334155',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.9rem'
                                }}
                            >
                                <span>Todos os Bairros (Sem Filtro)</span>
                                {!selectedBairroId && <span>✓</span>}
                            </button>

                            {bairros.map(b => (
                                <button
                                    key={b.id}
                                    onClick={() => {
                                        setSelectedBairroId(b.id);
                                        setIsFilterModalOpen(false);
                                    }}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: '1px solid #cbd5e1',
                                        background: selectedBairroId === b.id ? '#eff6ff' : 'white',
                                        color: selectedBairroId === b.id ? '#1e40af' : '#334155',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    <span>{b.nome}</span>
                                    {selectedBairroId === b.id && <span>✓</span>}
                                </button>
                            ))}
                        </div>
                        
                        <button 
                            className={styles.closeBtn} 
                            style={{ margin: 0, padding: '10px', background: '#f1f5f9', color: '#64748b', borderRadius: '10px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                            onClick={() => setIsFilterModalOpen(false)}
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
