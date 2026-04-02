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
        await prisma.$transaction(async (tx) => {
            // 1. Deletar complementos de todos os imóveis do bairro primeiro
            // Isso é necessário porque Complemento tem FK para Imovel(inscimob)
            await tx.complemento.deleteMany({
                where: {
                    imovel: {
                        bairroId: id
                    }
                }
            });

            // 2. Deletar todos os imóveis associados a este bairro
            await tx.imovel.deleteMany({
                where: { bairroId: id }
            });

            // 3. Deletar o bairro
            await tx.bairro.delete({
                where: { id }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao deletar bairro:", error);
        return NextResponse.json({ error: "Erro ao deletar bairro" }, { status: 500 });
    }
}
