'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './page.module.css';

export default function AgendarPage() {
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
        <div className={styles.container}>
            <h1 className={styles.title}>Agendar Instalação</h1>
            <p className={styles.subtitle}>Preencha os dados abaixo para solicitar o número da sua residência.</p>

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

                <div className="flex gap-4">
                    <div className={styles.formGroup} style={{ flex: 1 }}>
                        <label className={styles.label}>Número</label>
                        <input
                            type="text"
                            required
                            className={styles.input}
                            value={formData.numero}
                            onChange={e => setFormData({ ...formData, numero: e.target.value })}
                        />
                    </div>
                    <div className={styles.formGroup} style={{ flex: 2 }}>
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
                        max={format(addDays(new Date(), 10), 'yyyy-MM-dd')}
                        className={styles.input}
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Horários Disponíveis (15 min)</label>
                    <div className={styles.slotGrid}>
                        {loading ? (
                            <p className="text-center py-4">Carregando horários...</p>
                        ) : slots.length > 0 ? (
                            slots.map(slot => {
                                // Ajustar exibição: se o servidor enviou em UTC, o browser interpretará localmente.
                                // Para forçar a exibição correta independente do fuso do browser/servidor:
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
                            <p className="text-center py-4" style={{ gridColumn: '1 / -1' }}>
                                Nenhum horário disponível para este dia.
                            </p>
                        )}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || !selectedSlot}
                    className={styles.submitButton}
                >
                    {loading ? "Processando..." : "Confirmar Agendamento"}
                </button>
            </form >
        </div >
    );
}
