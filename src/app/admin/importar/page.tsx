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
        } catch (error) {
            alert("Erro na conexão.");
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
        </div>
    );
}
