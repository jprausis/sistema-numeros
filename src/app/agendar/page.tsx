'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import styles from './page.module.css';

// (41) 99999-9999
function formatPhone(value: string) {
    const d = value.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function AgendarPage() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({ nome: '', telefone: '', rua: '', numero: '', bairro: '' });

    const update = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setFormData({ ...formData, [field]: field === 'telefone' ? formatPhone(e.target.value) : e.target.value });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (formData.telefone.replace(/\D/g, '').length < 10) {
            setError('Informe um telefone válido com DDD.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/agendamentos/criar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao enviar a solicitação.');
            router.push(`/agendar/sucesso?protocolo=${encodeURIComponent(data.protocolo)}`);
        } catch (err: any) {
            setError(err.message || 'Erro na conexão com o servidor. Tente novamente.');
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <Link href="/" className={styles.backLink}><ArrowLeft size={16} /> Início</Link>
                <h1 className={styles.title}>Solicitar Instalação</h1>
                <p className={styles.subtitle}>
                    Preencha seus dados e a equipe da prefeitura entrará em contato para combinar a instalação do número da sua residência.
                </p>

                <form onSubmit={handleSubmit} className={styles.form} noValidate={false}>
                    <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="nome">Nome completo</label>
                        <input id="nome" type="text" required autoComplete="name" maxLength={120} className={styles.input} value={formData.nome} onChange={update('nome')} />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="telefone">Telefone / WhatsApp</label>
                        <input
                            id="telefone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            required
                            placeholder="(41) 99999-9999"
                            className={styles.input}
                            value={formData.telefone}
                            onChange={update('telefone')}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="rua">Rua / Avenida</label>
                        <input id="rua" type="text" required autoComplete="address-line1" maxLength={150} className={styles.input} value={formData.rua} onChange={update('rua')} />
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="numero">Número</label>
                            <input id="numero" type="text" inputMode="numeric" required maxLength={20} className={styles.input} value={formData.numero} onChange={update('numero')} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="bairro">Bairro</label>
                            <input id="bairro" type="text" required autoComplete="address-level3" maxLength={80} className={styles.input} value={formData.bairro} onChange={update('bairro')} />
                        </div>
                    </div>

                    {error && <p className={styles.error} role="alert">{error}</p>}

                    <button type="submit" disabled={submitting} className={styles.submitButton}>
                        {submitting ? <><Loader2 size={18} className="spin" /> Enviando...</> : 'Enviar solicitação'}
                    </button>
                    <p className={styles.privacy}>Seus dados são usados apenas para contato sobre a instalação.</p>
                </form>
            </div>
        </div>
    );
}
