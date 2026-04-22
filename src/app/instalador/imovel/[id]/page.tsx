'use client';

import { useState, useEffect } from 'react';
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

    // Dicionários para acompanhar status e fotos dos complementos liberados (key = complemento id)
    const [compPhotos, setCompPhotos] = useState<Record<string, File | null>>({});
    const [compStatuses, setCompStatuses] = useState<Record<string, 'CONCLUIDO' | 'PENDENTE'>>({});

    const [user, setUser] = useState<any>(null);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                setUser(user);

                const res = await fetch(`/api/instalador/imovel/${id}`);
                const data = await res.json();

                // Inicializar estados
                setImovel(data.imovel);

                const initialCompPhotos: Record<string, File | null> = {};
                const initialCompStatuses: Record<string, 'CONCLUIDO' | 'PENDENTE'> = {};

                if (data.imovel?.complementos) {
                    data.imovel.complementos.forEach((c: any) => {
                        if (c.liberadoInstalacao && c.status !== 'CONCLUIDO') {
                            initialCompPhotos[c.id] = null;
                            initialCompStatuses[c.id] = 'CONCLUIDO';
                        }
                    });
                }
                setCompPhotos(initialCompPhotos);
                setCompStatuses(initialCompStatuses);

            } catch (e) {
                console.error("Erro ao carregar dados");
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

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

        const activeCompsToProcess = imovel.complementos?.filter((c: any) => c.liberadoInstalacao && c.status !== 'CONCLUIDO') || [];

        // Validação principal
        if (statusMain === 'CONCLUIDO' && !photoMain) {
            alert("⚠️ Você deve tirar a foto do Número Principal para concluir a instalação principal.");
            return;
        }

        // Validação de complementos
        for (const comp of activeCompsToProcess) {
            if (compStatuses[comp.id] === 'CONCLUIDO' && !compPhotos[comp.id]) {
                alert(`⚠️ Você deve tirar a foto do Complemento ${comp.numeroPredial} para concluí-lo.`);
                return;
            }
        }

        setLoading(true);

        const folder = imovel.bairro.nome || 'geral';

        try {
            // 1. Fazer upload da foto principal se ela existir
            let fotos: string[] = [];
            if (photoMain) {
                const compressedMain = await compressImage(photoMain);
                const url = await uploadFile(compressedMain, folder, 'principal');
                fotos = [url];
            }

            // 2. Fazer upload das fotos dos complementos selecionados
            const complementosData = [];
            for (const comp of activeCompsToProcess) {
                let compFotos: string[] = [];
                const cFile = compPhotos[comp.id];
                const cStatus = compStatuses[comp.id];

                if (cFile) {
                    const compressedComp = await compressImage(cFile);
                    const url = await uploadFile(compressedComp, folder, comp.unidade);
                    compFotos = [url];
                }

                complementosData.push({
                    id: comp.id,
                    status: cStatus,
                    fotos: compFotos
                });
            }

            // 3. Atualizar Lote (Principal + Complementos)
            const res = await fetch('/api/instalador/atualizar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inscimob: id,
                    status: statusMain,
                    obsPendente: obs,
                    fotos,
                    complementosData,
                    protocolo: agendamento,
                    instaladorResp: user?.user_metadata?.name || user?.email || "Instalador",
                    userId: user?.id,
                    userEmail: user?.email
                })
            });

            if (res.ok) {
                alert("Instalação salva com sucesso!");
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

    if (loading) return <div className="container text-center py-20">Carregando...</div>;
    if (!imovel) return <div className="container text-center py-20">Imóvel não encontrado.</div>;

    const activeCompsToProcess = imovel.complementos?.filter((c: any) => c.liberadoInstalacao && c.status !== 'CONCLUIDO') || [];
    const disabledMainStatus = imovel.status !== 'LIBERADO' && imovel.status !== 'PENDENTE' && imovel.status !== 'AUSENTE';

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <button
                    onClick={() => router.back()}
                    className={styles.backButton}
                >
                    &larr; Voltar
                </button>
                <h1 className={styles.title}>
                    {agendamento ? 'Vincular e Concluir' : 'Executar Instalação'}
                </h1>
            </header>

            {agendamento && nomeMorador && (
                <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>
                    ✅ Vinculando Instalação ao agendamento de: {nomeMorador}
                </div>
            )}

            <div className={styles.mainWorkAlert}>
                <span>🏠 Número P.: <strong>{imovel.numeroAInstalar}</strong></span>
            </div>

            {disabledMainStatus && (
                <div className={styles.warningBanner}>
                    ⚠️ O número principal ainda não foi liberado pela prefeitura.
                </div>
            )}

            {/* ----------------- NÚMERO PRINCIPAL ----------------- */}
            <form onSubmit={handleUpdate} className={styles.form}>
                <div style={{ padding: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '20px' }}>
                    <h2 className={styles.sectionTitle} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px' }}>
                        1. Número Principal ({imovel.numeroAInstalar})
                    </h2>

                    {/* Foto de Orientação da Prefeitura (Principal) */}
                    {(imovel.fotoLocalInstalacao || imovel.fotos) && (
                        <div className={styles.orientationPhotoSection} style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#eef2ff', borderRadius: '10px', border: '1px solid #c7d2fe' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#3730a3', marginBottom: '10px' }}>
                                📍 Foto de Referência / Orientação
                            </h3>
                            <img
                                src={(imovel.fotoLocalInstalacao || imovel.fotos)}
                                alt="Foto indicativa da prefeitura"
                                style={{ width: '100%', maxHeight: '450px', objectFit: 'cover', borderRadius: '8px', cursor: 'zoom-in' }}
                                onClick={() => setFullScreenImage(imovel.fotoLocalInstalacao || imovel.fotos)}
                            />
                            <p style={{ fontSize: '13px', color: '#4f46e5', marginTop: '10px', marginBottom: 0 }}>
                                {imovel.fotoLocalInstalacao ? "📍 Local indicado pela Prefeitura para instalação." : "📸 Foto de referência registrada."}
                            </p>
                        </div>
                    )}

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Status da Instalação Principal</label>
                        <div className={styles.statusButtons}>
                            <button
                                type="button"
                                className={`${styles.statusBtn} ${statusMain === 'CONCLUIDO' ? styles.statusActiveSuccess : ''}`}
                                onClick={() => setStatusMain('CONCLUIDO')}
                                disabled={disabledMainStatus}
                            >
                                Concluído
                            </button>
                            <button
                                type="button"
                                className={`${styles.statusBtn} ${statusMain === 'PENDENTE' ? styles.statusActiveWarning : ''}`}
                                onClick={() => setStatusMain('PENDENTE')}
                                disabled={disabledMainStatus}
                            >
                                Pendente
                            </button>
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            {statusMain === 'CONCLUIDO' ? 'Foto do Número Instalado' : 'Foto da Pendência (Opcional)'}
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            className={styles.fileInput}
                            onChange={e => setPhotoMain(e.target.files?.[0] || null)}
                            disabled={disabledMainStatus}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Observações (Prioridade)</label>
                        <textarea
                            className={styles.textarea}
                            value={obs}
                            onChange={e => setObs(e.target.value)}
                            placeholder={statusMain === 'PENDENTE' ? "Motivo pendência (Ex: Morador ausente)" : "Notas adicionais..."}
                            required={statusMain === 'PENDENTE'}
                            disabled={disabledMainStatus}
                        />
                    </div>
                </div>

                {/* ----------------- COMPLEMENTOS LIBERADOS ----------------- */}
                {activeCompsToProcess.length > 0 && (
                    <div style={{ padding: '15px', border: '1px dashed #6366f1', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '20px' }}>
                        <h2 className={styles.sectionTitle} style={{ color: '#4f46e5', borderBottom: '1px dashed #cbd5e1', paddingBottom: '10px', marginBottom: '15px' }}>
                            2. Complementos Liberados
                        </h2>

                        {activeCompsToProcess.map((c: any) => (
                            <div key={c.id} style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: c === activeCompsToProcess[activeCompsToProcess.length - 1] ? 'none' : '1px solid #e2e8f0' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '10px' }}>
                                    ► Unidade: {c.numeroPredial}
                                </h3>

                                <div className={styles.formGroup} style={{ marginBottom: '10px' }}>
                                    <div className={styles.statusButtons} style={{ gap: '5px' }}>
                                        <button
                                            type="button"
                                            className={`${styles.statusBtn} ${compStatuses[c.id] === 'CONCLUIDO' ? styles.statusActiveSuccess : ''}`}
                                            onClick={() => setCompStatuses(prev => ({ ...prev, [c.id]: 'CONCLUIDO' }))}
                                            style={{ padding: '6px 10px', fontSize: '13px' }}
                                        >
                                            Concluído
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.statusBtn} ${compStatuses[c.id] === 'PENDENTE' ? styles.statusActiveWarning : ''}`}
                                            onClick={() => setCompStatuses(prev => ({ ...prev, [c.id]: 'PENDENTE' }))}
                                            style={{ padding: '6px 10px', fontSize: '13px' }}
                                        >
                                            Pendente
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className={styles.fileInput}
                                        onChange={e => setCompPhotos(prev => ({ ...prev, [c.id]: e.target.files?.[0] || null }))}
                                    />
                                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                                        {compStatuses[c.id] === 'CONCLUIDO' ? 'Foto da Unidade obrigatória' : 'Foto pendência opcional'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}


                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={loading || (disabledMainStatus && activeCompsToProcess.length === 0)}
                >
                    {loading ? "Enviando Lote..." : "Confirmar Instalação"}
                </button>
            </form>

            <div style={{ height: '50px' }}></div>

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
