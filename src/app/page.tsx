'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, getDay, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, string[]>>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    rua: '',
    numero: '',
    bairro: ''
  });

  useEffect(() => {
    async function fetchAllSlots() {
      setLoading(true);
      try {
        const res = await fetch('/api/agendamentos/disponibilidade?all=true');
        const data = await res.json();
        if (data.slotsByDate) {
          setSlotsByDate(data.slotsByDate);
          const dates = Object.keys(data.slotsByDate).sort();
          setAvailableDates(dates);
          if (dates.length > 0) {
            setSelectedDate(dates[0]);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar slots:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAllSlots();
  }, []);

  const slots = selectedDate && slotsByDate[selectedDate]
    ? slotsByDate[selectedDate].map(s => new Date(s))
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return alert("Selecione um horário.");

    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Rio Branco do Sul tem endereço</h1>
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
            <label className={styles.label}>Dias Disponíveis no Calendário</label>
            {loading ? (
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Buscando dias disponíveis...</p>
            ) : availableDates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '350px', margin: '0 auto' }}>
                {Array.from(new Set(availableDates.map(d => d.slice(0, 7)))).sort().map(monthStr => {
                  const [year, month] = monthStr.split('-').map(Number);
                  const firstDayDate = new Date(year, month - 1, 1);
                  const firstDayOfWeek = getDay(firstDayDate); // 0 (Dom) a 6 (Sab)
                  const daysInMonth = getDaysInMonth(firstDayDate);

                  const blanks = Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`blank-${i}`} style={{ padding: '0.5rem' }}></div>);

                  const days = Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isAvailable = availableDates.includes(dateStr);
                    const isSelected = selectedDate === dateStr;

                    if (isAvailable) {
                      return (
                        <button
                          key={dateStr}
                          type="button"
                          style={{
                            padding: '0.5rem',
                            borderRadius: '0.375rem',
                            border: isSelected ? '1px solid #2563eb' : '1px solid #d1d5db',
                            textAlign: 'center',
                            fontWeight: 500,
                            backgroundColor: isSelected ? '#2563eb' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#1f2937',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseOver={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#eff6ff' }}
                          onMouseOut={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff' }}
                          onClick={() => {
                            setSelectedDate(dateStr);
                            setSelectedSlot(null);
                          }}
                        >
                          {day}
                        </button>
                      );
                    } else {
                      return (
                        <div key={dateStr} style={{ padding: '0.5rem', textAlign: 'center', color: '#d1d5db', pointerEvents: 'none' }}>
                          {day}
                        </div>
                      );
                    }
                  });

                  return (
                    <div key={monthStr} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem', backgroundColor: '#f9fafb' }}>
                      <h3 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '1rem', textAlign: 'center', textTransform: 'capitalize' }}>
                        {format(firstDayDate, 'MMMM yyyy', { locale: ptBR })}
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
                        <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                        {blanks}
                        {days}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '0.875rem', color: '#ef4444' }}>Nenhum dia disponível para agendamento.</p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Horários Disponíveis</label>
            <div className={styles.slotGrid}>
              {loading ? (
                <p className={styles.message}>Carregando horários...</p>
              ) : !selectedDate ? (
                <p className={styles.message} style={{ gridColumn: '1 / -1' }}>
                  Selecione um dia para ver os horários.
                </p>
              ) : slots.length > 0 ? (
                slots.map(slot => {
                  const hours = slot.getUTCHours();
                  const mins = slot.getUTCMinutes();
                  const displayTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

                  return (
                    <button
                      key={slot.toISOString()}
                      type="button"
                      className={`${styles.slotButton} ${selectedSlot === slot.toISOString() ? styles.slotActive : ''}`}
                      onClick={() => setSelectedSlot(slot.toISOString())}
                    >
                      {displayTime}
                    </button>
                  );
                })
              ) : (
                <p className={styles.message} style={{ gridColumn: '1 / -1' }}>
                  Nenhum horário disponível para este dia.
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={submitting || !selectedSlot}
          >
            {submitting ? "Processando..." : "Confirmar Agendamento"}
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
