import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const imovel = await prisma.imovel.findUnique({
            where: { inscimob: id },
            include: {
                bairro: { select: { nome: true } }
            }
        });

        if (!imovel) {
            return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
        }

        return NextResponse.json({ imovel });
    } catch (error) {
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
