import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import styles from './Imovel.module.css';
import { compressImage } from '@/utils/imageCompressor';
import { parseFotos } from '@/utils/fotos';
import { toast } from '@/utils/toast';
import { MOTIVOS_PENDENCIA, montarObsPendente, separarObsPendente } from '@/utils/motivosPendencia';
import { apiGetComCache } from '@/lib/cache';
import { adicionarNaFila, itensFila, processarFila } from '@/lib/fila';
import { distanciaAteImovel, formatarDistancia, obterPosicao } from '@/lib/gps';
import { apagarRascunho, lerRascunho, salvarRascunho, type InfoFoto } from '@/lib/rascunho';
import { vibrar } from '@/lib/vibrar';
import { AlertTriangle, CloudOff, Loader2, MapPin, X } from 'lucide-react';

// Acima disso a foto provavelmente não foi tirada em frente ao imóvel
const DISTANCIA_ALERTA_M = 100;

const dataHoraBR = (ms: number) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ImovelDetalhesPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const agendamento = searchParams.get('agendamento');
    const nomeMorador = searchParams.get('nome');

    const [imovel, setImovel] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingStep, setSavingStep] = useState('');
    const [offline, setOffline] = useState(false);
    const [aguardandoEnvio, setAguardandoEnvio] = useState(false);
    const [rascunhoRecuperado, setRascunhoRecuperado] = useState<number | null>(null);
    const [processandoFotos, setProcessandoFotos] = useState(0);

    // Status e Foto do Número Principal
    const [statusMain, setStatusMain] = useState<'CONCLUIDO' | 'PENDENTE'>('CONCLUIDO');
    const [motivo, setMotivo] = useState('');
    const [obs, setObs] = useState('');
    const [obsInstalacao, setObsInstalacao] = useState('');
    // Observação já salva no servidor (rascunho só é gravado se o instalador mudar)
    const obsInstalacaoSalva = useRef('');
    const [photoMain, setPhotoMain] = useState<Blob | null>(null);
    const [photoMainPreview, setPhotoMainPreview] = useState<string | null>(null);
    const [photoMainInfo, setPhotoMainInfo] = useState<InfoFoto | null>(null);

    // Complementos: fotos novas, previews, status, seleção e número predial editável (key = complemento id)
    const [compPhotos, setCompPhotos] = useState<Record<string, Blob | null>>({});
    const [compPreviews, setCompPreviews] = useState<Record<string, string | null>>({});
    const [compInfo, setCompInfo] = useState<Record<string, InfoFoto | null>>({});
    const [compStatuses, setCompStatuses] = useState<Record<string, 'CONCLUIDO' | 'PENDENTE'>>({});
    const [compIncluded, setCompIncluded] = useState<Record<string, boolean>>({});
    const [compNumeroPredial, setCompNumeroPredial] = useState<Record<string, string>>({});

    // Rascunho só começa a ser gravado depois de carregar (senão apagaria o salvo com o formulário vazio)
    const rascunhoPronto = useRef(false);

    // Modal e Seleção de Foto (Câmera ou Arquivos de Mídia)
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const [photoModalTarget, setPhotoModalTarget] = useState<{
        type: 'main' | 'comp';
        compId?: string;
        title: string;
    } | null>(null);
    const photoModalTargetRef = useRef<{
        type: 'main' | 'comp';
        compId?: string;
        title: string;
    } | null>(null);

    const openPhotoPicker = (type: 'main' | 'comp', compId?: string, title: string = '') => {
        const target = { type, compId, title };
        photoModalTargetRef.current = target;
        setPhotoModalTarget(target);
    };

    const handleSelectOption = (source: 'camera' | 'gallery') => {
        setPhotoModalTarget(null);
        if (source === 'camera') {
            if (cameraInputRef.current) {
                cameraInputRef.current.value = '';
                cameraInputRef.current.click();
            }
        } else {
            if (galleryInputRef.current) {
                galleryInputRef.current.value = '';
                galleryInputRef.current.click();
            }
        }
    };

    /**
     * Foto escolhida: pega o GPS, mede a distância até o imóvel e grava na imagem
     * o número, a data/hora e as coordenadas (a foto já fica reduzida para o envio).
     */
    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>, galeria: boolean) => {
        const file = e.target.files?.[0] || null;
        if (!file) return;

        const target = photoModalTargetRef.current;
        if (!target) return;

        setProcessandoFotos(n => n + 1);
        try {
            const gps = await obterPosicao(8000);
            const distancia = gps ? distanciaAteImovel(gps, imovel) : null;
            const numero = target.type === 'comp' && target.compId
                ? `${imovel.numeroAInstalar} - ${compNumeroPredial[target.compId] || ''}`
                : imovel.numeroAInstalar;
            const quando = galeria ? (file.lastModified || Date.now()) : Date.now();
            const carimbo = [
                `Nº ${numero} • Inscr. ${imovel.inscimob}`,
                `${dataHoraBR(quando)}${galeria ? ' (foto da galeria)' : ''}`,
                gps ? `GPS ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}${gps.precisao ? ` ±${Math.round(gps.precisao)} m` : ''}` : 'GPS indisponível',
            ];
            const foto = await compressImage(file, 1280, 0.72, carimbo).catch(() => file);
            const info: InfoFoto = { gps, distancia, galeria };

            if (distancia != null && distancia > DISTANCIA_ALERTA_M) vibrar('aviso');
            else vibrar('leve');

            if (target.type === 'main') {
                handleMainPhotoChange(foto, info);
            } else if (target.type === 'comp' && target.compId) {
                handleCompPhotoChange(target.compId, foto, info);
            }
        } finally {
            setProcessandoFotos(n => n - 1);
        }
    };

    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                let dados: any = null;
                let semInternet = false;
                try {
                    const r = await apiGetComCache(`/api/instalador/imovel/${id}`);
                    dados = r.dados?.imovel;
                    semInternet = r.offline;
                } catch (e: any) {
                    // Sem conexão com o servidor e sem a ficha salva: usa a lista de imóveis guardada para o mapa
                    if (e?.http) throw e;
                    const lista = await apiGetComCache('/api/instalador/imoveis').catch(() => null);
                    dados = lista?.dados?.imoveis?.find((i: any) => i.inscimob === id) || null;
                    semInternet = true;
                    if (!dados) throw e;
                }
                setOffline(semInternet);
                setImovel(dados);

                const pendencia = separarObsPendente(dados?.obsPendente, dados?.motivoPendencia);
                if (dados?.status === 'PENDENTE') {
                    setStatusMain('PENDENTE');
                    setMotivo(pendencia.motivo);
                    setObs(pendencia.detalhe);
                } else {
                    setStatusMain('CONCLUIDO');
                }
                obsInstalacaoSalva.current = dados?.obsInstalacao || '';
                setObsInstalacao(obsInstalacaoSalva.current);

                // Inicializar estados de TODOS os complementos (tanto a instalar quanto já concluídos)
                const initialCompPhotos: Record<string, Blob | null> = {};
                const initialCompPreviews: Record<string, string | null> = {};
                const initialCompStatuses: Record<string, 'CONCLUIDO' | 'PENDENTE'> = {};
                const initialCompIncluded: Record<string, boolean> = {};
                const initialCompNumeroPredial: Record<string, string> = {};

                if (dados?.complementos) {
                    dados.complementos.forEach((c: any) => {
                        initialCompPhotos[c.id] = null;
                        initialCompPreviews[c.id] = null;
                        initialCompStatuses[c.id] = c.status === 'PENDENTE' ? 'PENDENTE' : 'CONCLUIDO';
                        initialCompIncluded[c.id] = false;
                        initialCompNumeroPredial[c.id] = c.numeroPredial || '';
                    });
                }

                // Rascunho salvo no celular (app fechado ou travado no meio do registro)
                const r = id ? await lerRascunho(id) : undefined;
                if (r) {
                    setStatusMain(r.statusMain);
                    setMotivo(r.motivo);
                    setObs(r.obs);
                    if (r.obsInstalacao != null) setObsInstalacao(r.obsInstalacao);
                    if (r.photoMain) {
                        setPhotoMain(r.photoMain);
                        setPhotoMainPreview(URL.createObjectURL(r.photoMain));
                        setPhotoMainInfo(r.photoMainInfo);
                    }
                    for (const compId of Object.keys(initialCompPhotos)) {
                        const foto = r.compPhotos[compId];
                        if (foto) {
                            initialCompPhotos[compId] = foto;
                            initialCompPreviews[compId] = URL.createObjectURL(foto);
                        }
                        if (r.compStatuses[compId]) initialCompStatuses[compId] = r.compStatuses[compId];
                        if (r.compIncluded[compId]) initialCompIncluded[compId] = true;
                        if (r.compNumeroPredial[compId] != null) initialCompNumeroPredial[compId] = r.compNumeroPredial[compId];
                    }
                    setCompInfo(r.compInfo || {});
                    setRascunhoRecuperado(r.salvoEm);
                }

                setCompPhotos(initialCompPhotos);
                setCompPreviews(initialCompPreviews);
                setCompStatuses(initialCompStatuses);
                setCompIncluded(initialCompIncluded);
                setCompNumeroPredial(initialCompNumeroPredial);

                const fila = await itensFila();
                setAguardandoEnvio(fila.some(i => i.inscimob === id));
                rascunhoPronto.current = true;
            } catch (e: any) {
                console.error("Erro ao carregar dados", e);
                toast.error(e.message || 'Erro ao carregar o imóvel.');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

    // Grava o rascunho a cada alteração (com pequena espera para não gravar a cada letra)
    useEffect(() => {
        if (!rascunhoPronto.current || !id) return;
        const temAlgo = photoMain || motivo || obs.trim() || statusMain === 'PENDENTE' || obsInstalacao.trim() !== obsInstalacaoSalva.current
            || Object.values(compPhotos).some(Boolean) || Object.values(compIncluded).some(Boolean);
        const timer = window.setTimeout(() => {
            if (!temAlgo) { apagarRascunho(id); return; }
            salvarRascunho(id, {
                statusMain, motivo, obs, obsInstalacao, photoMain, photoMainInfo,
                compPhotos, compInfo, compStatuses, compIncluded, compNumeroPredial,
                salvoEm: Date.now(),
            });
        }, 600);
        return () => window.clearTimeout(timer);
    }, [id, statusMain, motivo, obs, obsInstalacao, photoMain, photoMainInfo, compPhotos, compInfo, compStatuses, compIncluded, compNumeroPredial]);

    const descartarRascunho = () => {
        if (!confirm('Descartar as fotos e informações recuperadas deste imóvel?')) return;
        if (id) apagarRascunho(id);
        rascunhoPronto.current = false;
        window.location.reload();
    };

    const handleMainPhotoChange = (file: Blob | null, info: InfoFoto | null = null) => {
        setPhotoMain(file);
        setPhotoMainInfo(file ? info : null);
        // Libera a URL da prévia anterior para não acumular memória no celular
        setPhotoMainPreview(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return file ? URL.createObjectURL(file) : null;
        });
        if (file) setStatusMain('CONCLUIDO');
    };

    const handleCompPhotoChange = (compId: string, file: Blob | null, info: InfoFoto | null = null) => {
        setCompPhotos(prev => ({ ...prev, [compId]: file }));
        setCompInfo(prev => ({ ...prev, [compId]: file ? info : null }));
        if (file) {
            setCompPreviews(prev => ({ ...prev, [compId]: URL.createObjectURL(file) }));
            setCompStatuses(prev => ({ ...prev, [compId]: 'CONCLUIDO' }));
            setCompIncluded(prev => ({ ...prev, [compId]: true }));
        } else {
            setCompPreviews(prev => ({ ...prev, [compId]: null }));
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (processandoFotos > 0) {
            toast.info("Aguarde: a foto ainda está sendo preparada.");
            return;
        }

        const allComps = imovel.complementos || [];
        const isMainAlreadyCompleted = imovel.status === 'CONCLUIDO';
        const hasExistingMainPhoto = Boolean(parseFotos(imovel.fotos));

        // Complementos que têm foto nova ou que foram selecionados para atualizar
        const compsToUpdate = allComps.filter((c: any) => compIncluded[c.id] || compPhotos[c.id]);

        // Validação da foto principal:
        // Se o principal não estava concluído e não tem foto existente nem foto nova selecionada:
        if (!isMainAlreadyCompleted && !hasExistingMainPhoto && statusMain === 'CONCLUIDO' && !photoMain) {
            if (compsToUpdate.length > 0) {
                const confirmarApenasComplementos = confirm(
                    "Você não selecionou a foto do Número Principal, mas incluiu foto(s) de complemento(s).\n\nDeseja salvar apenas os complementos agora?"
                );
                if (!confirmarApenasComplementos) return;
            } else {
                toast.error("Tire a foto do número principal para concluir a instalação.");
                return;
            }
        }

        if (!isMainAlreadyCompleted && statusMain === 'PENDENTE' && !motivo) {
            toast.error("Escolha o motivo da pendência.");
            return;
        }
        if (!isMainAlreadyCompleted && statusMain === 'PENDENTE' && motivo === 'Outro' && !obs.trim()) {
            toast.error("Descreva o motivo da pendência.");
            return;
        }

        // Se o número principal já estava concluído e nenhuma alteração foi feita:
        const obsInstalacaoMudou = obsInstalacao.trim() !== obsInstalacaoSalva.current;
        if (isMainAlreadyCompleted && !photoMain && compsToUpdate.length === 0 && !obsInstalacaoMudou) {
            toast.info("Nenhuma alteração ou nova foto foi selecionada.");
            return;
        }

        // Foto tirada longe do endereço cadastrado: confirma antes de salvar
        const distancias = [photoMainInfo, ...compsToUpdate.map((c: any) => compPhotos[c.id] ? compInfo[c.id] : null)]
            .map(i => i?.distancia).filter((d): d is number => d != null);
        const maiorDistancia = distancias.length ? Math.max(...distancias) : 0;
        if (maiorDistancia > DISTANCIA_ALERTA_M && !confirm(
            `A foto foi tirada a ${formatarDistancia(maiorDistancia)} do endereço cadastrado deste imóvel.\n\nConfirma que é o imóvel certo?`
        )) return;

        setSaving(true);
        setSavingStep('Guardando no celular...');

        try {
            // Definir o status do principal a ser enviado
            const statusToSave = isMainAlreadyCompleted
                ? 'CONCLUIDO'
                : (photoMain ? statusMain : (compsToUpdate.length > 0 ? imovel.status : statusMain));

            // GPS da instalação: o da foto principal, senão o de um complemento, senão a posição atual
            const gpsFoto = photoMainInfo?.gps || compsToUpdate.map((c: any) => compInfo[c.id]?.gps).find(Boolean) || null;
            const gps = gpsFoto || await obterPosicao(6000);

            // 1. Guarda no celular (não se perde se o envio falhar ou o app fechar)
            const item = await adicionarNaFila({
                inscimob: imovel.inscimob,
                numero: imovel.numeroAInstalar,
                pasta: imovel.bairro?.nome || 'geral',
                criadoEm: Date.now(),
                status: statusToSave,
                obsPendente: statusToSave === 'PENDENTE' ? montarObsPendente(motivo, obs) : null,
                motivoPendencia: statusToSave === 'PENDENTE' ? (motivo || null) : null,
                obsInstalacao: statusToSave === 'CONCLUIDO' ? (obsInstalacao.trim() || null) : null,
                protocolo: agendamento,
                gps: gps ? { lat: gps.lat, lon: gps.lon, precisao: gps.precisao } : null,
                fotoPrincipal: photoMain,
                complementos: compsToUpdate.map((c: any) => ({
                    id: c.id,
                    status: compStatuses[c.id] || c.status || 'CONCLUIDO',
                    numeroPredial: compNumeroPredial[c.id] || c.numeroPredial,
                    foto: compPhotos[c.id] || null,
                })),
            });
            rascunhoPronto.current = false;
            await apagarRascunho(imovel.inscimob);

            // 2. Tenta enviar agora, mostrando o progresso
            const resultado = await processarFila({ apenas: item.chave, aoProgredir: setSavingStep });
            const restante = (await itensFila()).find(i => i.chave === item.chave);

            if (!restante) {
                vibrar('sucesso');
                toast.success(statusToSave === 'PENDENTE' ? "Pendência registrada." : "Instalação salva com sucesso!");
            } else if (restante.rejeitado) {
                vibrar('aviso');
                toast.error(`Não foi possível salvar: ${restante.erro}. Ela ficou guardada na lista de envios do painel.`);
            } else {
                vibrar('sucesso');
                toast.info(resultado.semInternet
                    ? "Sem internet: instalação guardada no celular. Ela será enviada sozinha quando a conexão voltar."
                    : "Instalação guardada no celular e será enviada em seguida.");
            }
            navigate('/', { replace: true });
        } catch (e: any) {
            toast.error(e.message || "Erro ao guardar a instalação no celular.");
            setSaving(false);
            setSavingStep('');
        }
    };

    /** Aviso exibido abaixo da prévia da foto (GPS / distância do imóvel). */
    const avisoFoto = (info: InfoFoto | null | undefined) => {
        if (!info) return null;
        if (!info.gps) {
            return <div className={styles.fotoAviso}><AlertTriangle size={15} /> GPS indisponível: a foto foi salva sem localização.</div>;
        }
        if (info.distancia != null && info.distancia > DISTANCIA_ALERTA_M) {
            return (
                <div className={`${styles.fotoAviso} ${styles.fotoAvisoForte}`}>
                    <AlertTriangle size={15} /> Você está a {formatarDistancia(info.distancia)} do endereço cadastrado. Confira se é o imóvel certo.
                </div>
            );
        }
        return (
            <div className={styles.fotoOk}>
                <MapPin size={14} /> Localização registrada{info.distancia != null ? ` (${formatarDistancia(info.distancia)} do imóvel)` : ''}{info.galeria ? ' • foto da galeria' : ''}
            </div>
        );
    };

    if (loading) return <div className="page-loading" style={{ minHeight: '100dvh' }}><Loader2 size={28} className="spin" />Carregando imóvel...</div>;
    if (!imovel) return (
        <div className="page-loading" style={{ minHeight: '100dvh' }}>
            Imóvel não encontrado.
            <button type="button" className={styles.backButton} onClick={() => navigate('/', { replace: true })}>Voltar ao painel</button>
        </div>
    );

    const existingMainPhoto = parseFotos(imovel.fotos);
    const existingOrientationPhoto = parseFotos(imovel.fotoLocalInstalacao);

    // Separar complementos: a instalar (não concluídos) e já instalados (concluídos)
    const activeCompsToProcess = imovel.complementos?.filter((c: any) => c.status !== 'CONCLUIDO') || [];
    const completedComps = imovel.complementos?.filter((c: any) => c.status === 'CONCLUIDO') || [];

    return (
        <div className={styles.container}>
            {/* Cabeçalho */}
            <header className={styles.header}>
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className={styles.backButton}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    Voltar
                </button>
                <h1 className={styles.title}>
                    Executar Instalação
                </h1>
            </header>

            {offline && (
                <div className={styles.bannerOffline}>
                    <CloudOff size={16} /> Sem internet: mostrando os dados guardados no celular. A instalação será enviada quando a conexão voltar.
                </div>
            )}
            {aguardandoEnvio && (
                <div className={styles.bannerFila}>
                    <Loader2 size={15} className="spin" /> Este imóvel tem uma instalação guardada no celular aguardando envio.
                </div>
            )}
            {rascunhoRecuperado && (
                <div className={styles.bannerRascunho}>
                    <span>Recuperamos o que você tinha preenchido aqui ({dataHoraBR(rascunhoRecuperado)}).</span>
                    <button type="button" onClick={descartarRascunho}>Descartar</button>
                </div>
            )}

            {agendamento && nomeMorador && (
                <div className={styles.agendamentoAlert}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Vinculando instalação ao agendamento de: <strong>{nomeMorador}</strong>
                </div>
            )}

            {/* Card com Informações do Imóvel */}
            <div className={styles.propertyHeaderCard}>
                <div className={styles.propertyHeaderTitle}>Identificação do Imóvel</div>
                <div className={styles.propertyHeaderNumber}>Nº {imovel.numeroAInstalar}</div>
                <div className={styles.propertyHeaderDetails}>
                    Bairro: <strong>{imovel.bairro?.nome || 'Não informado'}</strong> &bull; ID: {imovel.inscimob}
                </div>
            </div>

            <form onSubmit={handleUpdate} className={styles.form}>
                {/* ======================================================== */}
                {/* 1. NÚMERO PRINCIPAL                                      */}
                {/* ======================================================== */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                <polyline points="9 22 9 12 15 12 15 22"></polyline>
                            </svg>
                            1. Placa Principal (Nº {imovel.numeroAInstalar})
                        </h2>
                        {imovel.status === 'CONCLUIDO' && (
                            <span className={styles.badgeConcluido}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Concluído
                            </span>
                        )}
                    </div>

                    {/* Foto de Orientação da Prefeitura */}
                    {existingOrientationPhoto && (
                        <div className={styles.orientationBox}>
                            <div className={styles.orientationLabel}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                                Local indicado pela Prefeitura para instalação:
                            </div>
                            <img
                                src={existingOrientationPhoto}
                                alt="Foto indicativa da prefeitura"
                                className={styles.orientationImg}
                                onClick={() => setFullScreenImage(existingOrientationPhoto)}
                            />
                        </div>
                    )}

                    {/* Foto Atual Cadastrada (com opção de editar/substituir) */}
                    {existingMainPhoto && !photoMainPreview && (
                        <div className={styles.currentPhotoBox}>
                            <div className={styles.currentPhotoHeader}>
                                <span className={styles.currentPhotoLabel}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    Foto Atual Instalada:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => openPhotoPicker('main', undefined, 'Número Principal')}
                                    style={{
                                        background: '#2563eb',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '5px 12px',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                        <circle cx="12" cy="13" r="4"></circle>
                                    </svg>
                                    Substituir Foto
                                </button>
                            </div>
                            <img
                                src={existingMainPhoto}
                                alt="Foto do Número Principal"
                                className={styles.currentPhotoThumb}
                                onClick={() => setFullScreenImage(existingMainPhoto)}
                            />
                        </div>
                    )}

                    {/* Nova Foto Selecionada (Preview) */}
                    {photoMainPreview && (
                        <div className={styles.previewContainer}>
                            <img
                                src={photoMainPreview}
                                alt="Preview Nova Foto Principal"
                                className={styles.previewThumb}
                                onClick={() => setFullScreenImage(photoMainPreview)}
                            />
                            <span className={styles.previewBadge}>Nova Foto Selecionada</span>
                            {avisoFoto(photoMainInfo)}
                            <button
                                type="button"
                                className={styles.removePhotoBtn}
                                onClick={() => handleMainPhotoChange(null)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                                Cancelar
                            </button>
                        </div>
                    )}

                    {/* Botão de Envio de Foto quando ainda não há foto selecionada e não tem foto salva */}
                    {!existingMainPhoto && !photoMainPreview && (
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Foto do Número Instalado *</label>
                            <button
                                type="button"
                                className={styles.uploadTriggerBtn}
                                onClick={() => openPhotoPicker('main', undefined, 'Número Principal')}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                    <circle cx="12" cy="13" r="4"></circle>
                                </svg>
                                Tirar / Enviar Foto do Principal
                            </button>
                        </div>
                    )}

                    {/* Status do Principal (não editável depois de concluído) */}
                    {imovel.status !== 'CONCLUIDO' && (
                    <div className={styles.formGroup} style={{ marginTop: '0.85rem' }}>
                        <label className={styles.label}>Status da Instalação Principal</label>
                        <div className={styles.statusButtons}>
                            <button
                                type="button"
                                className={`${styles.statusBtn} ${statusMain === 'CONCLUIDO' ? styles.statusActiveSuccess : ''}`}
                                onClick={() => setStatusMain('CONCLUIDO')}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Concluído
                            </button>
                            <button
                                type="button"
                                className={`${styles.statusBtn} ${statusMain === 'PENDENTE' ? styles.statusActiveWarning : ''}`}
                                onClick={() => setStatusMain('PENDENTE')}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                                Pendente
                            </button>
                        </div>
                    </div>
                    )}

                    {/* Motivo da pendência: botões padronizados (relatórios do admin) + detalhe opcional */}
                    {statusMain === 'PENDENTE' && (
                        <div className={styles.formGroup}>
                            <span className={styles.label}>Motivo da Pendência *</span>
                            <div className={styles.motivos} role="radiogroup" aria-label="Motivo da pendência">
                                {MOTIVOS_PENDENCIA.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        role="radio"
                                        aria-checked={motivo === m}
                                        className={`${styles.motivoBtn} ${motivo === m ? styles.motivoAtivo : ''}`}
                                        onClick={() => { setMotivo(m); vibrar('leve'); }}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                            <label className={styles.label} htmlFor="obs-pendencia" style={{ marginTop: '0.75rem' }}>
                                {motivo === 'Outro' ? 'Descreva o motivo *' : 'Detalhes (opcional)'}
                            </label>
                            <textarea
                                id="obs-pendencia"
                                className={styles.textarea}
                                value={obs}
                                onChange={e => setObs(e.target.value)}
                                placeholder={motivo === 'Outro' ? 'Ex: Portão trancado, cachorro solto...' : 'Ex: Voltar à tarde, falar com o vizinho...'}
                            />
                        </div>
                    )}

                    {/* Observação opcional da instalação (aparece na linha do tempo do admin) */}
                    {statusMain === 'CONCLUIDO' && (
                        <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="obs-instalacao">Observação (opcional)</label>
                            <textarea
                                id="obs-instalacao"
                                className={styles.textarea}
                                value={obsInstalacao}
                                onChange={e => setObsInstalacao(e.target.value)}
                                placeholder="Ex: Placa instalada no muro, morador pediu outra posição..."
                            />
                        </div>
                    )}

                    {imovel.obsPendente && statusMain !== 'PENDENTE' && (
                        <div className={styles.orientationBox}>
                            <div className={styles.orientationLabel}>Observação registrada:</div>
                            <p style={{ fontSize: '0.9rem', color: '#334155' }}>{imovel.obsPendente}</p>
                        </div>
                    )}
                </div>

                {/* ======================================================== */}
                {/* 2. COMPLEMENTOS A INSTALAR                               */}
                {/* ======================================================== */}
                {activeCompsToProcess.length > 0 && (
                    <div>
                        <div className={styles.sectionHeaderGroup}>
                            <h2 className={styles.sectionTitle}>
                                2. Complementos a Instalar ({activeCompsToProcess.length})
                            </h2>
                            <p className={styles.sectionSubtitle}>
                                Adicione as fotos das placas instaladas para cada unidade abaixo.
                            </p>
                        </div>

                        {activeCompsToProcess.map((c: any) => {
                            const isIncluded = compIncluded[c.id] || Boolean(compPhotos[c.id]);
                            const preview = compPreviews[c.id];

                            return (
                                <div
                                    key={c.id}
                                    className={`${styles.compCard} ${isIncluded ? styles.compCardActive : ''}`}
                                >
                                    <div className={styles.compCardHeader}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#475569' }}>Unidade:</span>
                                                <div className={styles.unitEditWrapper}>
                                                    <input
                                                        type="text"
                                                        className={styles.unitInput}
                                                        value={compNumeroPredial[c.id] ?? c.numeroPredial}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setCompNumeroPredial(prev => ({ ...prev, [c.id]: val }));
                                                            setCompIncluded(prev => ({ ...prev, [c.id]: true }));
                                                        }}
                                                        placeholder="Ex: CS 1, CS 2"
                                                        title="Clique para editar o número da unidade"
                                                    />
                                                    <span className={styles.unitEditIcon} title="Editar número">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                    </span>
                                                </div>
                                            </div>
                                            {c.unidade && (
                                                <div className={styles.compUnitSub}>
                                                    ID: {c.unidade}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Foto de Orientação da Prefeitura para a Unidade */}
                                    {c.fotoLocalInstalacao && (
                                        <div className={styles.orientationBox}>
                                            <div className={styles.orientationLabel}>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                                    <circle cx="12" cy="10" r="3"></circle>
                                                </svg>
                                                Foto de Referência da Prefeitura:
                                            </div>
                                            <img
                                                src={parseFotos(c.fotoLocalInstalacao) || ''}
                                                alt={`Referência ${c.numeroPredial}`}
                                                className={styles.orientationImg}
                                                onClick={() => setFullScreenImage(parseFotos(c.fotoLocalInstalacao))}
                                            />
                                        </div>
                                    )}

                                    {/* Preview da Nova Foto da Unidade */}
                                    {preview && (
                                        <div className={styles.previewContainer}>
                                            <img
                                                src={preview}
                                                alt={`Preview ${c.numeroPredial}`}
                                                className={styles.previewThumb}
                                                onClick={() => setFullScreenImage(preview)}
                                            />
                                            <span className={styles.previewBadge}>Nova Foto Selecionada</span>
                                            {avisoFoto(compInfo[c.id])}
                                            <button
                                                type="button"
                                                className={styles.removePhotoBtn}
                                                onClick={() => handleCompPhotoChange(c.id, null)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                                Remover
                                            </button>
                                        </div>
                                    )}

                                    {/* Botão para tirar foto da placa instalada */}
                                    <div className={styles.formGroup} style={{ marginTop: '0.5rem' }}>
                                        <button
                                            type="button"
                                            className={styles.uploadTriggerBtn}
                                            onClick={() => openPhotoPicker('comp', c.id, `Unidade ${compNumeroPredial[c.id] || c.numeroPredial}`)}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                                <circle cx="12" cy="13" r="4"></circle>
                                            </svg>
                                            {preview ? "Trocar Foto Desta Unidade" : `Tirar Foto da Placa (${compNumeroPredial[c.id] || c.numeroPredial})`}
                                        </button>
                                    </div>

                                    {/* Status da Unidade */}
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Status desta unidade:</label>
                                        <div className={styles.statusButtons}>
                                            <button
                                                type="button"
                                                className={`${styles.statusBtn} ${compStatuses[c.id] === 'CONCLUIDO' ? styles.statusActiveSuccess : ''}`}
                                                onClick={() => {
                                                    setCompStatuses(prev => ({ ...prev, [c.id]: 'CONCLUIDO' }));
                                                    setCompIncluded(prev => ({ ...prev, [c.id]: true }));
                                                }}
                                            >
                                                Concluído
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.statusBtn} ${compStatuses[c.id] === 'PENDENTE' ? styles.statusActiveWarning : ''}`}
                                                onClick={() => {
                                                    setCompStatuses(prev => ({ ...prev, [c.id]: 'PENDENTE' }));
                                                    setCompIncluded(prev => ({ ...prev, [c.id]: true }));
                                                }}
                                            >
                                                Pendente
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ======================================================== */}
                {/* 3. COMPLEMENTOS JÁ CONCLUÍDOS (COM EDIÇÃO DE FOTOS)     */}
                {/* ======================================================== */}
                {completedComps.length > 0 && (
                    <div>
                        <div className={styles.sectionHeaderGroup}>
                            <h2 className={styles.sectionTitle} style={{ color: '#166534' }}>
                                3. Complementos Instalados ({completedComps.length})
                            </h2>
                            <p className={styles.sectionSubtitle}>
                                Unidades já concluídas. Você pode visualizar ou substituir a foto se necessário.
                            </p>
                        </div>

                        {completedComps.map((c: any) => {
                            const existingCompPhoto = parseFotos(c.fotos);
                            const preview = compPreviews[c.id];

                            return (
                                <div key={c.id} className={styles.compCard}>
                                    <div className={styles.compCardHeader}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#475569' }}>Unidade:</span>
                                                <div className={styles.unitEditWrapper}>
                                                    <input
                                                        type="text"
                                                        className={styles.unitInput}
                                                        value={compNumeroPredial[c.id] ?? c.numeroPredial}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setCompNumeroPredial(prev => ({ ...prev, [c.id]: val }));
                                                            setCompIncluded(prev => ({ ...prev, [c.id]: true }));
                                                        }}
                                                        placeholder="Ex: CS 1, CS 2"
                                                        title="Clique para editar o número da unidade"
                                                    />
                                                    <span className={styles.unitEditIcon} title="Editar número">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                    </span>
                                                </div>
                                            </div>
                                            {c.unidade && (
                                                <div className={styles.compUnitSub}>
                                                    ID: {c.unidade}
                                                </div>
                                            )}
                                        </div>
                                        <span className={styles.badgeConcluido}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                            Instalado
                                        </span>
                                    </div>

                                    {/* Foto Salva Atual */}
                                    {existingCompPhoto && !preview && (
                                        <div className={styles.currentPhotoBox}>
                                            <div className={styles.currentPhotoHeader}>
                                                <span className={styles.currentPhotoLabel}>
                                                    Foto Registrada:
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => openPhotoPicker('comp', c.id, `Unidade ${compNumeroPredial[c.id] || c.numeroPredial}`)}
                                                    style={{
                                                        background: '#2563eb',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '5px 12px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '700',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                                        <circle cx="12" cy="13" r="4"></circle>
                                                    </svg>
                                                    Substituir Foto
                                                </button>
                                            </div>
                                            <img
                                                src={existingCompPhoto}
                                                alt={`Foto ${c.numeroPredial}`}
                                                className={styles.currentPhotoThumb}
                                                onClick={() => setFullScreenImage(existingCompPhoto)}
                                            />
                                        </div>
                                    )}

                                    {/* Preview da Nova Foto de Substituição */}
                                    {preview && (
                                        <div className={styles.previewContainer}>
                                            <img
                                                src={preview}
                                                alt={`Nova foto ${c.numeroPredial}`}
                                                className={styles.previewThumb}
                                                onClick={() => setFullScreenImage(preview)}
                                            />
                                            <span className={styles.previewBadge}>Nova Foto Selecionada</span>
                                            {avisoFoto(compInfo[c.id])}
                                            <button
                                                type="button"
                                                className={styles.removePhotoBtn}
                                                onClick={() => handleCompPhotoChange(c.id, null)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                                Cancelar
                                            </button>
                                        </div>
                                    )}

                                    {/* Caso não tenha foto salva ainda por algum motivo */}
                                    {!existingCompPhoto && !preview && (
                                        <button
                                            type="button"
                                            className={styles.uploadTriggerBtn}
                                            onClick={() => openPhotoPicker('comp', c.id, `Unidade ${compNumeroPredial[c.id] || c.numeroPredial}`)}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                                <circle cx="12" cy="13" r="4"></circle>
                                            </svg>
                                            Incluir Foto Desta Unidade
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Botão de Submissão Geral: fixo no rodapé, ao alcance do polegar */}
                <div className={styles.submitBar}>
                    <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={saving || processandoFotos > 0}
                        aria-busy={saving || processandoFotos > 0}
                    >
                        {saving || processandoFotos > 0 ? <Loader2 size={20} className="spin" /> : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        )}
                        {saving ? (savingStep || "Salvando...")
                            : processandoFotos > 0 ? "Preparando foto (GPS)..."
                            : (statusMain === 'PENDENTE' && imovel.status !== 'CONCLUIDO' ? "Registrar Pendência" : "Salvar Instalação")}
                    </button>
                </div>
            </form>

            <div style={{ height: '16px' }}></div>

            {/* Modal de Zoom da Foto em Tela Cheia */}
            {fullScreenImage && (
                <div className="lightbox" role="dialog" aria-label="Foto em tela cheia" onClick={() => setFullScreenImage(null)}>
                    <img src={fullScreenImage} alt="Foto ampliada" />
                    <button type="button" className="lightbox-close" aria-label="Fechar foto"><X size={22} /></button>
                </div>
            )}

            {/* Inputs Ocultos Centralizados (Câmera e Galeria) */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className={styles.hiddenFileInput}
                onChange={e => handleFileSelected(e, false)}
            />
            <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className={styles.hiddenFileInput}
                onChange={e => handleFileSelected(e, true)}
            />

            {/* Modal de Escolha: Câmera ou Galeria */}
            {photoModalTarget && (
                <div
                    className={styles.modalOverlay}
                    onClick={() => {
                        setPhotoModalTarget(null);
                        photoModalTargetRef.current = null;
                    }}
                >
                    <div
                        className={styles.modalSheet}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className={styles.modalHandle}></div>

                        <div className={styles.modalHeader}>
                            <div>
                                <h3 className={styles.modalTitle}>Adicionar Foto</h3>
                                {photoModalTarget.title && (
                                    <div className={styles.modalSubtitle}>
                                        {photoModalTarget.title}
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                className={styles.modalCloseBtn}
                                onClick={() => {
                                    setPhotoModalTarget(null);
                                    photoModalTargetRef.current = null;
                                }}
                                aria-label="Fechar"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <div className={styles.modalOptions}>
                            <button
                                type="button"
                                className={styles.modalOptionBtn}
                                onClick={() => handleSelectOption('camera')}
                            >
                                <div className={styles.optionIconWrapperCamera}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                        <circle cx="12" cy="13" r="4"></circle>
                                    </svg>
                                </div>
                                <div className={styles.optionInfo}>
                                    <span className={styles.optionTitle}>Tirar Foto</span>
                                    <span className={styles.optionDesc}>Abrir a câmera do dispositivo</span>
                                </div>
                                <div className={styles.optionChevron}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                </div>
                            </button>

                            <button
                                type="button"
                                className={styles.modalOptionBtn}
                                onClick={() => handleSelectOption('gallery')}
                            >
                                <div className={styles.optionIconWrapperGallery}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                        <polyline points="21 15 16 10 5 21"></polyline>
                                    </svg>
                                </div>
                                <div className={styles.optionInfo}>
                                    <span className={styles.optionTitle}>Carregar dos Arquivos de Mídia</span>
                                    <span className={styles.optionDesc}>Escolher da galeria ou arquivos</span>
                                </div>
                                <div className={styles.optionChevron}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                </div>
                            </button>
                        </div>

                        <button
                            type="button"
                            className={styles.modalCancelBtn}
                            onClick={() => {
                                setPhotoModalTarget(null);
                                photoModalTargetRef.current = null;
                            }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


