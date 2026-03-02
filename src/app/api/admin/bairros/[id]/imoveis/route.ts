import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const imoveis = await prisma.imovel.findMany({
            where: { bairroId: id },
            orderBy: { numeroAInstalar: 'asc' }
        });

        return NextResponse.json({ imoveis });
    } catch (error) {
        console.error("Erro ao buscar imóveis do bairro:", error);
        return NextResponse.json({ error: "Erro ao buscar imóveis" }, { status: 500 });
    }
}
