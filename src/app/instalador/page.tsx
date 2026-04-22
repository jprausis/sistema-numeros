'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import styles from './page.module.css';
import { createClient } from '@/utils/supabase/client';
import { compressImage } from '@/utils/imageCompressor';

// Importação dinâmica do mapa para evitar erros de SSR com Leaflet
const InstallerMap = dynamic(() => import('@/components/InstallerMap'), {
    ssr: false,
    loading: () => <div className={styles.loader}>Carregando Mapa...</div>
});

export default function InstallerDashboard() {
    const router = useRouter();
    const supabase = createClient();
    const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loadingGps, setLoadingGps] = useState(false);
    const [view, setView] = useState<'map' | 'list' | 'gps'>('map');
    const [properties, setProperties] = useState<any[]>([]);
    const [agendamentosList, setAgendamentosList] = useState<any[]>([]);
    const [searchRadius, setSearchRadius] = useState<number>(80);

    // Estados para o Processo de Conclusão (Nova Tela)
    const [linkingAgendamento, setLinkingAgendamento] = useState<any | null>(null);
    const [user, setUser] = useState<any>(null);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

    useEffect(() => {
        if (view === 'list') {
            fetchAgendamentos();
        }
    }, [view]);

    async function fetchAgendamentos() {
        setLoadingGps(true);
        try {
            const res = await fetch('/api/agendamentos/listar');
            const data = await res.json();
            setAgendamentosList(data.agendamentos || []);
        } catch (e) {
            console.error("Erro ao carregar agendamentos");
        } finally {
            setLoadingGps(false);
        }
    }

    // Buscar todos os imóveis para o mapa
    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            await fetchImoveis();
            handleGpsSearch(true); // Ativar GPS automaticamente no início em background
        };
        fetchInitialData();
    }, []);

    async function fetchImoveis() {
        const res = await fetch('/api/instalador/imoveis');
        const data = await res.json();
        setProperties(data.imoveis || []);
    }

    const handleGpsSearch = (silent = false) => {
        if (!navigator.geolocation) return alert("GPS não suportado pelo navegador.");

        setLoadingGps(true);
        if (!silent) setView('gps');

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            setLocation({ lat: latitude, lon: longitude });

            try {
                const res = await fetch(`/api/instalador/proximos?lat=${latitude}&lon=${longitude}&radius=${searchRadius}`);
                const data = await res.json();
                setCandidates(data.candidates || []);
            } catch (e) {
                alert("Erro ao buscar imóveis próximos.");
            } finally {
                setLoadingGps(false);
            }
        }, (err) => {
            alert("Erro ao obter localização: " + err.message);
            setLoadingGps(false);
        });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const handleProcess = (property: any) => {
        if (linkingAgendamento) {
            router.push(`/instalador/imovel/${property.inscimob}?agendamento=${linkingAgendamento.protocolo}&nome=${encodeURIComponent(linkingAgendamento.nome)}`);
        } else {
            router.push(`/instalador/imovel/${property.inscimob}`);
        }
    };



    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <h1>Painel do Instalador</h1>
                        <p>{user?.email}</p>
                    </div>
                    <button onClick={handleLogout} className={styles.logoutBtn}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                    </button>
                </div>
                <nav className={styles.nav}>
                    <button
                        className={`${view === 'map' ? styles.activeNav : ''}`}
                        onClick={() => { setView('map'); setLinkingAgendamento(null); }}
                    >
                        <svg width="18" height="18" style={{ marginRight: '6px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                        Mapa
                    </button>
                    <button
                        className={`${view === 'list' ? styles.activeNav : ''}`}
                        onClick={() => { setView('list'); setLinkingAgendamento(null); }}
                    >
                        <svg width="18" height="18" style={{ marginRight: '6px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Agenda
                    </button>
                    <button
                        className={`${view === 'gps' ? styles.activeNav : ''}`}
                        onClick={() => handleGpsSearch()}
                    >
                        <svg width="18" height="18" style={{ marginRight: '6px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 2v3m0 14v3m-7-10H2m17 0h3" />
                        </svg>
                        Local
                    </button>
                </nav>
            </header>

            <main className={styles.content}>
                {view === 'map' && (
                    <InstallerMap
                        properties={properties}
                        userLocation={location}
                        onEdit={(p) => handleProcess(p)}
                    />
                )}

                {view === 'gps' && (
                    <div className={styles.gpsView}>
                        <div className={styles.gpsHeader}>
                            <h2> {linkingAgendamento ? 'Escolha o imóvel para vincular' : 'Imóveis Próximos'} </h2>
                            <div className={styles.radiusSelector}>
                                <span>Raio:</span>
                                {[80, 200, 500, 1000].map(r => (
                                    <button
                                        key={r}
                                        className={searchRadius === r ? styles.activeRadius : styles.radiusBtn}
                                        onClick={() => {
                                            setSearchRadius(r);
                                            // Disparar nova busca com o raio atualizado
                                            setTimeout(() => handleGpsSearch(), 50);
                                        }}
                                    >
                                        {r >= 1000 ? (r / 1000) + 'km' : r + 'm'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {linkingAgendamento && (
                            <p className={styles.subtext}>Abaixo estão os imóveis perto de você agora.</p>
                        )}
                        {loadingGps ? (
                            <p className={styles.loadingText}>📡 Buscando sua localização e imóveis...</p>
                        ) : candidates.length > 0 ? (
                            <div className={styles.candidateList}>
                                {candidates.map(candidate => (
                                    <div key={candidate.inscimob} className={styles.candidateCard}>
                                        <div className={styles.candidateInfo}>
                                            <h3>Nº {candidate.numeroAInstalar}</h3>
                                            <p>{candidate.bairro.nome} - ID: {candidate.inscimob}</p>
                                            <span className={styles.distance}>a {Math.round(candidate.distance)}m de você</span>
                                            <span className={`${styles.statusPill} ${styles[candidate.status]}`}>
                                                {candidate.status === 'NAO_INICIADO' ? 'Não Iniciado' :
                                                    candidate.status === 'LIBERADO' ? 'Liberado' :
                                                        candidate.status === 'AUSENTE' ? 'Ausente' :
                                                            candidate.status === 'PENDENTE' ? 'Pendente' :
                                                                candidate.status === 'CONCLUIDO' ? 'Concluído' : candidate.status}
                                            </span>
                                        </div>
                                        <button
                                            className={styles.openButton}
                                            onClick={() => handleProcess(candidate)}
                                        >
                                            {linkingAgendamento ? 'Vincular Este' : 'Concluir'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p>Nenhum imóvel encontrado por perto.</p>
                        )}
                        <button onClick={() => { setView('map'); setLinkingAgendamento(null); }} className={styles.backButton} style={{ marginTop: '2rem', padding: '1rem', width: '100%', background: '#f1f5f9', border: 'none', borderRadius: '10px', fontWeight: '700' }}>Cancelar e Voltar</button>
                    </div>
                )}

                {view === 'list' && (
                    <div className={styles.listView}>
                        <div className={styles.listHeader}>
                            <h2>Agendamentos de Moradores</h2>
                        </div>
                        {loadingGps ? (
                            <p>Carregando agendamentos...</p>
                        ) : agendamentosList.length > 0 ? (
                            <div className={styles.candidateList}>
                                {agendamentosList.map(ag => (
                                    <div key={ag.protocolo} className={styles.candidateCard}>
                                        <div className={styles.candidateInfo}>
                                            <span className={styles.protocolBadge}>{ag.protocolo}</span>
                                            <h3>{ag.nome}</h3>
                                            <p>{ag.enderecoCompleto}</p>
                                            <div className={styles.timeInfo}>
                                                📅 {new Date(ag.dataHora).toLocaleDateString()} às {new Date(ag.dataHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div className={styles.cardActions}>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ag.enderecoCompleto)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.mapButton}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                                    <circle cx="12" cy="10" r="3" />
                                                </svg>
                                            </a>
                                            <button
                                                className={styles.openButton}
                                                onClick={() => {
                                                    if (ag.inscimobVinculo) {
                                                        const target = properties.find(p => p.inscimob === ag.inscimobVinculo);
                                                        if (target) handleProcess(target);
                                                        else alert("Imóvel vinculado não encontrado.");
                                                    } else {
                                                        // NOVO FLUXO: Vincular via GPS
                                                        setLinkingAgendamento(ag);
                                                        handleGpsSearch();
                                                    }
                                                }}
                                            >
                                                Concluir
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p>Nenhum agendamento encontrado.</p>
                        )}
                    </div>
                )}
            </main>

            {fullScreenImage && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                    onClick={() => setFullScreenImage(null)}
                >
                    <img
                        src={fullScreenImage}
                        alt="Fullscreen"
                        style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', borderRadius: '8px' }}
                    />
                    <div style={{ position: 'absolute', top: '20px', right: '20px', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', width: '40px', height: '40px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>✕</div>
                </div>
            )}
        </div>
    );
}
