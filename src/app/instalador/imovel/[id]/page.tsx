'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import styles from './page.module.css';

export default function ImovelDetalhesPage() {
    const { id } = useParams();
    const router = useRouter();
    const [imovel, setImovel] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'CONCLUIDO' | 'PENDENTE'>('CONCLUIDO');
    const [obs, setObs] = useState('');
    const [photo, setPhoto] = useState<File | null>(null);

    useEffect(() => {
        async function fetchImovel() {
            try {
                const res = await fetch(`/api/instalador/imovel/${id}`);
                const data = await res.json();
                setImovel(data.imovel);
            } catch (e) {
                console.error("Erro ao carregar imóvel");
            } finally {
                setLoading(false);
            }
        }
        fetchImovel();
    }, [id]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Mock do upload para simplificar (em produção, enviaria para S3/Disk)
        const fotos = photo ? [`/fotos/${imovel.bairro.nome}/${id}_${Date.now()}.webp`] : [];

        try {
            const res = await fetch('/api/instalador/atualizar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inscimob: id,
                    status,
                    obsPendente: obs,
                    fotos,
                    instaladorResp: "João Instalador"
                })
            });

            if (res.ok) {
                alert("Atualizado com sucesso!");
                router.push('/instalador');
            }
        } catch (e) {
            alert("Erro ao atualizar status.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="container text-center py-20">Carregando...</div>;
    if (!imovel) return <div className="container text-center py-20">Imóvel não encontrado.</div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <button onClick={() => router.back()} className={styles.backButton}>&larr; Voltar</button>
                <h1 className={styles.title}>Executar Instalação</h1>
            </header>

            <section className={styles.propertyCard}>
                <div className={styles.infoRow}>
                    <span>ID do Imóvel:</span>
                    <strong>{imovel.inscimob}</strong>
                </div>
                <div className={styles.infoRow}>
                    <span>Número a Instalar:</span>
                    <strong className={styles.highlight}>{imovel.numeroAInstalar}</strong>
                </div>
                <div className={styles.infoRow}>
                    <span>Bairro:</span>
                    <strong>{imovel.bairro.nome}</strong>
                </div>
            </section>

            <form onSubmit={handleUpdate} className={styles.form}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Status da Instalação</label>
                    <div className={styles.statusButtons}>
                        <button
                            type="button"
                            className={`${styles.statusBtn} ${status === 'CONCLUIDO' ? styles.statusActiveSuccess : ''}`}
                            onClick={() => setStatus('CONCLUIDO')}
                        >
                            Concluído
                        </button>
                        <button
                            type="button"
                            className={`${styles.statusBtn} ${status === 'PENDENTE' ? styles.statusActiveWarning : ''}`}
                            onClick={() => setStatus('PENDENTE')}
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
                        capture="environment"
                        className={styles.fileInput}
                        onChange={e => setPhoto(e.target.files?.[0] || null)}
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
                    />
                </div>

                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={loading}
                >
                    {loading ? "Salvando..." : "Confirmar Execução"}
                </button>
            </form>
        </div>
    );
}
