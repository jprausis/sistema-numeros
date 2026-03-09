import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { restrictToAdmin } from "@/lib/auth";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const restriction = await restrictToAdmin();
    if (restriction) return restriction;

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
