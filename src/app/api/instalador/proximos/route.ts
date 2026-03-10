import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { calculateDistance } from "@/lib/geoUtils";
import { utmToLatLng } from "@/utils/geo";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lon = parseFloat(searchParams.get("lon") || "0");
    const radius = parseFloat(searchParams.get("radius") || "50");

    if (!lat || !lon) {
        return NextResponse.json({ error: "Coordenadas são obrigatórias" }, { status: 400 });
    }

    try {
        // Buscar todos os imóveis que PODEM ser trabalhados
        // (Não Concluídos, ou que foram marcados como Ausente ou Liberado)
        const imoveis = await prisma.imovel.findMany({
            where: {
                status: {
                    in: ["NAO_INICIADO", "PENDENTE", "AUSENTE", "LIBERADO"]
                }
            },
            include: {
                bairro: { select: { nome: true } },
                complementos: true
            }
        });

        const candidates = imoveis
            .map((imovel: any) => {
                const [targetLat, targetLon] = utmToLatLng(imovel.x, imovel.y);
                return {
                    ...imovel,
                    distance: calculateDistance(lat, lon, targetLat, targetLon)
                };
            })
            .filter((imovel: any) => imovel.distance <= radius)
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, 5); // Aumentado para 5 candidatos

        return NextResponse.json({ candidates });
    } catch (error) {
        console.error("Erro na busca por GPS:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
