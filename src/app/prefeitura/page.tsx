'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import styles from './page.module.css';
import { createClient } from '@/utils/supabase/client';

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
        try {
            const res = await fetch('/api/instalador/concluir', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inscimob: selectedForProcess.inscimob,
                    status: status,
                    fotoUrl: null, // Prefeitura não precisa de foto
                    obs: status === 'NAO_INICIADO'
                        ? `Resetado por Operador Prefeitura: ${user?.user_metadata?.name || user?.email}`
                        : `Atualizado por Operador Prefeitura: ${user?.user_metadata?.name || user?.email}`
                })
            });

            if (res.ok) {
                const msg = status === 'LIBERADO' ? 'Liberado' : (status === 'AUSENTE' ? 'Ausente' : 'Não Iniciado');
                alert(`Imóvel marcado como ${msg}!`);
                setSelectedForProcess(null);
                fetchImoveis();
                handleGpsSearch();
            }
        } catch (e) {
            alert("Erro ao atualizar status.");
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
                        <h3>Ação: {selectedForProcess.numeroAInstalar}</h3>
                        <p>Defina o status deste imóvel para o instalador.</p>

                        <div className={styles.prefeituraActions}>
                            <button
                                className={styles.liberarBtn}
                                onClick={() => handleStatusUpdate('LIBERADO')}
                                disabled={uploading}
                            >
                                Liberar p/ Instalação
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
                                Reiniciar p/ Não Iniciado
                            </button>
                        </div>

                        <button
                            className={styles.closeBtn}
                            onClick={() => setSelectedForProcess(null)}
                            disabled={uploading}
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
