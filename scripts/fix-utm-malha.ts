import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { convertGeometryToWgs84 } from '../src/utils/geo';

async function fixUtmMalhas() {
    console.log("Buscando imóveis com malha cadastrada...");
    const imoveis = await prisma.imovel.findMany({
        where: { malha: { not: null } },
        select: { inscimob: true, malha: true }
    });

    console.log(`Total de imóveis com malha encontrados: ${imoveis.length}`);

    let convertedCount = 0;
    let alreadyWgsCount = 0;

    for (const imovel of imoveis) {
        const currentMalha: any = imovel.malha;
        if (!currentMalha || !currentMalha.coordinates) continue;

        // Converte coordenadas se forem maiores que 180 (UTM)
        const newMalha = convertGeometryToWgs84(currentMalha);

        // Se a malha mudou (ou seja, tinha coordenadas UTM), atualiza no banco
        if (JSON.stringify(newMalha) !== JSON.stringify(currentMalha)) {
            await prisma.imovel.update({
                where: { inscimob: imovel.inscimob },
                data: { malha: newMalha }
            });
            convertedCount++;
            if (convertedCount % 100 === 0) {
                console.log(`Progresso: ${convertedCount} malhas convertidas para WGS84...`);
            }
        } else {
            alreadyWgsCount++;
        }
    }

    console.log("--- Concluído ---");
    console.log(`Convertidos de UTM para WGS84: ${convertedCount}`);
    console.log(`Já estavam em WGS84: ${alreadyWgsCount}`);
}

fixUtmMalhas()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
