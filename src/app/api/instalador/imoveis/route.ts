import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const imoveis = await prisma.imovel.findMany({
            include: {
                bairro: { select: { nome: true } }
            }
        });

        console.log(`[API-GET-IMOVEIS] Encontrados ${imoveis.length} imóveis.`);
        return NextResponse.json({ imoveis });
    } catch (error) {
        console.error("Erro ao listar imóveis:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
