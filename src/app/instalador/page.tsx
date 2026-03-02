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

    // Estados para o Processo de Conclusão (Nova Tela)
    const [selectedForProcess, setSelectedForProcess] = useState<any | null>(null);
    const [linkingAgendamento, setLinkingAgendamento] = useState<any | null>(null);
    const [uploading, setUploading] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [obs, setObs] = useState('');

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
        async function fetchProperties() {
            const res = await fetch('/api/instalador/imoveis');
            const data = await res.json();
            setProperties(data.imoveis || []);
        }
        fetchProperties();
    }, []);

    const handleGpsSearch = () => {
        if (!navigator.geolocation) return alert("GPS não suportado pelo navegador.");

        setLoadingGps(true);
        setView('gps');

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            setLocation({ lat: latitude, lon: longitude });

            try {
                const res = await fetch(`/api/instalador/proximos?lat=${latitude}&lon=${longitude}&radius=80`);
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

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCapturedPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleFinish = async () => {
        if (!selectedForProcess || !capturedPhoto) {
            return alert("A foto é obrigatória para concluir!");
        }

        setUploading(true);
        try {
            // 1. Comprimir imagem
            const compressedBlob = await compressImage(capturedPhoto);
            const fileName = `${selectedForProcess.inscimob}_${Date.now()}.jpg`;

            // 2. Upload para Supabase Storage
            const { data, error } = await supabase.storage
                .from('fotos-imoveis')
                .upload(fileName, compressedBlob, {
                    contentType: 'image/jpeg'
                });

            if (error) throw error;

            // Pegar URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('fotos-imoveis')
                .getPublicUrl(fileName);

            // 3. Salvar no Banco via API
            const res = await fetch('/api/instalador/concluir', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inscimob: selectedForProcess.inscimob,
                    status: 'CONCLUIDO',
                    fotoUrl: publicUrl,
                    obs: obs,
                    protocolo: linkingAgendamento?.protocolo
                })
            });

            if (res.ok) {
                alert("Instalação concluída com sucesso!");
                setSelectedForProcess(null);
                setLinkingAgendamento(null);
                setCapturedPhoto(null);
                setPhotoPreview(null);
                setObs('');
                // Recarregar dados
                const resProps = await fetch('/api/instalador/imoveis');
                const dataProps = await resProps.json();
                setProperties(dataProps.imoveis || []);
                if (view === 'gps') handleGpsSearch();
                if (view === 'list') fetchAgendamentos();
                setView('map');
            }
        } catch (e: any) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setUploading(false);
        }
    };

    // TELA DE CONCLUSÃO (NOVA TELA)
    if (selectedForProcess) {
        return (
            <div className={styles.processContainer}>
                <header className={styles.header}>
                    <button onClick={() => { setSelectedForProcess(null); setLinkingAgendamento(null); }} className={styles.backLink}>← Voltar</button>
                    <h1>{linkingAgendamento ? 'Vincular e Concluir' : 'Instalar Número: ' + selectedForProcess.numeroAInstalar}</h1>
                </header>

                <main className={styles.processContent}>
                    {linkingAgendamento && (
                        <div className={styles.linkingAlert}>
                            Viculando ao agendamento de <strong>{linkingAgendamento.nome}</strong>
                        </div>
                    )}

                    <div className={styles.processCard}>
                        <div className={styles.propertyHeader}>
                            <h2>{selectedForProcess.bairro.nome}</h2>
                            <p>Inscimob: {selectedForProcess.inscimob} - Nº: {selectedForProcess.numeroAInstalar}</p>
                        </div>

                        <div className={styles.photoSection}>
                            {photoPreview ? (
                                <div className={styles.previewContainer}>
                                    <img src={photoPreview} alt="Preview" className={styles.preview} />
                                    <button onClick={() => { setPhotoPreview(null); setCapturedPhoto(null); }} className={styles.changeBtn}>Excluir e tirar outra foto</button>
                                </div>
                            ) : (
                                <label className={styles.captureBtnHuge}>
                                    <span className={styles.cameraIcon}>📷</span>
                                    <span>Tirar Foto da Placa</span>
                                    <p>Obrigatório para finalizar</p>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handlePhotoCapture}
                                        hidden
                                    />
                                </label>
                            )}
                        </div>

                        <div className={styles.formGroup}>
                            <label>Observações Adicionais</label>
                            <textarea
                                placeholder="Alguma observação importante sobre esta casa?"
                                value={obs}
                                onChange={(e) => setObs(e.target.value)}
                                className={styles.textarea}
                            />
                        </div>

                        <button
                            onClick={handleFinish}
                            className={styles.finishBtnFull}
                            disabled={uploading || !capturedPhoto}
                        >
                            {uploading ? 'Enviando Dados...' : linkingAgendamento ? 'VINCULAR E FINALIZAR' : 'FINALIZAR INSTALAÇÃO'}
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <h1>Painel do Instalador</h1>
                        <button onClick={handleLogout} className={styles.logoutTextButton}>Sair</button>
                    </div>
                    <button onClick={handleGpsSearch} className={styles.gpsButton}>
                        📍 Estou no Local
                    </button>
                </div>
                <nav className={styles.nav}>
                    <button
                        className={view === 'map' ? styles.activeNav : ''}
                        onClick={() => { setView('map'); setLinkingAgendamento(null); }}
                    >
                        Mapa
                    </button>
                    <button
                        className={view === 'list' ? styles.activeNav : ''}
                        onClick={() => { setView('list'); setLinkingAgendamento(null); }}
                    >
                        Agenda
                    </button>
                </nav>
            </header>

            <main className={styles.content}>
                {view === 'map' && (
                    <InstallerMap
                        properties={properties}
                        onEdit={(p) => setSelectedForProcess(p)}
                    />
                )}

                {view === 'gps' && (
                    <div className={styles.gpsView}>
                        <h2> {linkingAgendamento ? 'Escolha o imóvel para vincular' : 'Imóveis Próximos (Raio 80m)'} </h2>
                        {linkingAgendamento && (
                            <p className={styles.subtext}>Abaixo estão os imóveis perto de você agora.</p>
                        )}
                        {loadingGps ? (
                            <p>Buscando sua localização...</p>
                        ) : candidates.length > 0 ? (
                            <div className={styles.candidateList}>
                                {candidates.map(candidate => (
                                    <div key={candidate.inscimob} className={styles.candidateCard}>
                                        <div className={styles.candidateInfo}>
                                            <h3>Nº {candidate.numeroAInstalar}</h3>
                                            <p>{candidate.bairro.nome} - ID: {candidate.inscimob}</p>
                                            <span className={styles.distance}>a {Math.round(candidate.distance)}m de você</span>
                                        </div>
                                        <button
                                            className={styles.openButton}
                                            onClick={() => setSelectedForProcess(candidate)}
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
                                                🗺️
                                            </a>
                                            <button
                                                className={styles.openButton}
                                                onClick={() => {
                                                    if (ag.inscimobVinculo) {
                                                        const target = properties.find(p => p.inscimob === ag.inscimobVinculo);
                                                        if (target) setSelectedForProcess(target);
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
        </div>
    );
}
