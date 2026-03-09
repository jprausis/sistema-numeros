'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function AdminImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [bairro, setBairro] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !bairro) return alert("Selecione um arquivo e informe o bairro.");

        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bairro", bairro);

        try {
            const res = await fetch("/api/admin/importar", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (res.ok) {
                setResult(data);
                alert("Importação concluída com sucesso!");
                setFile(null);
                setBairro('');
            } else {
                alert(data.error || "Erro na importação.");
            }
        } catch (error: any) {
            console.error("Erro na requisição de importação:", error);
            alert("Erro na conexão ou o arquivo é muito grande para o servidor processar a tempo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Importar Dados Prefeitura</h1>
                <p className={styles.subtitle}>Crie um novo lote de imóveis a partir de uma planilha XLS.</p>
            </header>

            <section className={styles.uploadCard}>
                <form onSubmit={handleUpload} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Nome do Bairro / Região</label>
                        <input
                            type="text"
                            placeholder="Ex: Centro Norte"
                            className={styles.input}
                            value={bairro}
                            onChange={e => setBairro(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Arquivo da Planilha (.xls, .xlsx)</label>
                        <input
                            type="file"
                            accept=".xls,.xlsx"
                            className={styles.fileInput}
                            onChange={e => setFile(e.target.files?.[0] || null)}
                            required
                        />
                        <p className={styles.help}>Colunas esperadas: inscimob, x, y, Número</p>
                    </div>

                    <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={loading}
                    >
                        {loading ? "Processando..." : "Iniciar Importação"}
                    </button>
                </form>
            </section>

            {result && (
                <section className={styles.resultCard}>
                    <h3>Resultado da última ação</h3>
                    <div className={styles.stats}>
                        <div className={styles.statItem}>
                            <span>Total na Planilha</span>
                            <strong>{result.total}</strong>
                        </div>
                        <div className={styles.statItem}>
                            <span>Importados</span>
                            <strong>{result.imported}</strong>
                        </div>
                        <div className={styles.statItem}>
                            <span>Ignorados (Erro)</span>
                            <strong>{result.skipped}</strong>
                        </div>
                    </div>
                </section>
            )}

            <GeoJSONImportSection />
        </div>
    );
}

function GeoJSONImportSection() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return alert("Selecione um arquivo GeoJSON.");

        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bairro", "N/A"); // Não necessário para GeoJSON mas a rota atual espera

        try {
            const res = await fetch("/api/admin/importar", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (res.ok) {
                setResult(data);
                alert("Vetores importados com sucesso!");
                setFile(null);
            } else {
                alert(data.error || "Erro na importação de vetores.");
            }
        } catch (error: any) {
            console.error("Erro na requisição de vetores:", error);
            alert("Erro na conexão. Se o arquivo for muito grande (milhares de lotes), o processamento continuará no servidor, mas a conexão do navegador expirou.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className={styles.uploadCard} style={{ marginTop: '2rem' }}>
            <h2 className={styles.title} style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Importar Vetores (GeoJSON)</h2>
            <p className={styles.subtitle} style={{ marginBottom: '1.5rem' }}>Vincule os desenhos dos lotes aos imóveis existentes pelo campo <strong>inscimob</strong>.</p>

            <form onSubmit={handleUpload} className={styles.form}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Arquivo GeoJSON (.geojson)</label>
                    <input
                        type="file"
                        accept=".geojson,application/geo+json"
                        className={styles.fileInput}
                        onChange={e => setFile(e.target.files?.[0] || null)}
                        required
                    />
                    <p className={styles.help}>O arquivo será processado em segundo plano.</p>
                </div>

                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={loading}
                    style={{ background: 'var(--secondary)', color: 'white' }}
                >
                    {loading ? "Processando Vetores..." : "Importar Vetores"}
                </button>
            </form>

            {result && (
                <div className={styles.stats} style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                    <div className={styles.statItem}>
                        <span>Total de Feições</span>
                        <strong>{result.total}</strong>
                    </div>
                    <div className={styles.statItem}>
                        <span>Vinculados</span>
                        <strong>{result.updated}</strong>
                    </div>
                    <div className={styles.statItem}>
                        <span>Não Encontrados</span>
                        <strong>{result.notFound}</strong>
                    </div>
                </div>
            )}
        </section>
    );
}
