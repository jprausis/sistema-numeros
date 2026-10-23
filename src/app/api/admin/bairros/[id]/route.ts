import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, getRequestMeta } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, response } = await requireUser(["ADMIN"]);
    if (response) return response;

    const { id } = await params;

    try {
        const bairro = await prisma.bairro.findUnique({
            where: { id },
            include: { _count: { select: { imoveis: true } } }
        });
        if (!bairro) {
            return NextResponse.json({ error: "Bairro não encontrado" }, { status: 404 });
        }

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

        await createAuditLog({
            userId: user.id,
            userEmail: user.email || "desconhecido",
            action: "DELETE_BAIRRO",
            resource: "bairro",
            resourceId: id,
            details: { nome: bairro.nome, imoveisExcluidos: bairro._count.imoveis },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao deletar bairro:", error);
        return NextResponse.json({ error: "Erro ao deletar bairro" }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { response } = await requireUser(["ADMIN", "OPERATOR"]);
    if (response) return response;

    const { id } = await params;

    try {
        const body = await req.json();
        const { visivelInstalacao } = body;

        if (typeof visivelInstalacao !== "boolean") {
            return NextResponse.json({ error: "Campo visivelInstalacao inválido." }, { status: 400 });
        }

        const updated = await prisma.bairro.update({
            where: { id },
            data: { visivelInstalacao }
        });

        return NextResponse.json({ success: true, bairro: updated });
    } catch (error) {
        console.error("Erro ao atualizar bairro:", error);
        return NextResponse.json({ error: "Erro ao atualizar bairro" }, { status: 500 });
    }
}
