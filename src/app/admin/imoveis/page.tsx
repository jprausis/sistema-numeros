'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import styles from './page.module.css';
import * as XLSX from 'xlsx';

const InstallerMap = dynamic(() => import('@/components/InstallerMap'), {
    ssr: false,
    loading: () => <div className={styles.loader}>Preparando Mapa...</div>
});

export default function AdminImoveisPage() {
    const [imoveis, setImoveis] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'table' | 'map'>('table');
    const [selectedImovel, setSelectedImovel] = useState<any | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);

    const [bairros, setBairros] = useState<any[]>([]);
    const [bairroFilter, setBairroFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    async function fetchImoveis() {
        try {
            const [resImoveis, resBairros] = await Promise.all([
                fetch('/api/instalador/imoveis'),
                fetch('/api/admin/bairros')
            ]);

            const dataImoveis = await resImoveis.json();
            const dataBairros = await resBairros.json();

            setImoveis(dataImoveis.imoveis || []);
            setBairros(dataBairros.bairros || []);
        } catch (e) {
            console.error("Erro ao buscar dados");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchImoveis();
    }, []);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedImovel) return;

        try {
            const res = await fetch(`/api/admin/imoveis/${selectedImovel.inscimob}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: selectedImovel.status,
                    fotos: selectedImovel.fotos,
                    obsPendente: selectedImovel.obsPendente
                })
            });

            if (res.ok) {
                alert("Imóvel atualizado com sucesso!");
                setEditMode(false);
                fetchImoveis();
            }
        } catch (e) {
            alert("Erro ao atualizar.");
        }
    };

    const handleExport = () => {
        const dataToExport = filtered.map(i => ({
            'Inscimob': i.inscimob,
            'Bairro': i.bairro?.nome,
            'Número': i.numeroAInstalar,
            'Status': i.status,
            'Foto URL': i.fotos || 'Nenhuma',
            'Observações': i.obsPendente || '',
            'Data Execução': i.dataExecucao ? new Date(i.dataExecucao).toLocaleDateString() : 'N/A'
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Imoveis");
        XLSX.writeFile(wb, `Relatorio_Instalacoes_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filtered = imoveis.filter(i => {
        const matchesSearch = i.inscimob.includes(search) || i.numeroAInstalar?.includes(search);
        const matchesBairro = bairroFilter === '' || i.bairroId === bairroFilter;
        const matchesStatus = statusFilter === '' || i.status === statusFilter;
        return matchesSearch && matchesBairro && matchesStatus;
    });

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Gestão de Imóveis</h1>
                    <p>Controle total sobre as placas instaladas e pendências.</p>
                </div>
                <div className={styles.headerActions}>
                    <button onClick={handleExport} className={styles.exportBtn}>
                        📥 Exportar Excel
                    </button>

                    <select
                        className={styles.filterSelect}
                        value={bairroFilter}
                        onChange={e => setBairroFilter(e.target.value)}
                    >
                        <option value="">Todos os Bairros</option>
                        {bairros.map(b => (
                            <option key={b.id} value={b.id}>{b.nome}</option>
                        ))}
                    </select>

                    <select
                        className={styles.filterSelect}
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="">Todos os Status</option>
                        <option value="NAO_INICIADO">Não Iniciado</option>
                        <option value="PENDENTE">Pendente</option>
                        <option value="CONCLUIDO">Concluído</option>
                    </select>

                    <div className={styles.viewToggle}>
                        <button
                            className={view === 'table' ? styles.activeToggle : ''}
                            onClick={() => setView('table')}
                        >
                            Lista
                        </button>
                        <button
                            className={view === 'map' ? styles.activeToggle : ''}
                            onClick={() => setView('map')}
                        >
                            Mapa
                        </button>
                    </div>
                </div>
            </header>

            <div className={styles.searchWrapper}>
                <input
                    type="text"
                    placeholder="Buscar por inscimob ou Nº de casa..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className={styles.searchBar}
                />
            </div>

            {view === 'map' ? (
                <div className={styles.mapContainer}>
                    <InstallerMap
                        properties={filtered}
                        focusOn={mapFocus}
                        onEdit={(i) => {
                            setSelectedImovel(i);
                            setEditMode(true);
                        }}
                    />
                </div>
            ) : (
                <section className={styles.listCard}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Foto</th>
                                <th>Inscimob</th>
                                <th>Bairro</th>
                                <th>Número</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6}>Carregando...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6}>Nenhum imóvel encontrado.</td></tr>
                            ) : filtered.map(i => (
                                <tr key={i.inscimob}>
                                    <td>
                                        {i.fotos ? (
                                            <div className={styles.tableThumb} onClick={() => window.open(i.fotos, '_blank')}>
                                                <img src={i.fotos} alt="Instalação" />
                                            </div>
                                        ) : (
                                            <span className={styles.noPhoto}>Sem foto</span>
                                        )}
                                    </td>
                                    <td><strong>{i.inscimob}</strong></td>
                                    <td>{i.bairro?.nome}</td>
                                    <td>{i.numeroAInstalar}</td>
                                    <td>
                                        <span className={`${styles.badge} ${styles[i.status]}`}>
                                            {i.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.actions}>
                                            <button
                                                className={styles.locateBtn}
                                                title="Ver no Mapa"
                                                onClick={() => {
                                                    setMapFocus([i.x, i.y]);
                                                    setView('map');
                                                }}
                                            >
                                                📍
                                            </button>
                                            <button
                                                className={styles.editBtn}
                                                onClick={() => {
                                                    setSelectedImovel(i);
                                                    setEditMode(true);
                                                }}
                                            >
                                                Editar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {editMode && selectedImovel && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3>Editar Imóvel: {selectedImovel.numeroAInstalar}</h3>
                        <p>ID: {selectedImovel.inscimob}</p>

                        <form onSubmit={handleUpdate} className={styles.form}>
                            {selectedImovel.fotos && (
                                <div className={styles.modalPhotoArea}>
                                    <label>Foto da Instalação:</label>
                                    <img src={selectedImovel.fotos} alt="Foto" className={styles.modalImg} onClick={() => window.open(selectedImovel.fotos, '_blank')} />
                                </div>
                            )}

                            <div className={styles.formGroup}>
                                <label>Status</label>
                                <select
                                    value={selectedImovel.status}
                                    onChange={e => setSelectedImovel({ ...selectedImovel, status: e.target.value })}
                                >
                                    <option value="NAO_INICIADO">Não Iniciado</option>
                                    <option value="PENDENTE">Pendente</option>
                                    <option value="CONCLUIDO">Concluído</option>
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Observações</label>
                                <textarea
                                    value={selectedImovel.obsPendente || ''}
                                    placeholder="Ex: Portão trancado, número incorreto..."
                                    onChange={e => setSelectedImovel({ ...selectedImovel, obsPendente: e.target.value })}
                                />
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" onClick={() => setEditMode(false)} className={styles.cancelBtn}>Cancelar</button>
                                <button type="submit" className={styles.saveBtn}>Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
