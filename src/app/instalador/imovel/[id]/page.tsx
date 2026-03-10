'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import styles from './page.module.css';
import { createClient } from '@/utils/supabase/client';

export default function ImovelDetalhesPage() {
    const { id } = useParams();
    const router = useRouter();
    const supabase = createClient();
    const [imovel, setImovel] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'CONCLUIDO' | 'PENDENTE'>('CONCLUIDO');
    const [obs, setObs] = useState('');
    const [photo, setPhoto] = useState<File | null>(null);
    const [selectedComplemento, setSelectedComplemento] = useState<any>(null);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                setUser(user);

                const res = await fetch(`/api/instalador/imovel/${id}`);
                const data = await res.json();
                setImovel(data.imovel);
            } catch (e) {
                console.error("Erro ao carregar dados");
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validação de foto obrigatória para conclusão
        if (status === 'CONCLUIDO' && !photo) {
            alert("⚠️ Você deve tirar uma foto para concluir a instalação.");
            return;
        }

        setLoading(true);

        const folder = imovel.bairro.nome || 'geral';
        let fotos: string[] = [];

        try {
            // Fazer upload da foto se ela existir
            if (photo) {
                const formData = new FormData();
                const fileName = selectedComplemento
                    ? `${id}_${selectedComplemento.unidade}_${Date.now()}.webp`
                    : `${id}_${Date.now()}.webp`;

                formData.append("file", photo, fileName);
                formData.append("folder", folder);

                const uploadRes = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                if (!uploadRes.ok) {
                    throw new Error("Falha no upload da foto.");
                }

                const uploadData = await uploadRes.json();
                fotos = [uploadData.url];
            }

            let res;
            if (selectedComplemento) {
                res = await fetch('/api/instalador/complemento/atualizar', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: selectedComplemento.id,
                        status,
                        fotos,
                        instaladorResp: user?.user_metadata?.name || user?.email || "Instalador",
                        userId: user?.id,
                        userEmail: user?.email
                    })
                });
            } else {
                res = await fetch('/api/instalador/atualizar', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        inscimob: id,
                        status,
                        obsPendente: obs,
                        fotos,
                        instaladorResp: user?.user_metadata?.name || user?.email || "Instalador",
                        userId: user?.id,
                        userEmail: user?.email
                    })
                });
            }

            if (res.ok) {
                alert("Atualizado com sucesso!");
                if (selectedComplemento) {
                    // Recarregar dados para ver atualização
                    setSelectedComplemento(null);
                    setLoading(true);
                    const refreshRes = await fetch(`/api/instalador/imovel/${id}`);
                    const refreshData = await refreshRes.json();
                    setImovel(refreshData.imovel);
                    setLoading(false);
                    setObs('');
                    setPhoto(null);
                } else {
                    router.push('/instalador');
                }
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

    const hasComplementos = imovel.complementos && imovel.complementos.length > 0;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <button
                    onClick={() => selectedComplemento ? setSelectedComplemento(null) : router.back()}
                    className={styles.backButton}
                >
                    &larr; Voltar
                </button>
                <h1 className={styles.title}>
                    {selectedComplemento ? `Complemento ${selectedComplemento.numeroPredial}` : 'Executar Instalação'}
                </h1>
            </header>

            {selectedComplemento ? (
                <div className={styles.selectedComplementAlert}>
                    <span>📍 Unidade Selecionada: <strong>{selectedComplemento.numeroPredial}</strong></span>
                    <button onClick={() => {
                        setSelectedComplemento(null);
                        setPhoto(null);
                        setObs('');
                    }} className={styles.changeBtn}>Voltar p/ Principal</button>
                </div>
            ) : (
                <div className={styles.mainWorkAlert}>
                    <span>🏠 Número Principal: <strong>{imovel.numeroAInstalar}</strong></span>
                </div>
            )}

            {(!selectedComplemento && imovel.status !== 'LIBERADO' && imovel.status !== 'NAO_INICIADO' && imovel.status !== 'AUSENTE' && imovel.status !== 'PENDENTE') && (
                <div className={styles.warningBanner}>
                    ⚠️ O número principal ainda não foi liberado pela prefeitura.
                </div>
            )}

            <form onSubmit={handleUpdate} className={styles.form}>
                <h2 className={styles.sectionTitle}>
                    {selectedComplemento ? `Instalar Unidade: ${selectedComplemento.numeroPredial}` : `Instalar Número Principal: ${imovel.numeroAInstalar}`}
                </h2>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Status da Instalação</label>
                    <div className={styles.statusButtons}>
                        <button
                            type="button"
                            className={`${styles.statusBtn} ${status === 'CONCLUIDO' ? styles.statusActiveSuccess : ''}`}
                            onClick={() => setStatus('CONCLUIDO')}
                            disabled={!selectedComplemento && imovel.status !== 'LIBERADO' && imovel.status !== 'PENDENTE' && imovel.status !== 'AUSENTE'}
                        >
                            Concluído
                        </button>
                        <button
                            type="button"
                            className={`${styles.statusBtn} ${status === 'PENDENTE' ? styles.statusActiveWarning : ''}`}
                            onClick={() => setStatus('PENDENTE')}
                            disabled={!selectedComplemento && imovel.status !== 'LIBERADO' && imovel.status !== 'PENDENTE' && imovel.status !== 'AUSENTE'}
                        >
                            Pendente
                        </button>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>
                        {status === 'CONCLUIDO' ? 'Foto do Número Instalado' : 'Foto da Pendência (Opcional)'}
                    </label>
                    <input
                        type="file"
                        accept="image/*"
                        className={styles.fileInput}
                        onChange={e => setPhoto(e.target.files?.[0] || null)}
                        disabled={!selectedComplemento && imovel.status !== 'LIBERADO' && imovel.status !== 'PENDENTE' && imovel.status !== 'AUSENTE'}
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Observações / Motivo da Pendência</label>
                    <textarea
                        className={styles.textarea}
                        value={obs}
                        onChange={e => setObs(e.target.value)}
                        placeholder={status === 'PENDENTE' ? "Ex: Imóvel fechado, morador não encontrado..." : "Notas adicionais..."}
                        required={status === 'PENDENTE'}
                        disabled={!selectedComplemento && imovel.status !== 'LIBERADO' && imovel.status !== 'PENDENTE' && imovel.status !== 'AUSENTE'}
                    />
                </div>

                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={loading || (!selectedComplemento && imovel.status !== 'LIBERADO' && imovel.status !== 'PENDENTE' && imovel.status !== 'AUSENTE')}
                >
                    {loading ? "Salvando..." : "Confirmar Execução"}
                </button>
            </form>

            {hasComplementos && !selectedComplemento && (
                <div className={styles.complementSection}>
                    <div className={styles.divider}></div>
                    <h2 className={styles.sectionTitle}>Casas / Unidades Vinculadas:</h2>
                    <div className={styles.complementList}>
                        {imovel.complementos.map((c: any) => (
                            <button
                                key={c.id}
                                className={styles.complementCard}
                                disabled={!c.liberadoInstalacao}
                                onClick={() => {
                                    setSelectedComplemento(c);
                                    setPhoto(null);
                                    setObs('');
                                }}
                            >
                                <div className={styles.complementInfo}>
                                    <h3>{c.numeroPredial}</h3>
                                    <p>Unidade: {c.unidade}</p>
                                </div>
                                <span className={`${styles.statusPill} ${c.status} ${!c.liberadoInstalacao ? styles.BLOQUEADO : ''}`}>
                                    {!c.liberadoInstalacao ? 'Bloqueado' :
                                        c.status === 'NAO_INICIADO' ? 'Pendente' :
                                            c.status === 'CONCLUIDO' ? 'Concluído' : c.status}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
