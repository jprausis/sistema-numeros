import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { calculateDistance } from "@/lib/geoUtils";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lon = parseFloat(searchParams.get("lon") || "0");
    const radius = parseFloat(searchParams.get("radius") || "50"); // Default 50m

    if (!lat || !lon) {
        return NextResponse.json({ error: "Coordenadas são obrigatórias" }, { status: 400 });
    }

    try {
        // Buscar todos os imóveis não concluídos (ou pendentes) para filtrar
        const imoveis = await prisma.imovel.findMany({
            where: {
                status: { not: "CONCLUIDO" }
            },
            include: {
                bairro: { select: { nome: true } }
            }
        });

        const candidates = imoveis
            .map((imovel: any) => ({
                ...imovel,
                distance: calculateDistance(lat, lon, imovel.x, imovel.y)
            }))
            .filter((imovel: any) => imovel.distance <= radius)
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, 3);

        return NextResponse.json({ candidates });
    } catch (error) {
        console.error("Erro na busca por GPS:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
