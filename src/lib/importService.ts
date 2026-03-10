import * as XLSX from 'xlsx';
import prisma from './prisma';

export interface PropertyImportData {
    inscimob: string;
    x: number;
    y: number;
    numero: string;
}

export async function processExcelImport(buffer: Buffer, bairroNome: string) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];

    const validatedData: PropertyImportData[] = data.map((row: any) => ({
        inscimob: String(row.inscimob || row.INSCIMOB || ''),
        x: parseFloat(row.x || row.X || '0'),
        y: parseFloat(row.y || row.Y || '0'),
        numero: String(row.Número || row.NUMERO || row.numero || '')
    })).filter(item => item.inscimob && !isNaN(item.x) && !isNaN(item.y));

    if (validatedData.length === 0) {
        throw new Error("Nenhum dado válido encontrado na planilha.");
    }

    // Criar o Bairro/Lote
    const bairro = await prisma.bairro.create({
        data: {
            nome: bairroNome,
            totalImoveis: validatedData.length,
            status: "ATIVO"
        }
    });

    // Importar Imóveis (usando transaction para garantir consistência)
    let importedCount = 0;
    let skippedCount = 0;

    for (const item of validatedData) {
        try {
            await prisma.imovel.upsert({
                where: { inscimob: item.inscimob },
                update: {
                    x: item.x,
                    y: item.y,
                    numeroAInstalar: item.numero,
                    bairroId: bairro.id
                },
                create: {
                    inscimob: item.inscimob,
                    x: item.x,
                    y: item.y,
                    numeroAInstalar: item.numero,
                    bairroId: bairro.id,
                    status: "NAO_INICIADO"
                }
            });
            importedCount++;
        } catch (e) {
            console.error(`Erro ao importar inscimob ${item.inscimob}:`, e);
            skippedCount++;
        }
    }

    return {
        bairroId: bairro.id,
        total: validatedData.length,
        imported: importedCount,
        skipped: skippedCount
    };
}

export async function processGeoJSONImport(buffer: Buffer) {
    const content = buffer.toString('utf-8');
    const geojson = JSON.parse(content);

    if (geojson.type !== 'FeatureCollection') {
        throw new Error("O arquivo não é uma FeatureCollection GeoJSON válida.");
    }

    let updatedCount = 0;
    let notFoundCount = 0;
    let processed = 0;
    const total = geojson.features.length;

    console.log(`Iniciando processamento de ${total} feições GeoJSON...`);

    for (const feature of geojson.features) {
        processed++;
        if (processed % 100 === 0) {
            console.log(`Progresso GeoJSON: ${processed}/${total} processados...`);
        }

        const inscimob = feature.properties?.inscimob;
        if (!inscimob) continue;

        const imovel = await prisma.imovel.findUnique({
            where: { inscimob: String(inscimob) }
        });

        if (imovel) {
            await prisma.imovel.update({
                where: { inscimob: String(inscimob) },
                data: { malha: feature.geometry }
            });
            updatedCount++;
        } else {
            notFoundCount++;
        }
    }

    console.log(`Processamento GeoJSON finalizado. Sucesso: ${updatedCount}, Não encontrados: ${notFoundCount}`);

    return {
        total: geojson.features.length,
        updated: updatedCount,
        notFound: notFoundCount
    };
}

export interface ComplementoImportData {
    unidade: string;
    indicacaof: string;
    numeroPredial: string;
}

export async function processComplementoImport(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];

    const validatedData: ComplementoImportData[] = data.map((row: any) => ({
        unidade: String(row.unidade || row.UNIDADE || ''),
        indicacaof: String(row.indicacaof || row.INDICACAOF || row.inscimob || ''),
        numeroPredial: String(row['número predial'] || row.NUMERO_PREDIAL || row.numero_predial || '')
    })).filter(item => item.unidade && item.indicacaof);

    if (validatedData.length === 0) {
        throw new Error("Nenhum dado válido de complemento encontrado.");
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (const item of validatedData) {
        try {
            // Verifica se o imóvel pai existe
            const imovel = await prisma.imovel.findUnique({ where: { inscimob: item.indicacaof } });
            if (!imovel) {
                console.warn(`Imóvel ${item.indicacaof} não encontrado para o complemento ${item.unidade}`);
                skippedCount++;
                continue;
            }

            await prisma.complemento.upsert({
                where: {
                    inscimob_unidade: {
                        inscimob: item.indicacaof,
                        unidade: item.unidade
                    }
                },
                update: {
                    numeroPredial: item.numeroPredial
                },
                create: {
                    inscimob: item.indicacaof,
                    unidade: item.unidade,
                    numeroPredial: item.numeroPredial,
                    status: "NAO_INICIADO",
                    liberadoInstalacao: false
                }
            });
            importedCount++;
        } catch (e) {
            console.error(`Erro ao importar complemento ${item.unidade} do imóvel ${item.indicacaof}:`, e);
            skippedCount++;
        }
    }

    return {
        total: validatedData.length,
        imported: importedCount,
        skipped: skippedCount
    };
}

export async function processComplementoGeoJSONImport(buffer: Buffer) {
    const content = buffer.toString('utf-8');
    const geojson = JSON.parse(content);

    if (geojson.type !== 'FeatureCollection') {
        throw new Error("O arquivo não é uma FeatureCollection GeoJSON válida.");
    }

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const feature of geojson.features) {
        const inscimob = String(feature.properties?.indicacaof || feature.properties?.inscimob || '');
        const unidade = String(feature.properties?.unidade || '');

        if (!inscimob || !unidade) continue;

        const coords = feature.geometry.type === 'Point' ? feature.geometry.coordinates : null;
        if (!coords) continue;

        try {
            const complemento = await prisma.complemento.findUnique({
                where: {
                    inscimob_unidade: {
                        inscimob,
                        unidade
                    }
                }
            });

            if (complemento) {
                await prisma.complemento.update({
                    where: { id: complemento.id },
                    data: {
                        x: coords[0],
                        y: coords[1]
                    }
                });
                updatedCount++;
            } else {
                notFoundCount++;
            }
        } catch (e) {
            console.error(`Erro ao atualizar geojson do complemento ${unidade} do imóvel ${inscimob}`);
            notFoundCount++;
        }
    }

    return {
        total: geojson.features.length,
        updated: updatedCount,
        notFound: notFoundCount
    };
}
