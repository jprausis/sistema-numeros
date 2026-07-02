import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const bairroId = searchParams.get("bairroId") || undefined;

        const whereImovel = bairroId ? { bairroId } : {};
        const whereComplemento = bairroId ? { imovel: { bairroId } } : {};

        const totalImoveis = await prisma.imovel.count({ where: whereImovel });
        const concluidos = await prisma.imovel.count({ where: { ...whereImovel, status: "CONCLUIDO" } });
        const liberados = await prisma.imovel.count({ where: { ...whereImovel, status: "LIBERADO" } });
        const ausentes = await prisma.imovel.count({ where: { ...whereImovel, status: "AUSENTE" } });

        const complementosData = await prisma.complemento.findMany({
            where: whereComplemento,
            select: { numeroPredial: true, status: true, fotos: true }
        });

        const temFotosReais = (fotosStr: string | null | undefined): boolean => {
            if (!fotosStr) return false;
            const trimmed = fotosStr.trim();
            return trimmed !== "" && trimmed !== "null" && trimmed !== "[]";
        };

        let complementosInstalados = 0;
        let algarismosComplementosInstalados = 0;

        complementosData.forEach(c => {
            if (c.status === "CONCLUIDO" && temFotosReais(c.fotos)) {
                complementosInstalados++;
                const numStr = c.numeroPredial || "";
                algarismosComplementosInstalados += numStr.length;
            }
        });

        const totalComplementos = complementosData.length;
        const complementosLiberados = await prisma.complemento.count({ where: { ...whereComplemento, liberadoInstalacao: true } });

        const imoveisData = await prisma.imovel.findMany({
            where: whereImovel,
            select: { numeroAInstalar: true, status: true }
        });

        let totalDigitos = 0;
        let digitosInstalados = 0;

        imoveisData.forEach(im => {
            const numStr = im.numeroAInstalar || "";
            const len = numStr.length;
            totalDigitos += len;

            if (im.status === "CONCLUIDO") {
                digitosInstalados += len;
            }
        });

        const totalGeralAlgarismosInstalados = digitosInstalados + algarismosComplementosInstalados;

        return NextResponse.json({
            totalImoveis,
            concluidos,
            liberados,
            ausentes,
            totalComplementos,
            complementosLiberados,
            complementosInstalados,
            algarismosComplementosInstalados,
            totalGeralAlgarismosInstalados,
            digitos: {
                totalNecessario: totalDigitos,
                totalInstalado: digitosInstalados
            }
        });
    } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
        return NextResponse.json({ error: "Erro ao carregar estatísticas" }, { status: 500 });
    }
}

