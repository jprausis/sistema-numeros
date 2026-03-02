'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    format(addDays(new Date(), 1), 'yyyy-MM-dd')
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    rua: '',
    numero: '',
    bairro: ''
  });

  // Buscar slots disponíveis quando a data muda
  useEffect(() => {
    async function fetchSlots() {
      setLoading(true);
      try {
        const res = await fetch(`/api/agendamentos/disponibilidade?date=${selectedDate}`);
        const data = await res.json();
        setSlots(data.slots.map((s: string) => new Date(s)));
      } catch (error) {
        console.error("Erro ao buscar slots:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSlots();
  }, [selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return alert("Selecione um horário.");

    setLoading(true);
    try {
      const res = await fetch('/api/agendamentos/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dataHora: selectedSlot
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
      setLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Sistema de Numeração Residencial</h1>
        <p className={styles.subtitle}>Agende a instalação do número oficial para sua residência.</p>
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

          <div className={styles.formGroup}>
            <label className={styles.label}>Data da Instalação</label>
            <input
              type="date"
              required
              min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
              className={styles.input}
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Horários Disponíveis</label>
            <div className={styles.slotGrid}>
              {loading ? (
                <p className={styles.message}>Carregando horários...</p>
              ) : slots.length > 0 ? (
                slots.map(slot => (
                  <button
                    key={slot.toISOString()}
                    type="button"
                    className={`${styles.slotButton} ${selectedSlot === slot.toISOString() ? styles.slotActive : ''}`}
                    onClick={() => setSelectedSlot(slot.toISOString())}
                  >
                    {format(slot, 'HH:mm')}
                  </button>
                ))
              ) : (
                <p className={styles.message}>Nenhum horário disponível para este dia.</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading || !selectedSlot}
          >
            {loading ? "Processando..." : "Confirmar Agendamento"}
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
