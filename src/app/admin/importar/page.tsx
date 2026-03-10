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
            <ComplementoImportSection />
            <ComplementoGeoJSONImportSection />
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
        formData.append("tipo", "MALHA");

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
            alert("Erro na conexão.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className={styles.uploadCard} style={{ marginTop: '2rem' }}>
            <h2 className={styles.title} style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Importar Malha de Imóveis (GeoJSON)</h2>
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
                </div>

                <button type="submit" className={styles.submitButton} disabled={loading} style={{ background: 'var(--secondary)', color: 'white' }}>
                    {loading ? "Processando..." : "Importar Malha"}
                </button>
            </form>

            {result && <ImportStats result={result} type="GEOJSON" />}
        </section>
    );
}

function ComplementoImportSection() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return alert("Selecione um arquivo Excel.");

        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("tipo", "COMPLEMENTOS");

        try {
            const res = await fetch("/api/admin/importar", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (res.ok) {
                setResult(data);
                alert("Complementos importados com sucesso!");
                setFile(null);
            } else {
                alert(data.error || "Erro na importação.");
            }
        } catch (error: any) {
            alert("Erro na conexão.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className={styles.uploadCard} style={{ marginTop: '2rem' }}>
            <h2 className={styles.title} style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Importar Lista de Complementos (Excel)</h2>
            <p className={styles.subtitle} style={{ marginBottom: '1.5rem' }}>Adicione múltiplas unidades (CS1, CS2...) aos imóveis existentes.</p>

            <form onSubmit={handleUpload} className={styles.form}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Planilha de Complementos (.xlsx, .xls)</label>
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        className={styles.fileInput}
                        onChange={e => setFile(e.target.files?.[0] || null)}
                        required
                    />
                    <p className={styles.help}>Colunas: unidade, indicacaof, número predial</p>
                </div>

                <button type="submit" className={styles.submitButton} disabled={loading} style={{ background: '#7c3aed', color: 'white' }}>
                    {loading ? "Processando..." : "Importar Complementos"}
                </button>
            </form>

            {result && <ImportStats result={result} type="EXCEL" />}
        </section>
    );
}

function ComplementoGeoJSONImportSection() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return alert("Selecione um arquivo GeoJSON.");

        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("tipo", "COMPLEMENTOS_GEOJSON");

        try {
            const res = await fetch("/api/admin/importar", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (res.ok) {
                setResult(data);
                alert("Localizações de complementos importadas!");
                setFile(null);
            } else {
                alert(data.error || "Erro na importação.");
            }
        } catch (error: any) {
            alert("Erro na conexão.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className={styles.uploadCard} style={{ marginTop: '2rem' }}>
            <h2 className={styles.title} style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Geolocalizar Complementos (GeoJSON)</h2>
            <p className={styles.subtitle} style={{ marginBottom: '1.5rem' }}>Defina a posição exata de cada unidade/casa no mapa.</p>

            <form onSubmit={handleUpload} className={styles.form}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>GeoJSON de Complementos (.geojson)</label>
                    <input
                        type="file"
                        accept=".geojson"
                        className={styles.fileInput}
                        onChange={e => setFile(e.target.files?.[0] || null)}
                        required
                    />
                    <p className={styles.help}>Propriedades: indicacaof, unidade</p>
                </div>

                <button type="submit" className={styles.submitButton} disabled={loading} style={{ background: '#db2777', color: 'white' }}>
                    {loading ? "Processando..." : "Importar Pontos GPS"}
                </button>
            </form>

            {result && <ImportStats result={result} type="GEOJSON" />}
        </section>
    );
}

function ImportStats({ result, type }: { result: any, type: 'EXCEL' | 'GEOJSON' }) {
    return (
        <div className={styles.stats} style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
            <div className={styles.statItem}>
                <span>Total Processado</span>
                <strong>{result.total}</strong>
            </div>
            <div className={styles.statItem}>
                <span>{type === 'EXCEL' ? 'Sucesso' : 'Vinculados'}</span>
                <strong>{type === 'EXCEL' ? result.imported : result.updated}</strong>
            </div>
            <div className={styles.statItem}>
                <span>{type === 'EXCEL' ? 'Erro' : 'Não Encontrados'}</span>
                <strong>{type === 'EXCEL' ? result.skipped : result.notFound}</strong>
            </div>
        </div>
    );
}
