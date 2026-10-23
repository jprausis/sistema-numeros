'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle, ArrowDownToLine, Boxes, ClipboardList, Download, Factory, History, Loader2, PackagePlus,
    SlidersHorizontal, TrendingDown, X
} from 'lucide-react';
import ui from '../admin.module.css';
import styles from './page.module.css';
import { toast } from '@/utils/toast';
import { formatBrazil, todayBrazil } from '@/lib/timezone';
import { CARACTERES, Caractere, Contagem, contagemVazia, totalContagem } from '@/utils/estoque';

interface BairroPendente {
    bairroId: string;
    nome: string;
    contagem: Contagem;
    imoveis: number;
    complementos: number;
    total: number;
}

interface Movimento {
    id: string;
    caractere: string;
    quantidade: number;
    tipo: string;
    referencia: string | null;
    descricao: string | null;
    userEmail: string | null;
    createdAt: string;
}

interface EstoqueData {
    estoque: Contagem;
    atualizadoEm: string | null;
    pendentes: { geral: Contagem; porBairro: BairroPendente[]; imoveis: number; complementos: number };
    consumo30d: Contagem;
    diasConsumo: number;
    movimentos: Movimento[];
}

const TIPO_LABEL: Record<string, string> = {
    ENTRADA: 'Entrada',
    AJUSTE: 'Ajuste',
    INSTALACAO: 'Instalação',
    ESTORNO: 'Estorno',
};

const fmt = (n: number) => n.toLocaleString('pt-BR');

export default function EstoquePage() {
    const [data, setData] = useState<EstoqueData | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);
    const [bairroFiltro, setBairroFiltro] = useState('');
    const [modal, setModal] = useState<'ENTRADA' | 'AJUSTE' | null>(null);

    const carregar = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/estoque');
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setData(json);
        } catch (e: any) {
            toast.error(e.message || 'Erro ao carregar o estoque.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregar();
        fetch('/api/auth/me').then(r => r.json()).then(d => setRole(d.user?.role || null)).catch(() => {});
    }, [carregar]);

    // Pendências do bairro selecionado (ou de todos)
    const pendentes = useMemo(() => {
        if (!data) return contagemVazia();
        if (!bairroFiltro) return data.pendentes.geral;
        return data.pendentes.porBairro.find(b => b.bairroId === bairroFiltro)?.contagem || contagemVazia();
    }, [data, bairroFiltro]);

    if (loading || !data) {
        return <div className="page-loading"><Loader2 size={28} className="spin" /> Carregando estoque...</div>;
    }

    const isAdmin = role === 'ADMIN';
    const linhas = CARACTERES.map(c => {
        const estoque = data.estoque[c];
        const pend = pendentes[c];
        const saldo = estoque - pend;
        const consumoDia = data.consumo30d[c] / data.diasConsumo;
        return {
            c,
            estoque,
            pendente: pend,
            saldo,
            aProduzir: Math.max(0, -saldo),
            consumo: data.consumo30d[c],
            cobertura: consumoDia > 0 ? Math.max(0, Math.floor(estoque / consumoDia)) : null,
        };
    });
    const totalEstoque = totalContagem(data.estoque);
    const totalPendente = totalContagem(pendentes);
    const totalProduzir = linhas.reduce((s, l) => s + l.aProduzir, 0);
    const totalConsumo = totalContagem(data.consumo30d);
    const maxPendente = Math.max(...linhas.map(l => Math.max(l.pendente, l.estoque)), 1);
    const bairroNome = data.pendentes.porBairro.find(b => b.bairroId === bairroFiltro)?.nome;
    const bairroSel = data.pendentes.porBairro.find(b => b.bairroId === bairroFiltro);

    const exportarCsv = () => {
        const header = ['Bairro', 'Imóveis', 'Complementos', ...CARACTERES, 'Total'];
        const rows = data.pendentes.porBairro.map(b => [b.nome, b.imoveis, b.complementos, ...CARACTERES.map(c => b.contagem[c]), b.total]);
        rows.push(['TOTAL PENDENTE', data.pendentes.imoveis, data.pendentes.complementos, ...CARACTERES.map(c => data.pendentes.geral[c]), totalContagem(data.pendentes.geral)]);
        rows.push(['EM ESTOQUE', '', '', ...CARACTERES.map(c => data.estoque[c]), totalEstoque]);
        rows.push(['A PRODUZIR', '', '', ...CARACTERES.map(c => Math.max(0, data.pendentes.geral[c] - data.estoque[c])), CARACTERES.reduce((s, c) => s + Math.max(0, data.pendentes.geral[c] - data.estoque[c]), 0)]);
        const csv = '﻿' + [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `planejamento_producao_${todayBrazil()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className={ui.container}>
            <header className={ui.header}>
                <div>
                    <h1>Estoque de Algarismos</h1>
                    <p>
                        Placas em estoque, baixa automática nas instalações e previsão de produção.
                        {data.atualizadoEm && <> Última movimentação em {formatBrazil(data.atualizadoEm, true)}.</>}
                    </p>
                </div>
                <div className={ui.headerActions}>
                    <button className={ui.btnSecondary} onClick={exportarCsv}>
                        <Download size={16} /> Exportar planejamento
                    </button>
                    {isAdmin && (
                        <>
                            <button className={ui.btnSecondary} onClick={() => setModal('AJUSTE')}>
                                <SlidersHorizontal size={16} /> Ajustar contagem
                            </button>
                            <button className={ui.btnPrimary} onClick={() => setModal('ENTRADA')}>
                                <PackagePlus size={16} /> Registrar entrada
                            </button>
                        </>
                    )}
                </div>
            </header>

            <div className={styles.kpis}>
                <Kpi icon={Boxes} label="Em estoque" value={fmt(totalEstoque)} sub="caracteres disponíveis" tone={styles.toneNeutral} />
                <Kpi
                    icon={ClipboardList}
                    label={bairroNome ? `Pendente em ${bairroNome}` : 'Pendente de instalar'}
                    value={fmt(totalPendente)}
                    sub={bairroSel
                        ? `${fmt(bairroSel.imoveis)} imóveis + ${fmt(bairroSel.complementos)} complementos`
                        : `${fmt(data.pendentes.imoveis)} imóveis + ${fmt(data.pendentes.complementos)} complementos`}
                    tone={styles.toneInfo}
                />
                <Kpi
                    icon={Factory}
                    label="A produzir"
                    value={fmt(totalProduzir)}
                    sub={totalProduzir > 0 ? 'faltam para cobrir as pendências' : 'estoque cobre as pendências'}
                    tone={totalProduzir > 0 ? styles.toneDanger : styles.toneSuccess}
                />
                <Kpi icon={TrendingDown} label={`Consumo (${data.diasConsumo} dias)`} value={fmt(totalConsumo)} sub="caracteres instalados" tone={styles.toneNeutral} />
            </div>

            <section className={ui.card}>
                <div className={styles.sectionHead}>
                    <div>
                        <h2 className={ui.cardTitle}>Saldo por caractere</h2>
                        <p className={ui.cardSubtitle}>
                            Pendentes = imóveis <strong>Liberados</strong> e <strong>Ausentes</strong> + complementos liberados ainda não instalados.
                            O <strong>6</strong> e o <strong>9</strong> usam a mesma peça e são contados juntos em <strong>6/9</strong>.
                        </p>
                    </div>
                    <select className={ui.select} value={bairroFiltro} onChange={e => setBairroFiltro(e.target.value)} aria-label="Filtrar pendências por bairro">
                        <option value="">Todos os bairros</option>
                        {data.pendentes.porBairro.map(b => <option key={b.bairroId} value={b.bairroId}>{b.nome}</option>)}
                    </select>
                </div>
                <div className={ui.tableWrap}>
                    <table className={`${ui.table} ${styles.totalsTable}`}>
                        <thead>
                            <tr>
                                <th>Caractere</th>
                                <th className={styles.num}>Em estoque</th>
                                <th className={styles.num}>Pendente</th>
                                <th className={styles.barCol}>Estoque × pendente</th>
                                <th className={styles.num}>Saldo</th>
                                <th className={styles.num}>A produzir</th>
                                <th className={styles.num}>Consumo {data.diasConsumo}d</th>
                                <th className={styles.num}>Cobertura</th>
                            </tr>
                        </thead>
                        <tbody>
                            {linhas.map(l => (
                                <tr key={l.c}>
                                    <td><span className={styles.charChip}>{l.c}</span></td>
                                    <td className={`${styles.num} ${l.estoque < 0 ? styles.negative : ''}`}>{fmt(l.estoque)}</td>
                                    <td className={styles.num}>{fmt(l.pendente)}</td>
                                    <td className={styles.barCol}>
                                        <div className={styles.barTrack} title={`Estoque ${l.estoque} • Pendente ${l.pendente}`}>
                                            <div className={styles.barStock} style={{ width: `${(Math.max(0, l.estoque) / maxPendente) * 100}%` }} />
                                            <div className={styles.barPending} style={{ width: `${(l.pendente / maxPendente) * 100}%` }} />
                                        </div>
                                    </td>
                                    <td className={`${styles.num} ${l.saldo < 0 ? styles.negative : styles.positive}`}>
                                        {l.saldo > 0 ? '+' : ''}{fmt(l.saldo)}
                                    </td>
                                    <td className={styles.num}>
                                        {l.aProduzir > 0
                                            ? <span className={styles.produzir}><AlertTriangle size={13} aria-hidden /> {fmt(l.aProduzir)}</span>
                                            : <span className={styles.ok}>—</span>}
                                    </td>
                                    <td className={styles.num}>{fmt(l.consumo)}</td>
                                    <td className={styles.num}>{l.cobertura === null ? '—' : `${fmt(l.cobertura)} dias`}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td><strong>Total</strong></td>
                                <td className={styles.num}><strong>{fmt(totalEstoque)}</strong></td>
                                <td className={styles.num}><strong>{fmt(totalPendente)}</strong></td>
                                <td className={styles.barCol}>
                                    <span className={styles.legend}><i className={styles.dotStock} /> Estoque <i className={styles.dotPending} /> Pendente</span>
                                </td>
                                <td className={`${styles.num} ${totalEstoque - totalPendente < 0 ? styles.negative : styles.positive}`}>
                                    <strong>{fmt(totalEstoque - totalPendente)}</strong>
                                </td>
                                <td className={styles.num}><strong>{fmt(totalProduzir)}</strong></td>
                                <td className={styles.num}><strong>{fmt(totalConsumo)}</strong></td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>

            <section className={ui.card}>
                <div className={styles.sectionHead}>
                    <div>
                        <h2 className={ui.cardTitle}>Pendências por bairro</h2>
                        <p className={ui.cardSubtitle}>Caracteres necessários para os imóveis liberados e ausentes de cada bairro.</p>
                    </div>
                </div>
                <div className={ui.tableWrap}>
                    <table className={`${ui.table} ${styles.matrix}`}>
                        <thead>
                            <tr>
                                <th>Bairro</th>
                                {CARACTERES.map(c => <th key={c} className={styles.num}>{c}</th>)}
                                <th className={styles.num}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.pendentes.porBairro.length === 0 ? (
                                <tr><td colSpan={CARACTERES.length + 2}><div className={ui.emptyState}><ClipboardList size={36} /><strong>Nenhuma pendência</strong>Não há imóveis liberados ou ausentes no momento.</div></td></tr>
                            ) : data.pendentes.porBairro.map(b => (
                                <tr
                                    key={b.bairroId}
                                    className={b.bairroId === bairroFiltro ? styles.rowSelected : ''}
                                    onClick={() => setBairroFiltro(b.bairroId === bairroFiltro ? '' : b.bairroId)}
                                    title="Clique para filtrar o saldo por este bairro"
                                >
                                    <td>
                                        <strong>{b.nome}</strong>
                                        <span className={ui.cellSub}>{fmt(b.imoveis)} imóveis • {fmt(b.complementos)} compl.</span>
                                    </td>
                                    {CARACTERES.map(c => (
                                        <td key={c} className={`${styles.num} ${b.contagem[c] === 0 ? styles.zero : ''}`}>{fmt(b.contagem[c])}</td>
                                    ))}
                                    <td className={styles.num}><strong>{fmt(b.total)}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                        {data.pendentes.porBairro.length > 0 && (
                            <tfoot>
                                <tr>
                                    <td><strong>Total</strong></td>
                                    {CARACTERES.map(c => <td key={c} className={styles.num}><strong>{fmt(data.pendentes.geral[c])}</strong></td>)}
                                    <td className={styles.num}><strong>{fmt(totalContagem(data.pendentes.geral))}</strong></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </section>

            <section className={ui.card}>
                <div className={styles.sectionHead}>
                    <div>
                        <h2 className={ui.cardTitle}><History size={18} className={styles.titleIcon} /> Últimas movimentações</h2>
                        <p className={ui.cardSubtitle}>Entradas e ajustes manuais e baixas automáticas das instalações.</p>
                    </div>
                </div>
                <div className={ui.tableWrap}>
                    <table className={ui.table}>
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Tipo</th>
                                <th>Caractere</th>
                                <th className={styles.num}>Quantidade</th>
                                <th>Descrição</th>
                                <th>Usuário</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.movimentos.length === 0 ? (
                                <tr><td colSpan={6}><div className={ui.emptyState}><ArrowDownToLine size={36} /><strong>Nenhuma movimentação ainda</strong>Registre a contagem inicial em &ldquo;Ajustar contagem&rdquo;.</div></td></tr>
                            ) : data.movimentos.map(m => (
                                <tr key={m.id}>
                                    <td className={styles.nowrap}>{formatBrazil(m.createdAt, true)}</td>
                                    <td><span className={`${styles.tipo} ${styles[`tipo${m.tipo}`] || ''}`}>{TIPO_LABEL[m.tipo] || m.tipo}</span></td>
                                    <td><span className={styles.charChipSm}>{m.caractere}</span></td>
                                    <td className={`${styles.num} ${m.quantidade < 0 ? styles.negative : styles.positive}`}>
                                        {m.quantidade > 0 ? '+' : ''}{fmt(m.quantidade)}
                                    </td>
                                    <td className={styles.desc}>{m.descricao || '—'}</td>
                                    <td className={styles.nowrap}>{m.userEmail || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {modal && (
                <LancamentoModal
                    modo={modal}
                    estoqueAtual={data.estoque}
                    onClose={() => setModal(null)}
                    onSaved={() => { setModal(null); carregar(); }}
                />
            )}
        </div>
    );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub: string; tone: string }) {
    return (
        <div className={`${styles.kpi} ${tone}`}>
            <div className={styles.kpiHead}>
                <span>{label}</span>
                <span className={styles.kpiIcon}><Icon size={18} aria-hidden /></span>
            </div>
            <strong>{value}</strong>
            <small>{sub}</small>
        </div>
    );
}

function LancamentoModal({ modo, estoqueAtual, onClose, onSaved }: {
    modo: 'ENTRADA' | 'AJUSTE';
    estoqueAtual: Contagem;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [valores, setValores] = useState<Record<Caractere, string>>(() =>
        Object.fromEntries(CARACTERES.map(c => [c, modo === 'AJUSTE' ? String(estoqueAtual[c]) : ''])) as Record<Caractere, string>
    );
    const [observacao, setObservacao] = useState('');
    const [saving, setSaving] = useState(false);

    const totalInformado = CARACTERES.reduce((s, c) => s + (Number(valores[c]) || 0), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/admin/estoque', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modo, valores, observacao })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro ao salvar.');
            toast.success(modo === 'ENTRADA' ? 'Entrada registrada no estoque.' : 'Contagem do estoque ajustada.');
            onSaved();
        } catch (err: any) {
            toast.error(err.message);
            setSaving(false);
        }
    };

    return (
        <div className={ui.modalOverlay} onClick={() => !saving && onClose()}>
            <div className={ui.modal} role="dialog" aria-modal="true" aria-labelledby="estoque-modal-title" onClick={e => e.stopPropagation()}>
                <div className={ui.modalHeader}>
                    <div>
                        <h3 id="estoque-modal-title">{modo === 'ENTRADA' ? 'Registrar entrada' : 'Ajustar contagem'}</h3>
                        <p className={ui.cardSubtitle}>
                            {modo === 'ENTRADA'
                                ? 'Informe quantas unidades de cada caractere chegaram. Elas serão somadas ao estoque.'
                                : 'Informe o total contado fisicamente de cada caractere. O estoque passa a ser exatamente este valor.'}
                        </p>
                    </div>
                    <button type="button" className={ui.iconBtn} onClick={onClose} aria-label="Fechar" disabled={saving}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className={ui.form}>
                    <div className={styles.inputGrid}>
                        {CARACTERES.map(c => (
                            <label key={c} className={styles.charInput}>
                                <span className={styles.charChip}>{c}</span>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    step={1}
                                    placeholder="0"
                                    aria-label={`Quantidade do caractere ${c}`}
                                    value={valores[c]}
                                    onChange={e => setValores(v => ({ ...v, [c]: e.target.value }))}
                                />
                                {modo === 'AJUSTE' && Number(valores[c]) !== estoqueAtual[c] && valores[c] !== '' && (
                                    <small className={Number(valores[c]) - estoqueAtual[c] < 0 ? styles.negative : styles.positive}>
                                        {Number(valores[c]) - estoqueAtual[c] > 0 ? '+' : ''}{Number(valores[c]) - estoqueAtual[c]}
                                    </small>
                                )}
                            </label>
                        ))}
                    </div>

                    <div className={ui.field}>
                        <label htmlFor="estoque-obs">Observação (opcional)</label>
                        <input
                            id="estoque-obs"
                            type="text"
                            maxLength={300}
                            placeholder={modo === 'ENTRADA' ? 'Ex: Lote 12 da gráfica' : 'Ex: Contagem do almoxarifado'}
                            value={observacao}
                            onChange={e => setObservacao(e.target.value)}
                        />
                    </div>

                    <div className={ui.formActions}>
                        {modo === 'ENTRADA' && <span className={styles.totalHint}>Total: <strong>{fmt(totalInformado)}</strong> caracteres</span>}
                        <button type="button" className={ui.btnGhost} onClick={onClose} disabled={saving}>Cancelar</button>
                        <button type="submit" className={ui.btnPrimary} disabled={saving}>
                            {saving && <Loader2 size={16} className="spin" />}
                            {modo === 'ENTRADA' ? 'Somar ao estoque' : 'Salvar contagem'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
