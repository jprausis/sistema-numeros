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
    const { user, response } = await requireUser(["ADMIN", "OPERATOR"]);
    if (response) return response;

    const { id } = await params;

    try {
        const body = await req.json();
        const { visivelInstalacao, status } = body;

        // Marcar o bairro como concluído (mesmo com imóveis que não serão instalados) ou reabrir
        if (status !== undefined) {
            if (user.role !== "ADMIN") {
                return NextResponse.json({ error: "Apenas administradores podem concluir ou reabrir um bairro." }, { status: 403 });
            }
            if (status !== "CONCLUIDO" && status !== "ATIVO") {
                return NextResponse.json({ error: "Situação inválida." }, { status: 400 });
            }

            const antes = await prisma.bairro.findUnique({ where: { id }, select: { nome: true, status: true } });
            if (!antes) {
                return NextResponse.json({ error: "Bairro não encontrado" }, { status: 404 });
            }

            const updated = await prisma.bairro.update({ where: { id }, data: { status } });
            const [total, instalados] = await Promise.all([
                prisma.imovel.count({ where: { bairroId: id } }),
                prisma.imovel.count({ where: { bairroId: id, status: "CONCLUIDO" } }),
            ]);

            await createAuditLog({
                userId: user.id,
                userEmail: user.email || "desconhecido",
                action: status === "CONCLUIDO" ? "BAIRRO_CONCLUIDO" : "BAIRRO_REABERTO",
                resource: "bairro",
                resourceId: id,
                details: {
                    nome: antes.nome,
                    alteracoes: [{ campo: "status", antes: antes.status, depois: status }],
                    imoveis: total,
                    instalados,
                    semInstalacao: total - instalados,
                },
                ...getRequestMeta(req)
            });

            return NextResponse.json({ success: true, bairro: updated });
        }

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
