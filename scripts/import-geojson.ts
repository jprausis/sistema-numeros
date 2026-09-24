import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { convertGeometryToWgs84 } from '../src/utils/geo';

const prisma = new PrismaClient();

async function importGeoJSON(filePath: string) {
    try {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            console.error(`Arquivo não encontrado: ${absolutePath}`);
            return;
        }

        const fileContent = fs.readFileSync(absolutePath, 'utf-8');
        const geojson = JSON.parse(fileContent);

        if (geojson.type !== 'FeatureCollection') {
            console.error('O arquivo não é uma FeatureCollection GeoJSON válida.');
            return;
        }

        console.log(`Iniciando importação de ${geojson.features.length} feições...`);

        let updatedCount = 0;
        let notFoundCount = 0;
        let missingKeyCount = 0;

        for (const feature of geojson.features) {
            const rawInsc = feature.properties?.inscimob
                ?? feature.properties?.INSCIMOB
                ?? feature.properties?.lote
                ?? feature.properties?.LOTE
                ?? feature.properties?.indicacaof
                ?? feature.properties?.INDICACAOF
                ?? feature.properties?.inscricao
                ?? feature.properties?.INSCRICAO;

            if (!rawInsc) {
                missingKeyCount++;
                continue;
            }

            const inscClean = String(rawInsc).trim();

            // Procura o imóvel no banco com ou sem espaço no início
            const imovel = await prisma.imovel.findFirst({
                where: {
                    OR: [
                        { inscimob: inscClean },
                        { inscimob: ` ${inscClean}` }
                    ]
                }
            });

            if (imovel) {
                // Atualiza a geometria (malha) convertida para WGS84 se estiver em UTM
                const convertedGeometry = convertGeometryToWgs84(feature.geometry);

                await prisma.imovel.update({
                    where: { inscimob: imovel.inscimob },
                    data: {
                        malha: convertedGeometry
                    }
                });
                updatedCount++;
                if (updatedCount % 100 === 0) {
                    console.log(`Progresso: ${updatedCount} imóveis atualizados...`);
                }
            } else {
                notFoundCount++;
            }
        }

        console.log('--- Resumo da Importação ---');
        console.log(`Total de feições: ${geojson.features.length}`);
        console.log(`Imóveis atualizados com sucesso: ${updatedCount}`);
        console.log(`Imóveis não encontrados no banco: ${notFoundCount}`);
        console.log(`Feições sem chave de inscrição: ${missingKeyCount}`);
        console.log('----------------------------');

    } catch (error) {
        console.error('Erro durante a importação:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Pega o caminho do arquivo do argumento da linha de comando
const filePath = process.argv[2];
if (!filePath) {
    console.log('Uso: npx ts-node scripts/import-geojson.ts <caminho_para_arquivo.geojson>');
} else {
    importGeoJSON(filePath);
}
