import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // 1. Deletar todos os imóveis associados a este bairro primeiro
        await prisma.imovel.deleteMany({
            where: { bairroId: id }
        });

        // 2. Deletar o bairro
        await prisma.bairro.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao deletar bairro:", error);
        return NextResponse.json({ error: "Erro ao deletar bairro" }, { status: 500 });
    }
}
