'use client';

import { useRef, useState } from 'react';
import { FileSpreadsheet, FileUp, Layers, Loader2, MapPinned, Shapes, type LucideIcon } from 'lucide-react';
import ui from '../admin.module.css';
import styles from './page.module.css';
import { toast } from '@/utils/toast';

type Tipo = 'IMOVEIS' | 'MALHA' | 'COMPLEMENTOS' | 'COMPLEMENTOS_GEOJSON';

interface ImportConfig {
    tipo: Tipo;
    step: number;
    title: string;
    description: string;
    accept: string;
    help: string;
    icon: LucideIcon;
    needsBairro?: boolean;
    resultKind: 'EXCEL' | 'GEOJSON';
    successMessage: string;
}

const IMPORTS: ImportConfig[] = [
    {
        tipo: 'IMOVEIS', step: 1, title: 'Lote de imóveis (Excel)',
        description: 'Cria um novo bairro/lote a partir da planilha da prefeitura.',
        accept: '.xls,.xlsx', help: 'Colunas esperadas: inscimob, x, y, Número',
        icon: FileSpreadsheet, needsBairro: true, resultKind: 'EXCEL',
        successMessage: 'Imóveis importados com sucesso!'
    },
    {
        tipo: 'MALHA', step: 2, title: 'Malha dos lotes (GeoJSON)',
        description: 'Vincula o desenho de cada lote aos imóveis existentes pelo campo inscimob.',
        accept: '.geojson,.json,application/geo+json', help: 'Propriedade de identificação: inscimob, lote ou indicacaof',
        icon: Shapes, resultKind: 'GEOJSON',
        successMessage: 'Malha importada com sucesso!'
    },
    {
        tipo: 'COMPLEMENTOS', step: 3, title: 'Complementos (Excel)',
        description: 'Adiciona unidades internas (CS1, CS2...) aos imóveis existentes.',
        accept: '.xls,.xlsx', help: 'Colunas esperadas: unidade, indicacaof, número predial',
        icon: Layers, resultKind: 'EXCEL',
        successMessage: 'Complementos importados com sucesso!'
    },
    {
        tipo: 'COMPLEMENTOS_GEOJSON', step: 4, title: 'Localização dos complementos (GeoJSON)',
        description: 'Define a posição exata de cada unidade no mapa.',
        accept: '.geojson,.json', help: 'Propriedades esperadas: indicacaof, unidade (geometria Point)',
        icon: MapPinned, resultKind: 'GEOJSON',
        successMessage: 'Localizações dos complementos importadas!'
    },
];

export default function AdminImportPage() {
    return (
        <div className={ui.container} style={{ maxWidth: 860 }}>
            <header className={ui.header}>
                <div>
                    <h1>Importar Dados</h1>
                    <p>Carregue os arquivos da prefeitura na ordem abaixo. Imóveis existentes são atualizados pela inscrição.</p>
                </div>
            </header>
            {IMPORTS.map(cfg => <ImportSection key={cfg.tipo} config={cfg} />)}
        </div>
    );
}

function ImportSection({ config }: { config: ImportConfig }) {
    const [file, setFile] = useState<File | null>(null);
    const [bairro, setBairro] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const Icon = config.icon;

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return toast.error('Selecione um arquivo.');
        if (config.needsBairro && !bairro.trim()) return toast.error('Informe o nome do bairro.');

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tipo', config.tipo);
        if (config.needsBairro) formData.append('bairro', bairro.trim());

        try {
            const res = await fetch('/api/admin/importar', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro na importação.');
            setResult(data);
            toast.success(config.successMessage);
            setFile(null);
            setBairro('');
            if (inputRef.current) inputRef.current.value = '';
        } catch (error: any) {
            toast.error(error.message || 'Erro na conexão ou o arquivo é grande demais para processar a tempo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className={`${ui.cardPadded} ${styles.section}`}>
            <div className={styles.sectionHeader}>
                <span className={styles.stepIcon}><Icon size={20} aria-hidden /></span>
                <div>
                    <span className={styles.step}>Etapa {config.step}</span>
                    <h2 className={ui.cardTitle}>{config.title}</h2>
                    <p className={ui.cardSubtitle}>{config.description}</p>
                </div>
            </div>

            <form onSubmit={handleUpload} className={ui.form}>
                {config.needsBairro && (
                    <div className={ui.field}>
                        <label htmlFor={`bairro-${config.tipo}`}>Nome do bairro / região</label>
                        <input
                            id={`bairro-${config.tipo}`}
                            type="text"
                            placeholder="Ex: Centro Norte"
                            value={bairro}
                            onChange={e => setBairro(e.target.value)}
                            required
                        />
                    </div>
                )}

                <label className={`${styles.dropzone} ${file ? styles.dropzoneFilled : ''}`}>
                    <FileUp size={22} aria-hidden />
                    <span className={styles.dropzoneText}>
                        {file ? <><strong>{file.name}</strong> ({(file.size / 1024).toFixed(0)} KB)</> : <>Clique para selecionar o arquivo <strong>({config.accept.split(',').filter(a => a.startsWith('.')).join(', ')})</strong></>}
                    </span>
                    <span className={ui.hint}>{config.help}</span>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={config.accept}
                        className="sr-only"
                        onChange={e => setFile(e.target.files?.[0] || null)}
                    />
                </label>

                <div className={ui.formActions}>
                    <button type="submit" className={ui.btnPrimary} disabled={loading || !file}>
                        {loading ? <><Loader2 size={16} className="spin" /> Processando...</> : 'Importar'}
                    </button>
                </div>
            </form>

            {result && <ImportStats result={result} type={config.resultKind} />}
        </section>
    );
}

function ImportStats({ result, type }: { result: any, type: 'EXCEL' | 'GEOJSON' }) {
    const items = [
        { label: 'Total processado', value: result.total },
        { label: type === 'EXCEL' ? 'Importados' : 'Vinculados', value: type === 'EXCEL' ? result.imported : result.updated, tone: styles.statSuccess },
        { label: type === 'EXCEL' ? 'Com erro' : 'Não encontrados', value: type === 'EXCEL' ? result.skipped : result.notFound, tone: styles.statWarning },
        ...(result.missingKey > 0 ? [{ label: 'Sem identificador', value: result.missingKey, tone: styles.statWarning }] : []),
    ];
    return (
        <div className={styles.stats} role="status">
            {items.map(item => (
                <div key={item.label} className={`${styles.statItem} ${item.tone || ''}`}>
                    <span>{item.label}</span>
                    <strong>{(item.value ?? 0).toLocaleString('pt-BR')}</strong>
                </div>
            ))}
        </div>
    );
}
