import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Painel.module.css';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { utmToLatLng } from '@/utils/geo';
import { statusLabel, whatsappLink } from '@/utils/status';
import { toast } from '@/utils/toast';
import { CloudOff, Sun, X } from 'lucide-react';
import ImovelInfoModal from '@/components/ImovelInfoModal';
import { BR_TIMEZONE } from '@/lib/timezone';
import { apiGetComCache } from '@/lib/cache';
import { alternarContraste, contrasteAlto } from '@/lib/contraste';
import ResumoDia from '@/components/ResumoDia';

const InstallerMap = lazy(() => import('@/components/InstallerMap'));

export default function InstallerDashboard() {
    const navigate = useNavigate();
    const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loadingGps, setLoadingGps] = useState(false);
    const [view, setView] = useState<'map' | 'list' | 'gps' | 'search'>('map');
    const [properties, setProperties] = useState<any[]>([]);
    const [agendamentosList, setAgendamentosList] = useState<any[]>([]);
    const [agendaFilter, setAgendaFilter] = useState<'proximos' | 'hoje' | 'atrasados' | 'todos' | 'concluidos'>('proximos');
    const [agendaData, setAgendaData] = useState(''); // filtro por dia (YYYY-MM-DD)
    const [agendaStats, setAgendaStats] = useState({ totalPendentes: 0, totalHoje: 0, totalAtrasados: 0 });
    const [imovelInfo, setImovelInfo] = useState<{ inscimob: string; agendamento?: any } | null>(null);
    const [loadingAgenda, setLoadingAgenda] = useState(false);
    const agendaReqId = useRef(0); // descarta respostas antigas quando o filtro muda rápido
    const [searchRadius, setSearchRadius] = useState<number>(80);

    // Estados para Busca de Imóvel por Inscrição
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);

    // Estados para o Processo de Conclusão (Nova Tela)
    const [linkingAgendamento, setLinkingAgendamento] = useState<any | null>(null);
    const [user, setUser] = useState<any>(null);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [offline, setOffline] = useState(false);
    const [modoSol, setModoSol] = useState(contrasteAlto());

    // Efeito para busca por inscrição / número com debounce e filtro local instantâneo
    useEffect(() => {
        const query = searchQuery.trim();
        if (!query) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        // Filtro local instantâneo (resposta imediata se os imóveis já estiverem em memória)
        const qLower = query.toLowerCase();
        const localMatches = properties.filter((p: any) =>
            p.inscimob?.toLowerCase().includes(qLower) ||
            p.numeroAInstalar?.toLowerCase().includes(qLower) ||
            p.endereco?.toLowerCase().includes(qLower)
        );
        setSearchResults(localMatches);
        setSearching(true);

        const timer = setTimeout(async () => {
            try {
                const res = await apiFetch(`/api/instalador/buscar?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    const serverMatches = data.imoveis || [];

                    // Mesclar sem duplicatas
                    setSearchResults(() => {
                        const map = new Map<string, any>();
                        serverMatches.forEach((item: any) => map.set(item.inscimob, item));
                        localMatches.forEach((item: any) => {
                            if (!map.has(item.inscimob)) {
                                map.set(item.inscimob, item);
                            }
                        });
                        return Array.from(map.values());
                    });
                }
            } catch (err) {
                console.error("Erro ao buscar imóveis:", err);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, properties]);

    useEffect(() => {
        if (view === 'list') {
            fetchAgenda(agendaFilter, agendaData);
        }
    }, [view, agendaFilter, agendaData]);

    async function fetchAgenda(filterToUse = agendaFilter, dataToUse = agendaData) {
        const reqId = ++agendaReqId.current;
        setLoadingAgenda(true);
        try {
            const params = new URLSearchParams({ filter: filterToUse });
            if (dataToUse) params.set('data', dataToUse);
            const { dados: data, offline: semInternet } = await apiGetComCache(`/api/instalador/agenda?${params.toString()}`);
            if (reqId !== agendaReqId.current) return;
            setOffline(semInternet);
            setAgendamentosList(data.agendamentos || []);
            if (data.totalPendentes !== undefined) {
                setAgendaStats({
                    totalPendentes: data.totalPendentes,
                    totalHoje: data.totalHoje,
                    totalAtrasados: data.totalAtrasados || 0
                });
            }
        } catch (e: any) {
            console.error("Erro ao carregar agenda:", e);
            if (reqId === agendaReqId.current) toast.error(e.message || 'Erro ao carregar a agenda.');
        } finally {
            if (reqId === agendaReqId.current) setLoadingAgenda(false);
        }
    }

    const formatAgendaDate = (dataHora: string | null) => {
        if (!dataHora) return { hour: '--:--', dateStr: 'A Definir', isHoje: false };
        const d = new Date(dataHora);
        const now = new Date();
        const isHoje = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isAmanha = d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();

        const hour = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let dateStr = d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
        if (isHoje) dateStr = 'Hoje';
        else if (isAmanha) dateStr = 'Amanhã';

        return { hour, dateStr, isHoje };
    };

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
        try {
            const { dados, offline: semInternet } = await apiGetComCache('/api/instalador/imoveis');
            setOffline(semInternet);
            setProperties(dados.imoveis || []);
        } catch (e: any) {
            toast.error(e.message || 'Erro ao carregar os imóveis.');
        }
    }

    // `radius` explícito evita usar o valor antigo do estado logo após trocar o raio
    const handleGpsSearch = (silent = false, radius = searchRadius) => {
        if (!navigator.geolocation) {
            if (!silent) toast.error("GPS não suportado pelo navegador.");
            return;
        }

        setLoadingGps(true);
        if (!silent) setView('gps');

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            setLocation({ lat: latitude, lon: longitude });

            try {
                const res = await apiFetch(`/api/instalador/proximos?lat=${latitude}&lon=${longitude}&radius=${radius}`);
                const data = await res.json();
                setCandidates(data.candidates || []);
            } catch (e) {
                if (!silent) toast.error("Erro ao buscar imóveis próximos.");
            } finally {
                setLoadingGps(false);
            }
        }, (err) => {
            // Na ativação automática (silenciosa) não incomoda o usuário com erro de GPS
            if (!silent) {
                toast.error(err.code === err.PERMISSION_DENIED
                    ? "Permita o acesso à localização nas configurações do navegador."
                    : "Não foi possível obter sua localização. Tente novamente.");
            }
            setLoadingGps(false);
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
    };

    const handleProcess = (property: any) => {
        if (linkingAgendamento) {
            navigate(`/imovel/${property.inscimob}?agendamento=${linkingAgendamento.protocolo}&nome=${encodeURIComponent(linkingAgendamento.nome)}&telefone=${encodeURIComponent(linkingAgendamento.telefone)}`);
        } else {
            navigate(`/imovel/${property.inscimob}`);
        }
    };

    const abrirInstalacao = (inscimob: string, ag: any) => {
        navigate(`/imovel/${inscimob}?agendamento=${ag.protocolo}&nome=${encodeURIComponent(ag.nome || '')}&telefone=${encodeURIComponent(ag.telefone || '')}`);
    };

    const mensagemWhatsapp = (ag: any, numero?: string) => {
        const data = ag.dataHora
            ? new Date(ag.dataHora).toLocaleString('pt-BR', { timeZone: BR_TIMEZONE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            : null;
        // "Morador / Prefeitura" é o nome padrão de quando a prefeitura não informou o morador
        const primeiroNome = ag.nome && !/^morador\b/i.test(ag.nome) ? ag.nome.split(' ')[0] : '';
        return `Olá${primeiroNome ? `, ${primeiroNome}` : ''}! Sou o instalador da numeração predial da Prefeitura.`
            + ` Estou entrando em contato sobre a instalação do número${numero ? ` ${numero}` : ' da sua residência'}`
            + `${data ? `, agendada para ${data.replace(',', ' às')}` : ''} (protocolo ${ag.protocolo}).`;
    };

    const handleViewOnMap = (property: any) => {
        if (property?.x && property?.y) {
            setProperties(prev => {
                if (prev.some(p => p.inscimob === property.inscimob)) return prev;
                return [...prev, property];
            });
            setMapFocus([property.x, property.y]);
            setView('map');
        } else {
            toast.error("Este imóvel não possui coordenadas de mapa cadastradas.");
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <h1>Painel do Instalador</h1>
                        <p>{user?.user_metadata?.name || user?.email}</p>
                    </div>
                    <div className={styles.headerAcoes}>
                    <button
                        onClick={() => setModoSol(alternarContraste())}
                        className={`${styles.solBtn} ${modoSol ? styles.solAtivo : ''}`}
                        aria-pressed={modoSol}
                        aria-label="Modo sol: letras maiores e mais contraste"
                        title="Modo sol"
                    >
                        <Sun size={22} strokeWidth={2.5} />
                    </button>
                    <button onClick={handleLogout} className={styles.logoutBtn} aria-label="Sair" title="Sair">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                    </button>
                    </div>
                </div>
                <ResumoDia />
                {offline && (
                    <div className={styles.offlineAviso}>
                        <CloudOff size={15} /> Sem internet: mostrando dados guardados no celular.
                    </div>
                )}
            </header>

            <main className={styles.content}>
                {view === 'map' && (
                    <Suspense fallback={<div className={styles.loader}>Carregando Mapa...</div>}>
                        <InstallerMap
                            properties={properties}
                            focusOn={mapFocus}
                            userLocation={location}
                            onEdit={(p) => handleProcess(p)}
                        />
                    </Suspense>
                )}

                {view === 'search' && (
                    <div className={styles.searchView}>
                        {linkingAgendamento && (
                            <div className={styles.linkingAlert}>
                                <div><strong>Vinculando Agendamento:</strong> {linkingAgendamento.nome} ({linkingAgendamento.protocolo})</div>
                                <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>{linkingAgendamento.enderecoCompleto}</div>
                                <button
                                    onClick={() => setLinkingAgendamento(null)}
                                    style={{ marginTop: '6px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cancelar Vínculo
                                </button>
                            </div>
                        )}

                        <div className={styles.searchHeader}>
                            <h2>Buscar Imóvel por Inscrição</h2>
                            <p>Digite a inscrição imobiliária (INSCIMOB) ou número da residência</p>
                        </div>

                        <div className={styles.searchBarWrapper}>
                            <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="search"
                                enterKeyHint="search"
                                aria-label="Buscar imóvel por inscrição ou número"
                                className={styles.searchInput}
                                placeholder="Digite a inscrição (ex: 01.02.003...) ou número"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className={styles.clearSearchBtn}
                                    onClick={() => setSearchQuery('')}
                                    aria-label="Limpar busca"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {searchQuery.trim() !== '' && (
                            <div className={styles.searchStats}>
                                <span>{searchResults.length} {searchResults.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}</span>
                                {searching && <span>Buscando no banco...</span>}
                            </div>
                        )}

                        {searchQuery.trim() === '' ? (
                            <div className={styles.emptySearchState}>
                                <svg className={styles.emptySearchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    <line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                                <h3>Digite a Inscrição para Pesquisar</h3>
                                <p>Informe a inscrição imobiliária completa ou parcial para localizar o cadastro do imóvel rapidamente.</p>
                            </div>
                        ) : searchResults.length > 0 ? (
                            <div className={styles.candidateList}>
                                {searchResults.map((imovel) => (
                                    <div key={imovel.inscimob} className={styles.candidateCard}>
                                        <div className={styles.candidateInfo}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                                <span className={styles.inscBadge}>Insc: {imovel.inscimob}</span>
                                                <span className={`${styles.statusPill} ${styles[imovel.status]}`}>
                                                    {statusLabel(imovel.status)}
                                                </span>
                                                {imovel.complementos && imovel.complementos.length > 0 && (
                                                    <span className={styles.complementoBadge}>
                                                        +{imovel.complementos.length} compl.
                                                    </span>
                                                )}
                                            </div>
                                            <h3>Nº {imovel.numeroAInstalar}</h3>
                                            <p>{imovel.bairro?.nome || 'Bairro'}{imovel.endereco ? ` • ${imovel.endereco}` : ''}</p>
                                        </div>
                                        <div className={styles.cardActions} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            <button
                                                className={styles.openButton}
                                                onClick={() => handleProcess(imovel)}
                                            >
                                                {linkingAgendamento ? 'Vincular Este' : 'Instalar / Concluir'}
                                            </button>
                                            {imovel.x && imovel.y && (
                                                <button
                                                    type="button"
                                                    className={styles.mapSmallButton}
                                                    onClick={() => handleViewOnMap(imovel)}
                                                >
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                                        <circle cx="12" cy="10" r="3" />
                                                    </svg>
                                                    Ver no Mapa
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : !searching ? (
                            <div className={styles.emptySearchState}>
                                <svg className={styles.emptySearchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="8" y1="12" x2="16" y2="12" />
                                </svg>
                                <h3>Nenhum imóvel encontrado</h3>
                                <p>Não encontramos nenhum imóvel com a inscrição ou número &ldquo;{searchQuery}&rdquo;. Verifique os dígitos e tente novamente.</p>
                            </div>
                        ) : (
                            <p className={styles.loadingText}>Buscando imóvel...</p>
                        )}
                    </div>
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
                                        aria-pressed={searchRadius === r}
                                        onClick={() => {
                                            setSearchRadius(r);
                                            handleGpsSearch(false, r);
                                        }}
                                    >
                                        {r >= 1000 ? (r / 1000) + 'km' : r + 'm'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {linkingAgendamento && (
                            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                <p className={styles.subtext} style={{ marginBottom: '0.5rem' }}>Abaixo estão os imóveis perto de você agora.</p>
                                <button
                                    type="button"
                                    onClick={() => setView('search')}
                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '0.45rem 0.9rem', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                    Ou buscar imóvel por Inscrição
                                </button>
                            </div>
                        )}
                        {loadingGps ? (
                            <p className={styles.loadingText} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                                    <path d="M2 12h20" />
                                </svg>
                                Buscando sua localização e imóveis...
                            </p>
                        ) : candidates.length > 0 ? (
                            <div className={styles.candidateList}>
                                {candidates.map(candidate => (
                                    <div key={candidate.inscimob} className={styles.candidateCard}>
                                        <div className={styles.candidateInfo}>
                                            <h3>Nº {candidate.numeroAInstalar}</h3>
                                            <p>{candidate.bairro?.nome} - ID: {candidate.inscimob}</p>
                                            <span className={styles.distance}>a {Math.round(candidate.distance)}m de você</span>
                                            <span className={`${styles.statusPill} ${styles[candidate.status]}`}>
                                                {statusLabel(candidate.status)}
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
                            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                <p style={{ color: '#64748b', marginBottom: '0.75rem' }}>Nenhum imóvel encontrado por perto.</p>
                                <button
                                    type="button"
                                    onClick={() => setView('search')}
                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0.6rem 1.2rem', background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                    Buscar imóvel por Inscrição
                                </button>
                            </div>
                        )}
                        <button onClick={() => { setView('map'); setLinkingAgendamento(null); setMapFocus(null); }} className={styles.backButton} style={{ marginTop: '2rem', padding: '1rem', width: '100%', background: '#f1f5f9', border: 'none', borderRadius: '10px', fontWeight: '700' }}>Cancelar e Voltar</button>
                    </div>
                )}

                {view === 'list' && (
                    <div className={styles.agendaView}>
                        <div className={styles.agendaHeader}>
                            <h2>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                Agenda de Instalações
                            </h2>
                            <p>Organizada pela ordem da próxima instalação a ser realizada</p>
                        </div>

                        {/* Filtros da Agenda */}
                        <div className={styles.agendaTabs}>
                            <button
                                className={`${styles.agendaTab} ${agendaFilter === 'proximos' ? styles.activeAgendaTab : ''}`}
                                onClick={() => setAgendaFilter('proximos')}
                            >
                                <span>Próximas Instalações</span>
                                {agendaStats.totalPendentes > 0 && (
                                    <span className={styles.tabBadge}>{agendaStats.totalPendentes}</span>
                                )}
                            </button>
                            <button
                                className={`${styles.agendaTab} ${agendaFilter === 'hoje' ? styles.activeAgendaTab : ''}`}
                                onClick={() => setAgendaFilter('hoje')}
                            >
                                <span>Hoje</span>
                                {agendaStats.totalHoje > 0 && (
                                    <span className={styles.tabBadge}>{agendaStats.totalHoje}</span>
                                )}
                            </button>
                            <button
                                className={`${styles.agendaTab} ${styles.agendaTabDanger} ${agendaFilter === 'atrasados' ? styles.activeAgendaTabDanger : ''}`}
                                onClick={() => setAgendaFilter('atrasados')}
                                aria-pressed={agendaFilter === 'atrasados'}
                            >
                                <span>Atrasadas</span>
                                {agendaStats.totalAtrasados > 0 && (
                                    <span className={styles.tabBadge}>{agendaStats.totalAtrasados}</span>
                                )}
                            </button>
                            <button
                                className={`${styles.agendaTab} ${agendaFilter === 'todos' ? styles.activeAgendaTab : ''}`}
                                onClick={() => setAgendaFilter('todos')}
                            >
                                <span>Todas</span>
                            </button>
                            <button
                                className={`${styles.agendaTab} ${agendaFilter === 'concluidos' ? styles.activeAgendaTab : ''}`}
                                onClick={() => setAgendaFilter('concluidos')}
                            >
                                <span>Concluídas</span>
                            </button>
                        </div>

                        {/* Filtro por dia (combina com a aba selecionada) */}
                        <div className={styles.agendaDateFilter}>
                            <label htmlFor="agenda-data">
                                {agendaFilter === 'concluidos' ? 'Concluídas no dia' : 'Agendadas para o dia'}
                            </label>
                            <div className={styles.agendaDateControls}>
                                <input
                                    id="agenda-data"
                                    type="date"
                                    className={styles.agendaDateInput}
                                    value={agendaData}
                                    onChange={e => setAgendaData(e.target.value)}
                                />
                                {agendaData && (
                                    <button
                                        type="button"
                                        className={styles.agendaDateClear}
                                        onClick={() => setAgendaData('')}
                                        aria-label="Limpar filtro de data"
                                    >
                                        <X size={16} /> Limpar
                                    </button>
                                )}
                            </div>
                        </div>

                        {!loadingAgenda && (
                            <p className={styles.agendaCount} aria-live="polite">
                                {agendamentosList.length} {agendamentosList.length === 1 ? 'agendamento' : 'agendamentos'}
                                {agendaData && ` em ${agendaData.split('-').reverse().join('/')}`}
                            </p>
                        )}

                        {loadingAgenda ? (
                            <p className={styles.loadingText} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 6v6l4 2" />
                                </svg>
                                Carregando agenda ordenada...
                            </p>
                        ) : agendamentosList.length > 0 ? (
                            <div className={styles.agendaList}>
                                {agendamentosList.map(ag => {
                                    const targetImovel = ag.imovel;
                                    const { hour, dateStr, isHoje } = formatAgendaDate(ag.dataHora);
                                    const isDone = ag.status === 'CONCLUIDO';
                                    const displayStatus = isDone ? 'CONCLUIDO' : (targetImovel?.status || ag.status);
                                    const numeroImovel = targetImovel?.numeroAInstalar || ag.numero || ag.enderecoCompleto?.match(/Nº\s*([^\s-]+)/)?.[1];
                                    const waLink = whatsappLink(ag.telefone, mensagemWhatsapp(ag, numeroImovel));
                                    const inscAgendamento = targetImovel?.inscimob || ag.inscimobVinculo;

                                    return (
                                        <div
                                            key={ag.protocolo}
                                            className={`${styles.agendaCard} ${ag.proximaInstalacao ? styles.agendaCardProxima : ''}`}
                                        >
                                            {ag.proximaInstalacao && (
                                                <div className={styles.proximaRibbon}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <circle cx="12" cy="12" r="6" />
                                                        <circle cx="12" cy="12" r="2" />
                                                    </svg>
                                                    Próxima Instalação
                                                </div>
                                            )}

                                            <div className={styles.agendaCardTop}>
                                                <div className={styles.agendaTimeBadge}>
                                                    <span className={styles.timeHour}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <polyline points="12 6 12 12 16 14" />
                                                        </svg>
                                                        {hour}
                                                    </span>
                                                    <span className={`${styles.timeDate} ${isHoje ? styles.hojeBadge : ''}`}>
                                                        {dateStr}
                                                    </span>
                                                    {ag.isAtrasado && (
                                                        <span className={styles.atrasadoPill}>Atrasado</span>
                                                    )}
                                                </div>

                                                <div className={styles.agendaCardBody}>
                                                    <div className={styles.agendaMetaRow}>
                                                        <span className={styles.protocolBadge}>{ag.protocolo}</span>
                                                        <span className={`${styles.statusPill} ${styles[displayStatus]}`}>
                                                            {statusLabel(displayStatus)}
                                                        </span>
                                                        {inscAgendamento && (
                                                            <button
                                                                type="button"
                                                                className={`${styles.inscBadge} ${styles.inscBadgeBtn}`}
                                                                onClick={() => setImovelInfo({ inscimob: inscAgendamento, agendamento: ag })}
                                                                title="Ver informações do imóvel"
                                                            >
                                                                Insc: {inscAgendamento}
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                    <circle cx="12" cy="12" r="10" />
                                                                    <line x1="12" y1="16" x2="12" y2="12" />
                                                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>

                                                    <h3 className={styles.agendaNumeroInstalar}>
                                                        Nº {numeroImovel || 'S/N'}
                                                    </h3>

                                                    <p className={styles.agendaAddress}>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#64748b' }}>
                                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                                            <circle cx="12" cy="10" r="3" />
                                                        </svg>
                                                        <span>
                                                            {targetImovel?.bairro?.nome ? `${targetImovel.bairro.nome} - ` : ''}
                                                            {targetImovel?.endereco || ag.enderecoCompleto}
                                                        </span>
                                                    </p>

                                                    {ag.nome && (
                                                        <p className={styles.agendaResident}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                                <circle cx="12" cy="7" r="4" />
                                                            </svg>
                                                            <span>{ag.nome}</span>
                                                            {ag.telefone && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                                                                    </svg>
                                                                    {ag.telefone}
                                                                </span>
                                                            )}
                                                        </p>
                                                    )}

                                                    {targetImovel?.complementos && targetImovel.complementos.length > 0 && (
                                                        <div style={{ marginTop: '2px' }}>
                                                            <span className={styles.complementoBadge}>
                                                                +{targetImovel.complementos.length} unidades complementares
                                                            </span>
                                                        </div>
                                                    )}

                                                    {targetImovel?.obsPendente && (
                                                        <div className={styles.agendaObservation}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                                                                <circle cx="12" cy="12" r="10" />
                                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                                            </svg>
                                                            <span><strong>Obs:</strong> {targetImovel.obsPendente}</span>
                                                        </div>
                                                    )}

                                                    {targetImovel?.fotoLocalInstalacao && (
                                                        <div
                                                            className={styles.orientationPhotoPreview}
                                                            onClick={() => setFullScreenImage(targetImovel.fotoLocalInstalacao)}
                                                            title="Ver foto de orientação em tela cheia"
                                                        >
                                                            <img src={targetImovel.fotoLocalInstalacao} alt="Orientação" />
                                                            <span>Ver Foto de Orientação da Prefeitura</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={styles.agendaActions}>
                                                <button
                                                    className={styles.agendaPrimaryBtn}
                                                    onClick={() => {
                                                        if (inscAgendamento) {
                                                            abrirInstalacao(inscAgendamento, ag);
                                                        } else {
                                                            setLinkingAgendamento(ag);
                                                            handleGpsSearch();
                                                        }
                                                    }}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                    {isDone ? 'Ver / Reabrir' : 'Instalar / Concluir'}
                                                </button>

                                                {targetImovel?.x && targetImovel?.y && (
                                                    <button
                                                        type="button"
                                                        className={styles.agendaIconBtn}
                                                        onClick={() => handleViewOnMap(targetImovel)}
                                                        title="Ver no Mapa"
                                                    >
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                                            <circle cx="12" cy="10" r="3" />
                                                        </svg>
                                                        <span>Mapa</span>
                                                    </button>
                                                )}

                                                <a
                                                    href={targetImovel?.x && targetImovel?.y
                                                        ? (() => {
                                                            const [lat, lng] = utmToLatLng(targetImovel.x, targetImovel.y);
                                                            return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                                        })()
                                                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ag.enderecoCompleto)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={styles.agendaIconBtn}
                                                    title="Navegar no Google Maps"
                                                >
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                                    </svg>
                                                    <span>Rota GPS</span>
                                                </a>

                                                {waLink && (
                                                    <a
                                                        href={waLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={styles.agendaWhatsappBtn}
                                                        title="Chamar no WhatsApp"
                                                    >
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                        </svg>
                                                        <span>WhatsApp</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className={styles.emptySearchState}>
                                <svg className={styles.emptySearchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                <h3>{agendaFilter === 'atrasados' && !agendaData ? 'Nenhuma instalação atrasada' : 'Nenhum agendamento encontrado'}</h3>
                                <p>
                                    {agendaData
                                        ? `Não há instalações neste filtro para ${agendaData.split('-').reverse().join('/')}.`
                                        : 'Não há instalações agendadas para o filtro selecionado no momento.'}
                                </p>
                                {agendaData && (
                                    <button type="button" className={styles.agendaDateClear} style={{ marginTop: '1rem' }} onClick={() => setAgendaData('')}>
                                        <X size={16} /> Limpar filtro de data
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Navegação no rodapé: ao alcance do polegar */}
            <nav className={styles.nav}>
                <button
                    className={`${view === 'map' ? styles.activeNav : ''}`}
                    onClick={() => { setView('map'); setLinkingAgendamento(null); setMapFocus(null); }}
                >
                    <svg width="22" height="22" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                    </svg>
                    Mapa
                </button>
                <button
                    className={`${view === 'list' ? styles.activeNav : ''}`}
                    onClick={() => { setView('list'); setLinkingAgendamento(null); }}
                >
                    <svg width="22" height="22" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                    <svg width="22" height="22" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v3m0 14v3m-7-10H2m17 0h3" />
                    </svg>
                    Local
                </button>
                <button
                    className={`${view === 'search' ? styles.activeNav : ''}`}
                    onClick={() => setView('search')}
                >
                    <svg width="22" height="22" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Buscar
                </button>
            </nav>

            {imovelInfo && (
                <ImovelInfoModal
                    inscimob={imovelInfo.inscimob}
                    initial={imovelInfo.agendamento?.imovel}
                    onClose={() => setImovelInfo(null)}
                    actions={imovelInfo.agendamento && (
                        <button
                            type="button"
                            className={styles.agendaPrimaryBtn}
                            onClick={() => abrirInstalacao(imovelInfo.inscimob, imovelInfo.agendamento)}
                        >
                            {imovelInfo.agendamento.status === 'CONCLUIDO' ? 'Ver / Reabrir' : 'Instalar / Concluir'}
                        </button>
                    )}
                />
            )}

            {fullScreenImage && (
                <div className="lightbox" role="dialog" aria-label="Foto em tela cheia" onClick={() => setFullScreenImage(null)}>
                    <img src={fullScreenImage} alt="Foto de orientação da prefeitura" />
                    <button type="button" className="lightbox-close" aria-label="Fechar foto"><X size={22} /></button>
                </div>
            )}
        </div>
    );
}
