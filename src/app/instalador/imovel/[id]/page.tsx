'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { createClient } from '@/utils/supabase/client';
import { compressImage } from '@/utils/imageCompressor';

export default function ImovelDetalhesPage() {
    const { id } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const agendamento = searchParams.get('agendamento');
    const nomeMorador = searchParams.get('nome');

    const supabase = createClient();
    const [imovel, setImovel] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Status e Foto do Número Principal
    const [statusMain, setStatusMain] = useState<'CONCLUIDO' | 'PENDENTE'>('CONCLUIDO');
    const [obs, setObs] = useState('');
    const [photoMain, setPhotoMain] = useState<File | null>(null);
    const [photoMainPreview, setPhotoMainPreview] = useState<string | null>(null);
    const mainFileInputRef = useRef<HTMLInputElement>(null);

    // Complementos: fotos novas, previews, status, seleção e número predial editável (key = complemento id)
    const [compPhotos, setCompPhotos] = useState<Record<string, File | null>>({});
    const [compPreviews, setCompPreviews] = useState<Record<string, string | null>>({});
    const [compStatuses, setCompStatuses] = useState<Record<string, 'CONCLUIDO' | 'PENDENTE'>>({});
    const [compIncluded, setCompIncluded] = useState<Record<string, boolean>>({});
    const [compNumeroPredial, setCompNumeroPredial] = useState<Record<string, string>>({});
    const compFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const [user, setUser] = useState<any>(null);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

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

    useEffect(() => {
        async function loadData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                setUser(user);

                const res = await fetch(`/api/instalador/imovel/${id}`);
                const data = await res.json();

                setImovel(data.imovel);

                if (data.imovel?.status === 'CONCLUIDO') {
                    setStatusMain('CONCLUIDO');
                } else if (data.imovel?.status === 'PENDENTE') {
                    setStatusMain('PENDENTE');
                    setObs(data.imovel?.obsPendente || '');
                } else {
                    setStatusMain('CONCLUIDO');
                }

                // Inicializar estados de TODOS os complementos (tanto a instalar quanto já concluídos)
                const initialCompPhotos: Record<string, File | null> = {};
                const initialCompPreviews: Record<string, string | null> = {};
                const initialCompStatuses: Record<string, 'CONCLUIDO' | 'PENDENTE'> = {};
                const initialCompIncluded: Record<string, boolean> = {};
                const initialCompNumeroPredial: Record<string, string> = {};

                if (data.imovel?.complementos) {
                    data.imovel.complementos.forEach((c: any) => {
                        initialCompPhotos[c.id] = null;
                        initialCompPreviews[c.id] = null;
                        initialCompStatuses[c.id] = c.status === 'PENDENTE' ? 'PENDENTE' : 'CONCLUIDO';
                        initialCompIncluded[c.id] = false;
                        initialCompNumeroPredial[c.id] = c.numeroPredial || '';
                    });
                }
                setCompPhotos(initialCompPhotos);
                setCompPreviews(initialCompPreviews);
                setCompStatuses(initialCompStatuses);
                setCompIncluded(initialCompIncluded);
                setCompNumeroPredial(initialCompNumeroPredial);

            } catch (e) {
                console.error("Erro ao carregar dados", e);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

    const handleMainPhotoChange = (file: File | null) => {
        setPhotoMain(file);
        if (file) {
            setPhotoMainPreview(URL.createObjectURL(file));
            setStatusMain('CONCLUIDO');
        } else {
            setPhotoMainPreview(null);
        }
    };

    const handleCompPhotoChange = (compId: string, file: File | null) => {
        setCompPhotos(prev => ({ ...prev, [compId]: file }));
        if (file) {
            setCompPreviews(prev => ({ ...prev, [compId]: URL.createObjectURL(file) }));
            setCompStatuses(prev => ({ ...prev, [compId]: 'CONCLUIDO' }));
            setCompIncluded(prev => ({ ...prev, [compId]: true }));
        } else {
            setCompPreviews(prev => ({ ...prev, [compId]: null }));
        }
    };

    const uploadFile = async (file: File | Blob, folder: string, prefix: string) => {
        const formData = new FormData();
        const fileName = `${id}_${prefix}_${Date.now()}.webp`;
        formData.append("file", file, fileName);
        formData.append("folder", folder);

        const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
        });

        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
            const errorMsg = uploadData.details || uploadData.error || `Falha no upload da foto ${prefix}`;
            throw new Error(errorMsg);
        }

        return uploadData.url;
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        const allComps = imovel.complementos || [];
        const isMainAlreadyCompleted = imovel.status === 'CONCLUIDO';
        const hasExistingMainPhoto = Boolean(parseFotos(imovel.fotos));

        // Complementos que têm foto nova ou que foram selecionados para atualizar
        const compsToUpdate = allComps.filter((c: any) => compIncluded[c.id] || compPhotos[c.id] !== null);

        // Validação da foto principal:
        // Se o principal não estava concluído e não tem foto existente nem foto nova selecionada:
        if (!isMainAlreadyCompleted && !hasExistingMainPhoto && statusMain === 'CONCLUIDO' && !photoMain) {
            if (compsToUpdate.length > 0) {
                const confirmarApenasComplementos = confirm(
                    "Você não selecionou a foto do Número Principal, mas incluiu foto(s) de complemento(s).\n\nDeseja salvar apenas os complementos agora?"
                );
                if (!confirmarApenasComplementos) return;
            } else {
                alert("Você deve tirar a foto do Número Principal para concluir a instalação principal.");
                return;
            }
        }

        // Se o número principal já estava concluído e nenhuma alteração foi feita:
        if (isMainAlreadyCompleted && !photoMain && compsToUpdate.length === 0 && (!obs || obs === imovel.obsPendente)) {
            alert("Nenhuma alteração ou nova foto foi selecionada.");
            return;
        }

        setLoading(true);
        const folder = imovel.bairro?.nome || 'geral';

        try {
            // 1. Upload da foto do principal se uma nova foi selecionada
            let fotos: string[] = [];
            if (photoMain) {
                const compressedMain = await compressImage(photoMain);
                const url = await uploadFile(compressedMain, folder, 'principal');
                fotos = [url];
            }

            // 2. Upload das fotos dos complementos alterados
            const complementosData = [];
            for (const comp of compsToUpdate) {
                let compFotos: string[] = [];
                const cFile = compPhotos[comp.id];
                const cStatus = compStatuses[comp.id] || comp.status || 'CONCLUIDO';

                if (cFile) {
                    const compressedComp = await compressImage(cFile);
                    const url = await uploadFile(compressedComp, folder, comp.unidade || comp.numeroPredial || 'comp');
                    compFotos = [url];
                }

                complementosData.push({
                    id: comp.id,
                    status: cStatus,
                    numeroPredial: compNumeroPredial[comp.id] || comp.numeroPredial,
                    fotos: compFotos
                });
            }

            // Definir o status do principal a ser enviado
            const statusToSave = isMainAlreadyCompleted
                ? 'CONCLUIDO'
                : (photoMain ? statusMain : (compsToUpdate.length > 0 ? imovel.status : statusMain));

            const res = await fetch('/api/instalador/atualizar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inscimob: id,
                    status: statusToSave,
                    obsPendente: statusToSave === 'PENDENTE' ? obs : null,
                    fotos,
                    complementosData,
                    protocolo: agendamento,
                    instaladorResp: user?.user_metadata?.name || user?.email || "Instalador",
                    userId: user?.id,
                    userEmail: user?.email
                })
            });

            if (res.ok) {
                alert("Instalação atualizada com sucesso!");
                router.push('/instalador');
            } else {
                throw new Error("Erro ao atualizar dados no servidor.");
            }
        } catch (e: any) {
            alert(e.message || "Erro ao atualizar status.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="container text-center py-20" style={{ padding: '3rem', textAlign: 'center' }}>Carregando dados...</div>;
    if (!imovel) return <div className="container text-center py-20" style={{ padding: '3rem', textAlign: 'center' }}>Imóvel não encontrado.</div>;

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
                    onClick={() => router.back()}
                    className={styles.backButton}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    Voltar
                </button>
                <h1 className={styles.title}>
                    {agendamento ? 'Vincular Agendamento' : 'Executar Instalação'}
                </h1>
            </header>

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
                                    onClick={() => mainFileInputRef.current?.click()}
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

                    {/* Input de Arquivo / Câmera (Oculto) */}
                    <input
                        ref={mainFileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className={styles.hiddenFileInput}
                        onChange={e => handleMainPhotoChange(e.target.files?.[0] || null)}
                    />

                    {/* Botão de Envio de Foto quando ainda não há foto selecionada e não tem foto salva */}
                    {!existingMainPhoto && !photoMainPreview && (
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Foto do Número Instalado *</label>
                            <button
                                type="button"
                                className={styles.uploadTriggerBtn}
                                onClick={() => mainFileInputRef.current?.click()}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                    <circle cx="12" cy="13" r="4"></circle>
                                </svg>
                                Tirar / Enviar Foto do Principal
                            </button>
                        </div>
                    )}

                    {/* Status do Principal */}
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

                    {/* Campo de Observação (se pendente ou nota adicional) */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            {statusMain === 'PENDENTE' ? 'Motivo da Pendência *' : 'Observações (Opcional)'}
                        </label>
                        <textarea
                            className={styles.textarea}
                            value={obs}
                            onChange={e => setObs(e.target.value)}
                            placeholder={statusMain === 'PENDENTE' ? "Informe o motivo (Ex: Portão trancado, morador ausente...)" : "Notas adicionais sobre a instalação..."}
                            required={statusMain === 'PENDENTE'}
                        />
                    </div>
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
                            const isIncluded = compIncluded[c.id] || compPhotos[c.id] !== null;
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

                                    {/* Input de Foto Oculto */}
                                    <input
                                        ref={el => { compFileInputRefs.current[c.id] = el; }}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className={styles.hiddenFileInput}
                                        onChange={e => handleCompPhotoChange(c.id, e.target.files?.[0] || null)}
                                    />

                                    {/* Botão para tirar foto da placa instalada */}
                                    <div className={styles.formGroup} style={{ marginTop: '0.5rem' }}>
                                        <button
                                            type="button"
                                            className={styles.uploadTriggerBtn}
                                            onClick={() => compFileInputRefs.current[c.id]?.click()}
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
                                                    onClick={() => compFileInputRefs.current[c.id]?.click()}
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

                                    {/* Input de Arquivo Oculto para Substituição */}
                                    <input
                                        ref={el => { compFileInputRefs.current[c.id] = el; }}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className={styles.hiddenFileInput}
                                        onChange={e => handleCompPhotoChange(c.id, e.target.files?.[0] || null)}
                                    />

                                    {/* Caso não tenha foto salva ainda por algum motivo */}
                                    {!existingCompPhoto && !preview && (
                                        <button
                                            type="button"
                                            className={styles.uploadTriggerBtn}
                                            onClick={() => compFileInputRefs.current[c.id]?.click()}
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

                {/* Botão de Submissão Geral */}
                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={loading}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    {loading ? "Salvando Alterações..." : "Salvar Instalação"}
                </button>
            </form>

            <div style={{ height: '40px' }}></div>

            {/* Modal de Zoom da Foto em Tela Cheia */}
            {fullScreenImage && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.92)',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'zoom-out'
                    }}
                    onClick={() => setFullScreenImage(null)}
                >
                    <img
                        src={fullScreenImage}
                        alt="Zoom"
                        style={{
                            maxWidth: '96%',
                            maxHeight: '92%',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
}


