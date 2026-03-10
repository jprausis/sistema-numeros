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

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) router.push('/login');
            setUser(user);
        };
        checkUser();
        fetchImoveis();
        handleGpsSearch(); // Ativa GPS automaticamente
    }, []);

    const fetchImoveis = async () => {
        try {
            const res = await fetch('/api/instalador/imoveis');
            const data = await res.json();
            setProperties(data.imoveis || []);
        } catch (e) {
            console.error("Erro ao buscar imóveis");
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

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.userInfo}>
                    <h1>Operador Prefeitura</h1>
                    <p>{user?.email}</p>
                </div>
                <button onClick={handleLogout} className={styles.logoutBtn}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                    </svg>
                </button>
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

            <main className={styles.content}>
                {view === 'map' && (
                    <div className={styles.mapContainer}>
                        <InstallerMap
                            properties={properties}
                            userLocation={location}
                            onEdit={(p) => setSelectedForProcess(p)}
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
                        ) : candidates.length > 0 ? (
                            <div className={styles.candidateList}>
                                {candidates.map(candidate => (
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
                            <p className={styles.sectionLabel}>Número Principal ({selectedForProcess.numeroAInstalar}):</p>

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

                            <div className={styles.actionButtonsRow}>
                                <button
                                    className={styles.liberarBtn}
                                    onClick={() => handleStatusUpdate('LIBERADO')}
                                    disabled={uploading}
                                >
                                    Liberar Número
                                </button>
                                <button
                                    className={styles.ausenteBtn}
                                    onClick={() => handleStatusUpdate('AUSENTE')}
                                    disabled={uploading}
                                >
                                    Morador Ausente
                                </button>
                                <button
                                    className={styles.resetBtn}
                                    onClick={() => handleStatusUpdate('NAO_INICIADO')}
                                    disabled={uploading}
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
        </div>
    );
}
