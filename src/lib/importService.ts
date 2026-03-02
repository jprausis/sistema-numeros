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
