'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    rua: '',
    numero: '',
    bairro: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      const res = await fetch('/api/agendamentos/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push(`/agendar/sucesso?protocolo=${data.protocolo}`);
      } else {
        alert(data.error || "Erro ao criar agendamento.");
      }
    } catch (error) {
      alert("Erro na conexão com o servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Rio Branco do Sul tem endereço</h1>
        <p className={styles.subtitle}>
            Preencha os dados abaixo para solicitar o número da sua residência.<br/><br/>
            <strong>Envie seus dados que nossa equipe entrará em contato sobre a instalação.</strong>
        </p>
      </header>

      <section className={styles.formCard}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Nome Completo</label>
            <input
              type="text"
              required
              className={styles.input}
              value={formData.nome}
              onChange={e => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Telefone / WhatsApp</label>
            <input
              type="tel"
              required
              placeholder="(00) 00000-0000"
              className={styles.input}
              value={formData.telefone}
              onChange={e => setFormData({ ...formData, telefone: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Logradouro (Rua/Av)</label>
            <input
              type="text"
              required
              className={styles.input}
              value={formData.rua}
              onChange={e => setFormData({ ...formData, rua: e.target.value })}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Número</label>
              <input
                type="text"
                required
                className={styles.input}
                value={formData.numero}
                onChange={e => setFormData({ ...formData, numero: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Bairro</label>
              <input
                type="text"
                required
                className={styles.input}
                value={formData.bairro}
                onChange={e => setFormData({ ...formData, bairro: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={submitting}
          >
            {submitting ? "Enviando..." : "Enviar Dados"}
          </button>
        </form>
      </section>

      <footer className={styles.footer}>
        <Link href="/login" className={styles.loginLink}>
          Acesso Restrito
        </Link>
      </footer>
    </main>
  );
}
