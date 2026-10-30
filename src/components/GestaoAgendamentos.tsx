'use client';

import { useState, useEffect } from 'react';
import { Ban, CalendarDays, CheckCircle2, Clock, FileText, Flag, Link2, Pencil, Phone, Plus, Search, Trash2, User, Users, X } from 'lucide-react';
import styles from './gestaoAgendamentos.module.css';
import { toast } from '@/utils/toast';
import { splitBrazilDate, BR_TIMEZONE } from '@/lib/timezone';
import { statusLabel, whatsappLink } from '@/utils/status';
import ImovelInfoModal from '@/components/ImovelInfoModal';
import { useHorariosOcupados } from '@/utils/useHorariosOcupados';
import { NOME_PADRAO_AGENDAMENTO, validarContato } from '@/utils/contato';
import { buscarAgendamentoAberto, confirmarAgendamentoExistente, confirmarRemarcacao, mensagemAgendamentoExistente, mensagemImovelConcluido, postAgendamento, type AgendamentoResumo, type ImovelResumo } from '@/utils/avisosAgendamento';
import { useDialog } from '@/utils/useDialog';

const fmtData = (d: string | Date) => new Date(d).toLocaleDateString('pt-BR', { timeZone: BR_TIMEZONE });
const fmtHora = (d: string | Date) => new Date(d).toLocaleTimeString('pt-BR', { timeZone: BR_TIMEZONE, hour: '2-digit', minute: '2-digit' });

interface Props {
    /**
     * "prefeitura": agenda pela própria tela (Novo agendamento), cancela em vez de excluir
     * e não marca a instalação como concluída. "admin": gestão completa.
     */
    modo?: 'admin' | 'prefeitura';
}

export default function GestaoAgendamentos({ modo = 'admin' }: Props) {
    const prefeitura = modo === 'prefeitura';
    const [activeTab, setActiveTab] = useState<'agendamentos' | 'concluidos' | 'contatos'>('agendamentos');
    const [items, setItems] = useState<any[]>([]);
    const [totalAgendamentos, setTotalAgendamentos] = useState(0);
    const [totalConcluidos, setTotalConcluidos] = useState(0);
    const [totalContatos, setTotalContatos] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [totalAtrasados, setTotalAtrasados] = useState(0);
    const [imovelInfo, setImovelInfo] = useState<{ inscimob: string; imovel?: any } | null>(null);

    // Filtros da fila
    type Periodo = 'todos' | 'atrasados' | 'hoje' | 'amanha' | 'semana' | 'dia';
    const [periodo, setPeriodo] = useState<Periodo>('todos');
    const [dataFiltro, setDataFiltro] = useState('');
    const [statusFiltro, setStatusFiltro] = useState('');

    // Estado para Vincular em Contatos
    const [vinculando, setVinculando] = useState<string | null>(null);
    const [inscimobInput, setInscimobInput] = useState('');
    // Avisos da inscrição digitada no vínculo (checados ao sair do campo): imóvel já instalado
    // e outro agendamento em aberto para o mesmo imóvel
    const [vinculoConcluido, setVinculoConcluido] = useState<ImovelResumo | null>(null);
    const [vinculoAgendamento, setVinculoAgendamento] = useState<AgendamentoResumo | null>(null);

    // Estado para Edição de Agendamento/Contato
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [editData, setEditData] = useState('');
    const [editHorario, setEditHorario] = useState('09:00');
    const [editNome, setEditNome] = useState('');
    const [editTelefone, setEditTelefone] = useState('');
    const [editObservacao, setEditObservacao] = useState('');
    const [editStatus, setEditStatus] = useState('AGENDADO');
    const [savingEdit, setSavingEdit] = useState(false);

    // Trava de horário: só agendamentos oficiais ativos ocupam horário
    const editOcupaHorario = !!editingItem
        && (editingItem.protocolo?.startsWith('PREF-') || !!editingItem.inscimobVinculo)
        && !['CONCLUIDO', 'CANCELADO'].includes(editStatus);
    const ocupadosNoDia = useHorariosOcupados(editData, editingItem?.protocolo, editOcupaHorario);
    // Registros antigos já duplicados podem ser editados enquanto o horário não mudar
    const horarioOriginal = editingItem?.dataHora && !['CONCLUIDO', 'CANCELADO'].includes(editingItem.status)
        ? `${editingItem.dataStr} ${editingItem.horarioStr}`
        : '';
    const conflitoEdit = `${editData} ${editHorario}` === horarioOriginal
        ? undefined
        : ocupadosNoDia.find(o => o.horario === editHorario);

    // Novo agendamento (busca do imóvel + data/horário)
    const [criando, setCriando] = useState(false);
    const [buscaImovel, setBuscaImovel] = useState('');
    const [resultadosImovel, setResultadosImovel] = useState<any[]>([]);
    const [buscandoImovel, setBuscandoImovel] = useState(false);
    const [imovelNovo, setImovelNovo] = useState<any | null>(null);
    // Agendamento em aberto do imóvel escolhido: salvar remarca esse mesmo agendamento
    const [agendamentoAbertoNovo, setAgendamentoAbertoNovo] = useState<AgendamentoResumo | null>(null);
    const [novoData, setNovoData] = useState('');
    const [novoHorario, setNovoHorario] = useState('09:00');
    const [novoNome, setNovoNome] = useState('');
    const [novoTelefone, setNovoTelefone] = useState('');
    const [novoObservacao, setNovoObservacao] = useState('');
    const [salvandoNovo, setSalvandoNovo] = useState(false);
    const editDialogRef = useDialog(!!editingItem, () => { if (!savingEdit) setEditingItem(null); });
    const novoDialogRef = useDialog(criando, () => { if (!salvandoNovo) setCriando(false); });
    const ocupadosNovo = useHorariosOcupados(novoData, undefined, criando && !!imovelNovo);
    const conflitoNovo = ocupadosNovo.find(o => o.horario === novoHorario && o.inscimob !== imovelNovo?.inscimob);

    useEffect(() => {
        if (periodo === 'dia' && !dataFiltro) return;
        fetchData();
    }, [activeTab, periodo, dataFiltro, statusFiltro]);

    async function fetchData(querySearch = search) {
        setLoading(true);
        try {
            const params = new URLSearchParams({ tipo: activeTab });
            if (querySearch.trim()) {
                params.set('q', querySearch.trim());
            }
            if (activeTab !== 'contatos') {
                params.set('periodo', periodo);
                if (periodo === 'dia' && dataFiltro) params.set('data', dataFiltro);
                if (statusFiltro && activeTab === 'agendamentos') params.set('status', statusFiltro);
            }
            const res = await fetch(`/api/agendamentos/listar?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao buscar agendamentos');
            setItems(data.items || []);
            if (data.totalAgendamentos !== undefined) setTotalAgendamentos(data.totalAgendamentos);
            if (data.totalConcluidos !== undefined) setTotalConcluidos(data.totalConcluidos);
            if (data.totalContatos !== undefined) setTotalContatos(data.totalContatos);
            if (data.totalAtrasados !== undefined) setTotalAtrasados(data.totalAtrasados);
        } catch (e: any) {
            toast.error(e.message || 'Erro ao buscar agendamentos.');
        } finally {
            setLoading(false);
        }
    }

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchData(search);
    };

    const handleOpenEdit = (item: any) => {
        setEditingItem(item);
        setEditNome(item.nome && item.nome !== NOME_PADRAO_AGENDAMENTO ? item.nome : '');
        setEditTelefone(item.telefone || '');
        setEditStatus(item.status || 'AGENDADO');
        setEditObservacao(item.observacao || item.imovel?.obsPendente || '');

        // Data/hora sempre no fuso de Brasília
        if (item.dataHora) {
            const { data, horario } = splitBrazilDate(new Date(item.dataHora));
            setEditData(item.dataStr || data);
            setEditHorario(item.horarioStr || horario);
        } else {
            const { data } = splitBrazilDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
            setEditData(data);
            setEditHorario('09:00');
        }
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;
        const erroContato = validarContato(editNome, editTelefone);
        if (erroContato) {
            toast.error(erroContato);
            return;
        }
        if (editOcupaHorario && conflitoEdit) {
            toast.error(`O horário ${editHorario} já está ocupado pelo agendamento ${conflitoEdit.protocolo}.`);
            return;
        }

        setSavingEdit(true);
        try {
            const resposta = await postAgendamento('/api/admin/agendamentos/editar', {
                protocolo: editingItem.protocolo,
                data: editData,
                horario: editHorario,
                nome: editNome,
                telefone: editTelefone,
                observacao: editObservacao,
                status: editStatus
            });
            if (!resposta) return;

            const { res, data } = resposta;
            if (res.ok && data.success) {
                toast.success("Agendamento atualizado.");
                setEditingItem(null);
                fetchData();
            } else {
                toast.error(data.error || "Erro ao salvar alterações");
            }
        } catch (e: any) {
            toast.error("Erro ao conectar ao servidor. " + (e.message || ""));
        } finally {
            setSavingEdit(false);
        }
    };

    const limparAvisosVinculo = () => {
        setVinculoConcluido(null);
        setVinculoAgendamento(null);
    };

    /** Ao sair do campo, avisa se o imóvel já foi instalado ou já tem outro agendamento em aberto. */
    const verificarInscricaoVinculo = async (inscimob: string, protocolo: string) => {
        const insc = inscimob.trim();
        if (!insc) return limparAvisosVinculo();
        try {
            const [resBusca, agendamento] = await Promise.all([
                fetch(`/api/prefeitura/buscar?q=${encodeURIComponent(insc)}`).then(r => r.json()),
                buscarAgendamentoAberto(insc)
            ]);
            const imoveis: (ImovelResumo & { status: string })[] = resBusca.imoveis || [];
            const imovel = imoveis.find(im => im.inscimob.toLowerCase() === insc.toLowerCase());
            setVinculoConcluido(imovel?.status === 'CONCLUIDO' ? imovel : null);
            setVinculoAgendamento(agendamento && agendamento.protocolo !== protocolo ? agendamento : null);
        } catch {
            // Sem a checagem prévia, o servidor ainda pede as confirmações ao vincular
            limparAvisosVinculo();
        }
    };

    const handleVincular = async (protocolo: string) => {
        const inscimob = inscimobInput.trim();
        if (!inscimob) return toast.error("Informe a inscrição imobiliária (inscimob).");

        const concluido = vinculoConcluido?.inscimob.toLowerCase() === inscimob.toLowerCase() ? vinculoConcluido : null;
        const outroAberto = vinculoAgendamento?.inscimobVinculo?.toLowerCase() === inscimob.toLowerCase() ? vinculoAgendamento : null;
        if (concluido && !confirmarRemarcacao(concluido)) return;
        if (outroAberto && !confirmarAgendamentoExistente(outroAberto)) return;

        try {
            const resposta = await postAgendamento('/api/admin/agendamentos/vincular', {
                protocolo,
                inscimob,
                ...(concluido ? { confirmarConcluido: true } : {}),
                ...(outroAberto ? { confirmarAgendamentoExistente: true } : {})
            });
            if (!resposta) return;

            if (resposta.res.ok) {
                toast.success("Vínculo realizado. O agendamento foi para a fila de instalação.");
                setVinculando(null);
                setInscimobInput('');
                limparAvisosVinculo();
                fetchData();
            } else {
                toast.error(resposta.data.error || "Erro ao vincular");
            }
        } catch (e) {
            toast.error("Erro na conexão");
        }
    };

    // Prefeitura: cancelar mantém o registro e o histórico (excluir de vez é só do admin)
    const handleCancelar = async (protocolo: string) => {
        if (!confirm(`Cancelar o agendamento ${protocolo}?\n\nO imóvel volta para "Não iniciado" e o cancelamento fica registrado no histórico.`)) return;

        try {
            const res = await fetch('/api/admin/agendamentos/editar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ protocolo, status: 'CANCELADO' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error);
            toast.success(`Agendamento ${protocolo} cancelado.`);
            fetchData();
        } catch (e: any) {
            toast.error(e.message || 'Não foi possível cancelar. Verifique a conexão e tente de novo.');
        }
    };

    const handleExcluir = async (protocolo: string) => {
        if (!confirm(`Excluir o registro ${protocolo}? Esta ação não pode ser desfeita.`)) return;

        try {
            const res = await fetch(`/api/admin/agendamentos/excluir?protocolo=${encodeURIComponent(protocolo)}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                toast.success("Registro excluído.");
                fetchData();
            } else {
                const data = await res.json();
                toast.error(data.error || "Erro ao excluir");
            }
        } catch (e) {
            toast.error("Não foi possível excluir. Verifique a conexão e tente de novo.");
        }
    };

    const abrirNovo = () => {
        setCriando(true);
        setBuscaImovel('');
        setResultadosImovel([]);
        setImovelNovo(null);
        setNovoData(splitBrazilDate(new Date(Date.now() + 24 * 60 * 60 * 1000)).data);
        setNovoHorario('09:00');
        setNovoNome('');
        setNovoTelefone('');
        setNovoObservacao('');
    };

    const handleBuscarImovel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!buscaImovel.trim()) return;
        setBuscandoImovel(true);
        try {
            const res = await fetch(`/api/prefeitura/buscar?q=${encodeURIComponent(buscaImovel.trim())}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setResultadosImovel(data.imoveis || []);
            if ((data.imoveis || []).length === 0) toast.error('Nenhum imóvel encontrado.');
        } catch (e: any) {
            toast.error(e.message || 'Erro ao buscar imóveis.');
        } finally {
            setBuscandoImovel(false);
        }
    };

    const handleCriar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!imovelNovo) return toast.error('Selecione o imóvel.');
        const erroContato = validarContato(novoNome, novoTelefone);
        if (erroContato) return toast.error(erroContato);
        if (conflitoNovo) return toast.error(`O horário ${novoHorario} já está ocupado pelo agendamento ${conflitoNovo.protocolo}.`);
        const concluido = imovelNovo.status === 'CONCLUIDO';
        if (concluido && !confirmarRemarcacao(imovelNovo)) return;

        setSalvandoNovo(true);
        try {
            const resposta = await postAgendamento('/api/prefeitura/agendamentos/criar', {
                inscimob: imovelNovo.inscimob,
                data: novoData,
                horario: novoHorario,
                nome: novoNome,
                telefone: novoTelefone,
                observacao: novoObservacao,
                ...(concluido ? { confirmarConcluido: true } : {})
            });
            if (!resposta) return;
            const { res, data } = resposta;
            if (!res.ok) throw new Error(data.error);
            toast.success(data.isEdit ? `Agendamento ${data.protocolo} atualizado.` : `Agendamento ${data.protocolo} criado.`);
            setCriando(false);
            fetchData();
        } catch (e: any) {
            toast.error(e.message || 'Erro ao salvar o agendamento.');
        } finally {
            setSalvandoNovo(false);
        }
    };

    const trocarAba = (tab: 'agendamentos' | 'concluidos' | 'contatos') => {
        setActiveTab(tab);
        setSearch('');
        setPeriodo('todos');
        setDataFiltro('');
        setStatusFiltro('');
    };

    const periodos: { key: Periodo; label: string }[] = [
        { key: 'todos', label: 'Todos' },
        { key: 'hoje', label: 'Hoje' },
        { key: 'amanha', label: 'Amanhã' },
        { key: 'semana', label: 'Próximos 7 dias' },
    ];

    const emptyMessage = activeTab === 'concluidos'
        ? (periodo === 'todos' ? 'Nenhum agendamento concluído ainda.' : 'Nenhum agendamento concluído neste período.')
        : periodo === 'atrasados'
            ? 'Nenhum agendamento atrasado.'
            : (periodo === 'todos' && !statusFiltro ? 'Nenhum agendamento em aberto.' : 'Nenhum agendamento encontrado com estes filtros.');

    return (
        <div className={styles.container}>
            <header className={styles.headerRow}>
                <div>
                    <h1>{prefeitura ? 'Agendamentos com moradores' : 'Gestão de agendamentos'}</h1>
                    <p>
                        {activeTab === 'agendamentos'
                            ? 'Visitas marcadas para instalar o número, em ordem de data.'
                            : activeTab === 'concluidos'
                                ? 'Visitas em que o número já foi instalado, para conferência.'
                                : 'Pedidos enviados pelos moradores no site. Vincule ao imóvel para agendar a visita.'}
                    </p>
                </div>

                {prefeitura && (
                    <button type="button" className={styles.modalSaveBtn} onClick={abrirNovo}>
                        <Plus size={18} aria-hidden /> Novo agendamento
                    </button>
                )}

                <div className={styles.tabGroup} role="tablist" aria-label="Tipo de registro">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'agendamentos'}
                        className={activeTab === 'agendamentos' ? styles.tabBtnActive : styles.tabBtn}
                        onClick={() => trocarAba('agendamentos')}
                    >
                        <CalendarDays size={16} aria-hidden />
                        <span>Agendamentos</span>
                        {totalAgendamentos > 0 && <span className={styles.badgeCount}>{totalAgendamentos}</span>}
                    </button>

                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'concluidos'}
                        className={activeTab === 'concluidos' ? styles.tabBtnActive : styles.tabBtn}
                        onClick={() => trocarAba('concluidos')}
                    >
                        <CheckCircle2 size={16} aria-hidden />
                        <span>Concluídos</span>
                        {totalConcluidos > 0 && <span className={styles.badgeCount}>{totalConcluidos}</span>}
                    </button>

                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'contatos'}
                        className={activeTab === 'contatos' ? styles.tabBtnActive : styles.tabBtn}
                        onClick={() => trocarAba('contatos')}
                    >
                        <Users size={16} aria-hidden />
                        <span>Pedidos do site</span>
                        {totalContatos > 0 && <span className={styles.badgeCount}>{totalContatos}</span>}
                    </button>
                </div>
            </header>

            <div className={styles.controlsBar}>
                <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
                    <Search size={16} aria-hidden />
                    <input
                        type="search"
                        aria-label="Buscar agendamentos"
                        placeholder={activeTab !== 'contatos' ? 'Buscar por protocolo, morador ou inscrição (Enter)' : 'Buscar por nome, telefone ou endereço (Enter)'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={styles.searchInput}
                    />
                </form>

                {activeTab !== 'contatos' && (
                    <div className={styles.filterRow} role="group" aria-label="Filtrar agendamentos">
                        {activeTab === 'agendamentos' && (
                            <button
                                type="button"
                                className={periodo === 'atrasados' ? styles.filterChipDangerActive : styles.filterChipDanger}
                                onClick={() => setPeriodo(periodo === 'atrasados' ? 'todos' : 'atrasados')}
                                aria-pressed={periodo === 'atrasados'}
                            >
                                Atrasados
                                <span className={styles.chipCount}>{totalAtrasados}</span>
                            </button>
                        )}
                        {periodos.map(p => (
                            <button
                                key={p.key}
                                type="button"
                                className={periodo === p.key ? styles.filterChipActive : styles.filterChip}
                                onClick={() => setPeriodo(p.key)}
                                aria-pressed={periodo === p.key}
                            >
                                {p.label}
                            </button>
                        ))}
                        <input
                            type="date"
                            aria-label="Filtrar por dia"
                            title="Filtrar por dia"
                            className={styles.filterDate}
                            value={periodo === 'dia' ? dataFiltro : ''}
                            onChange={e => {
                                setDataFiltro(e.target.value);
                                setPeriodo(e.target.value ? 'dia' : 'todos');
                            }}
                        />
                        {activeTab === 'agendamentos' && (
                            <>
                                <span className={styles.filterDivider} aria-hidden="true" />
                                <select
                                    aria-label="Filtrar por status"
                                    className={styles.filterSelect}
                                    value={statusFiltro}
                                    onChange={e => setStatusFiltro(e.target.value)}
                                >
                                    <option value="">Todos os status</option>
                                    <option value="AGENDADO">Agendado</option>
                                    <option value="REAGENDAR">Reagendar</option>
                                    <option value="EM_ROTA">Em rota</option>
                                    <option value="PENDENTE">Pendente</option>
                                </select>
                            </>
                        )}
                    </div>
                )}
            </div>

            <section className={styles.listCard}>
                {activeTab !== 'contatos' ? (
                    <table className={`${styles.table} ${styles.tableCards}`}>
                        <thead>
                            <tr>
                                <th>Protocolo</th>
                                <th>Imóvel</th>
                                <th>Data e horário</th>
                                <th>Morador</th>
                                <th>Observações</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                                        Carregando agendamentos...
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
                                        <div className={styles.emptyState}>
                                            <CalendarDays size={40} aria-hidden />
                                            <p style={{ margin: 0, fontWeight: 600 }}>
                                                {emptyMessage}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : items.map(ag => (
                                <tr key={ag.protocolo} className={ag.atrasado ? styles.rowAtrasado : undefined}>
                                    <td data-label="Protocolo">
                                        <span className={styles.protoBadge}>{ag.protocolo}</span>
                                    </td>
                                    <td data-label="Imóvel">
                                        <div className={styles.imovelCell}>
                                            <span className={styles.imovelNumber}>
                                                Nº {ag.imovel?.numeroAInstalar || 'S/N'}
                                            </span>
                                            {ag.inscimobVinculo ? (
                                                <button
                                                    type="button"
                                                    className={`${styles.inscBadge} ${styles.inscBadgeBtn}`}
                                                    onClick={() => setImovelInfo({ inscimob: ag.inscimobVinculo, imovel: ag.imovel })}
                                                    title="Ver informações do imóvel"
                                                >
                                                    Insc: {ag.inscimobVinculo}
                                                </button>
                                            ) : (
                                                <span className={styles.inscBadge}>Insc: —</span>
                                            )}
                                            <span className={styles.imovelSub}>
                                                {ag.imovel?.bairro?.nome || 'Bairro'}
                                                {ag.imovel?.endereco ? ` • ${ag.imovel.endereco}` : ''}
                                            </span>
                                        </div>
                                    </td>
                                    <td data-label="Data e horário">
                                        <div className={styles.dateTimeCell}>
                                            <span className={styles.dateBold}>
                                                {ag.dataHora ? fmtData(ag.dataHora) : '—'}
                                            </span>
                                            <span className={styles.timeSub}>
                                                {ag.dataHora ? fmtHora(ag.dataHora) : ''}
                                            </span>
                                            {ag.atrasado && <span className={styles.atrasadoTag}>Atrasado</span>}
                                        </div>
                                    </td>
                                    <td data-label="Morador">
                                        <strong>{ag.nome || '—'}</strong><br />
                                        {whatsappLink(ag.telefone) ? (
                                            <a
                                                href={whatsappLink(ag.telefone)!}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.whatsLink}
                                                title="Abrir conversa no WhatsApp"
                                            >
                                                {ag.telefone}
                                            </a>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{ag.telefone || '—'}</span>
                                        )}
                                    </td>
                                    <td data-label="Observações" style={{ maxWidth: '200px' }}>
                                        <span style={{ fontSize: '0.82rem', color: '#475569', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {ag.observacao || ag.imovel?.obsPendente || '—'}
                                        </span>
                                    </td>
                                    <td data-label="Status">
                                        <span className={`${styles.statusPill} ${styles['status' + (ag.status || 'AGENDADO')] || styles.statusAGENDADO}`}>
                                            {statusLabel(ag.status)}
                                        </span>
                                        {ag.status === 'CONCLUIDO' && ag.imovel?.dataExecucao && (
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', lineHeight: 1.3 }}>
                                                em {fmtData(ag.imovel.dataExecucao)} {fmtHora(ag.imovel.dataExecucao)}
                                                {ag.imovel.instaladorResp && <><br />por {ag.imovel.instaladorResp}</>}
                                            </div>
                                        )}
                                    </td>
                                    <td data-label="Ações">
                                        <div className={styles.actionRow}>
                                            <button
                                                type="button"
                                                className={styles.editBtn}
                                                onClick={() => handleOpenEdit(ag)}
                                                title="Editar agendamento"
                                            >
                                                <Pencil size={14} aria-hidden />
                                                <span>Editar</span>
                                            </button>
                                            {prefeitura ? (
                                                !['CONCLUIDO', 'CANCELADO'].includes(ag.status) && (
                                                    <button
                                                        type="button"
                                                        className={styles.cancelBtn}
                                                        onClick={() => handleCancelar(ag.protocolo)}
                                                        title="Cancelar agendamento"
                                                    >
                                                        <Ban size={14} aria-hidden />
                                                        <span>Cancelar</span>
                                                    </button>
                                                )
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={styles.deleteBtn}
                                                    onClick={() => handleExcluir(ag.protocolo)}
                                                    title="Excluir agendamento"
                                                >
                                                    <Trash2 size={14} aria-hidden />
                                                    <span>Excluir</span>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <table className={`${styles.table} ${styles.tableCards}`}>
                        <thead>
                            <tr>
                                <th>Protocolo</th>
                                <th>Morador</th>
                                <th>Endereço informado</th>
                                <th>Data do pedido</th>
                                <th>Imóvel vinculado</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                                        Carregando lista de contatos...
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <div className={styles.emptyState}>
                                            <Users size={40} aria-hidden />
                                            <p style={{ margin: 0, fontWeight: 600 }}>Nenhum contato encontrado.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : items.map(ct => (
                                <tr key={ct.protocolo}>
                                    <td data-label="Protocolo">
                                        <span className={styles.contactBadge}>{ct.protocolo}</span>
                                    </td>
                                    <td data-label="Morador">
                                        <strong>{ct.nome}</strong><br />
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{ct.telefone || '—'}</span>
                                    </td>
                                    <td data-label="Endereço informado" style={{ maxWidth: '280px' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#334155' }}>{ct.enderecoCompleto}</span>
                                    </td>
                                    <td data-label="Data do pedido">
                                        <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                                            {fmtData(ct.createdAt)} às {fmtHora(ct.createdAt)}
                                        </span>
                                    </td>
                                    <td data-label="Imóvel vinculado">
                                        {ct.inscimobVinculo ? (
                                            <button
                                                type="button"
                                                className={`${styles.inscBadge} ${styles.inscBadgeBtn}`}
                                                onClick={() => setImovelInfo({ inscimob: ct.inscimobVinculo })}
                                                title="Ver informações do imóvel"
                                            >
                                                {ct.inscimobVinculo}
                                            </button>
                                        ) : (
                                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Não vinculado</span>
                                        )}
                                    </td>
                                    <td data-label="Ações">
                                        <div className={styles.actionRow}>
                                            {vinculando === ct.protocolo ? (
                                                <div className={styles.vincularForm}>
                                                    <input
                                                        type="text"
                                                        aria-label="Inscrição imobiliária para vincular"
                                                        onKeyDown={e => { if (e.key === 'Enter') handleVincular(ct.protocolo); if (e.key === 'Escape') setVinculando(null); }}
                                                        placeholder="Inscrição imobiliária"
                                                        value={inscimobInput}
                                                        onChange={e => { setInscimobInput(e.target.value); limparAvisosVinculo(); }}
                                                        onBlur={e => verificarInscricaoVinculo(e.target.value, ct.protocolo)}
                                                        className={styles.miniInput}
                                                        aria-describedby={vinculoConcluido || vinculoAgendamento ? `vinculo-aviso-${ct.protocolo}` : undefined}
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleVincular(ct.protocolo)} className={styles.vincBtn}>Vincular</button>
                                                    <button onClick={() => setVinculando(null)} className={styles.cancelMiniBtn} aria-label="Cancelar vínculo"><X size={14} aria-hidden /></button>
                                                    {(vinculoConcluido || vinculoAgendamento) && (
                                                        <p id={`vinculo-aviso-${ct.protocolo}`} className={styles.vincularAviso} role="alert">
                                                            {vinculoConcluido && mensagemImovelConcluido(vinculoConcluido)}
                                                            {vinculoConcluido && vinculoAgendamento && ' '}
                                                            {vinculoAgendamento && mensagemAgendamentoExistente(vinculoAgendamento)}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={styles.vincularTriggerBtn}
                                                        onClick={() => {
                                                            setVinculando(ct.protocolo);
                                                            setInscimobInput(ct.inscimobVinculo || '');
                                                            limparAvisosVinculo();
                                                        }}
                                                        title="Vincular a um imóvel"
                                                    >
                                                        <Link2 size={14} aria-hidden />
                                                        <span>{ct.inscimobVinculo ? 'Alterar' : 'Vincular'}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.editBtn}
                                                        onClick={() => handleOpenEdit(ct)}
                                                        title="Editar dados"
                                                    >
                                                        <Pencil size={14} aria-hidden />
                                                        <span>Editar</span>
                                                    </button>
                                                    {!prefeitura && (
                                                        <button
                                                            type="button"
                                                            className={styles.deleteBtn}
                                                            onClick={() => handleExcluir(ct.protocolo)}
                                                            title="Excluir registro"
                                                        >
                                                            <Trash2 size={14} aria-hidden />
                                                            <span>Excluir</span>
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* Modal de Edição de Agendamento / Contato */}
            {editingItem && (
                <div className={styles.modalOverlay} onClick={() => !savingEdit && setEditingItem(null)}>
                    <div ref={editDialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="edit-ag-title" onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 id="edit-ag-title">
                                    <Pencil size={20} aria-hidden />
                                    Editar agendamento {editingItem.protocolo}
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                    {editingItem.inscimobVinculo
                                        ? `Imóvel vinculado: Insc. ${editingItem.inscimobVinculo}`
                                        : 'Pedido enviado pelo site'}
                                </p>
                            </div>
                            <button
                                type="button"
                                className={styles.closeBtn}
                                aria-label="Fechar"
                                onClick={() => setEditingItem(null)}
                            >
                                <X size={20} aria-hidden />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className={styles.formGrid}>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="edit-data">
                                        <CalendarDays size={14} aria-hidden />
                                        Data *
                                    </label>
                                    <input
                                        id="edit-data"
                                        type="date"
                                        required
                                        value={editData}
                                        onChange={e => setEditData(e.target.value)}
                                        className={styles.formInput}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label htmlFor="edit-horario">
                                        <Clock size={14} aria-hidden />
                                        Horário *
                                    </label>
                                    <input
                                        id="edit-horario"
                                        type="time"
                                        required
                                        value={editHorario}
                                        onChange={e => setEditHorario(e.target.value)}
                                        className={styles.formInput}
                                    />
                                </div>
                            </div>

                            {editOcupaHorario && (conflitoEdit ? (
                                <p className={styles.slotHintError} role="alert">
                                    Horário {editHorario} já ocupado pelo agendamento {conflitoEdit.protocolo}
                                    {conflitoEdit.inscimob ? ` (Insc. ${conflitoEdit.inscimob})` : ''}. Escolha outro horário.
                                </p>
                            ) : ocupadosNoDia.length > 0 ? (
                                <p className={styles.slotHint}>
                                    Horários já ocupados neste dia:{' '}
                                    {ocupadosNoDia.map(o => <span key={o.protocolo} className={styles.slotBusy}>{o.horario}</span>)}
                                </p>
                            ) : null)}

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="edit-nome">
                                        <User size={14} aria-hidden />
                                        Nome do morador *
                                    </label>
                                    <input
                                        id="edit-nome"
                                        type="text"
                                        required
                                        value={editNome}
                                        onChange={e => setEditNome(e.target.value)}
                                        placeholder="Ex: João da Silva"
                                        className={styles.formInput}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label htmlFor="edit-status">
                                        <Flag size={14} aria-hidden />
                                        Status
                                    </label>
                                    <select
                                        id="edit-status"
                                        value={editStatus}
                                        onChange={e => setEditStatus(e.target.value)}
                                        className={styles.formSelect}
                                    >
                                        <option value="AGENDADO">Agendado</option>
                                        {/* A instalação é concluída pela equipe em campo, não pela prefeitura */}
                                        {(!prefeitura || editingItem.status === 'CONCLUIDO') && <option value="CONCLUIDO">Concluído</option>}
                                        <option value="REAGENDAR">Reagendar</option>
                                        <option value="CANCELADO">Cancelado</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="edit-telefone">
                                    <Phone size={14} aria-hidden />
                                    Telefone / WhatsApp *
                                </label>
                                <input
                                    id="edit-telefone"
                                    type="tel"
                                    required
                                    inputMode="tel"
                                    value={editTelefone}
                                    onChange={e => setEditTelefone(e.target.value)}
                                    placeholder="(41) 99999-9999"
                                    className={styles.formInput}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="edit-obs">
                                    <FileText size={14} aria-hidden />
                                    Observações para o instalador
                                </label>
                                <textarea
                                    id="edit-obs"
                                    value={editObservacao}
                                    onChange={e => setEditObservacao(e.target.value)}
                                    placeholder="Ex: Instruções de acesso, detalhes sobre o morador..."
                                    className={styles.formTextarea}
                                />
                            </div>

                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.modalCancelBtn}
                                    onClick={() => setEditingItem(null)}
                                    disabled={savingEdit}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className={styles.modalSaveBtn}
                                    disabled={savingEdit || (editOcupaHorario && !!conflitoEdit)}
                                >
                                    {savingEdit ? 'Salvando...' : 'Salvar alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {criando && (
                <div className={styles.modalOverlay} onClick={() => !salvandoNovo && setCriando(false)}>
                    <div ref={novoDialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="novo-ag-title" onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 id="novo-ag-title">Novo agendamento</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                    {imovelNovo
                                        ? `Imóvel Nº ${imovelNovo.numeroAInstalar} • Insc. ${imovelNovo.inscimob}${imovelNovo.bairro?.nome ? ` • ${imovelNovo.bairro.nome}` : ''}`
                                        : 'Busque o imóvel pela inscrição, número ou endereço'}
                                </p>
                            </div>
                            <button type="button" className={styles.closeBtn} aria-label="Fechar" onClick={() => setCriando(false)}><X size={20} aria-hidden /></button>
                        </div>

                        {!imovelNovo ? (
                            <div className={styles.formGrid}>
                                <form onSubmit={handleBuscarImovel} className={styles.formRow}>
                                    <div className={styles.formGroup} style={{ flex: 1 }}>
                                        <label htmlFor="busca-imovel">Imóvel</label>
                                        <input
                                            id="busca-imovel"
                                            type="search"
                                            autoFocus
                                            value={buscaImovel}
                                            onChange={e => setBuscaImovel(e.target.value)}
                                            placeholder="Inscimob, nº predial ou rua (Enter)"
                                            className={styles.formInput}
                                        />
                                    </div>
                                </form>
                                {buscandoImovel ? (
                                    <p className={styles.slotHint}>Buscando...</p>
                                ) : resultadosImovel.length > 0 && (
                                    <ul className={styles.resultList}>
                                        {resultadosImovel.map(im => (
                                            <li key={im.inscimob}>
                                                <button type="button" onClick={() => {
                                                    setImovelNovo(im);
                                                    setNovoObservacao(im.obsPendente || '');
                                                    setAgendamentoAbertoNovo(null);
                                                    buscarAgendamentoAberto(im.inscimob)
                                                        .then(setAgendamentoAbertoNovo)
                                                        .catch(() => setAgendamentoAbertoNovo(null));
                                                }}>
                                                    <strong>Nº {im.numeroAInstalar}</strong>
                                                    <span>Insc. {im.inscimob} • {im.bairro?.nome || '—'}{im.endereco ? ` • ${im.endereco}` : ''}</span>
                                                    <span className={`${styles.statusPill} ${styles['status' + im.status] || ''}`}>{statusLabel(im.status)}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handleCriar} className={styles.formGrid}>
                                {imovelNovo.status === 'CONCLUIDO' && (
                                    <p className={styles.slotHintError} role="alert">{mensagemImovelConcluido(imovelNovo)} Ao salvar, confirme se é preciso remarcar uma nova visita.</p>
                                )}
                                {agendamentoAbertoNovo && (
                                    <p className={styles.slotHintError} role="alert">
                                        {mensagemAgendamentoExistente(agendamentoAbertoNovo)} Ao salvar, esse agendamento será remarcado com os dados abaixo.
                                    </p>
                                )}
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="novo-data">Data *</label>
                                        <input id="novo-data" type="date" required value={novoData} onChange={e => setNovoData(e.target.value)} className={styles.formInput} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="novo-horario">Horário *</label>
                                        <input id="novo-horario" type="time" required value={novoHorario} onChange={e => setNovoHorario(e.target.value)} className={styles.formInput} />
                                    </div>
                                </div>
                                {conflitoNovo ? (
                                    <p className={styles.slotHintError} role="alert">
                                        Horário {novoHorario} já ocupado pelo agendamento {conflitoNovo.protocolo}. Escolha outro horário.
                                    </p>
                                ) : ocupadosNovo.length > 0 ? (
                                    <p className={styles.slotHint}>
                                        Horários já ocupados neste dia:{' '}
                                        {ocupadosNovo.map(o => <span key={o.protocolo} className={styles.slotBusy}>{o.horario}</span>)}
                                    </p>
                                ) : null}
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="novo-nome">Nome do morador *</label>
                                        <input id="novo-nome" type="text" required value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: João da Silva" className={styles.formInput} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="novo-telefone">Telefone / WhatsApp *</label>
                                        <input id="novo-telefone" type="tel" required inputMode="tel" value={novoTelefone} onChange={e => setNovoTelefone(e.target.value)} placeholder="(41) 99999-9999" className={styles.formInput} />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label htmlFor="novo-obs">Observações para o instalador</label>
                                    <textarea id="novo-obs" value={novoObservacao} onChange={e => setNovoObservacao(e.target.value)} className={styles.formTextarea} />
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={styles.modalCancelBtn} onClick={() => setImovelNovo(null)} disabled={salvandoNovo}>
                                        Trocar imóvel
                                    </button>
                                    <button type="submit" className={styles.modalSaveBtn} disabled={salvandoNovo || !!conflitoNovo}>
                                        {salvandoNovo ? 'Salvando...' : 'Agendar'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
            {imovelInfo && (
                <ImovelInfoModal inscimob={imovelInfo.inscimob} initial={imovelInfo.imovel} onClose={() => setImovelInfo(null)} />
            )}
        </div>
    );
}
