'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function ConfiguracoesPage() {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    async function fetchConfig() {
        try {
            const res = await fetch('/api/admin/config');
            const data = await res.json();
            setConfig(data.config);
        } catch (e) {
            console.error("Erro ao buscar config");
        } finally {
            setLoading(false);
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/admin/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (res.ok) alert("Configurações salvas!");
        } catch (e) {
            alert("Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = (key: string, value: string) => {
        setConfig({ ...config, [key]: value });
    };

    if (loading) return <div>Carregando...</div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Configurações do Sistema</h1>
                <p>Ajuste as regras de negócio dinamicamente.</p>
            </header>

            <form onSubmit={handleSave} className={styles.form}>
                <section className={styles.section}>
                    <h3>Regras de Agendamento</h3>

                    <div className={styles.grid}>
                        <div className={styles.formGroup}>
                            <label>Horário Inicial</label>
                            <input
                                type="time"
                                value={config.hours_start}
                                onChange={e => updateConfig('hours_start', e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Horário Final</label>
                            <input
                                type="time"
                                value={config.hours_end}
                                onChange={e => updateConfig('hours_end', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.grid}>
                        <div className={styles.formGroup}>
                            <label>Duração do Slot (min)</label>
                            <input
                                type="number"
                                value={config.slot_duration}
                                onChange={e => updateConfig('slot_duration', e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Capacidade por Slot</label>
                            <input
                                type="number"
                                value={config.capacity_per_slot}
                                onChange={e => updateConfig('capacity_per_slot', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.grid}>
                        <div className={styles.formGroup}>
                            <label>Antecedência Mínima (dias)</label>
                            <input
                                type="number"
                                value={config.lead_time_days || ''}
                                onChange={e => updateConfig('lead_time_days', e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Dias Máximos (Faixa)</label>
                            <input
                                type="number"
                                value={config.max_scheduling_days || ''}
                                onChange={e => updateConfig('max_scheduling_days', e.target.value)}
                            />
                        </div>
                    </div>
                </section>

                <button type="submit" className={styles.saveButton} disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </form>
        </div>
    );
}
