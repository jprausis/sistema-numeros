import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

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

        for (const feature of geojson.features) {
            const inscimob = feature.properties?.inscimob;

            if (!inscimob) {
                console.warn('Feição ignorada: propriedade "inscimob" ausente.', feature.properties);
                continue;
            }

            // Procura o imóvel no banco
            const imovel = await prisma.imovel.findUnique({
                where: { inscimob: String(inscimob) }
            });

            if (imovel) {
                // Atualiza a geometria (malha)
                await prisma.imovel.update({
                    where: { inscimob: String(inscimob) },
                    data: {
                        malha: feature.geometry
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
