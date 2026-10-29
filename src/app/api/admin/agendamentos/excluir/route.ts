import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, getRequestMeta, ROLE_LABEL } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function DELETE(req: NextRequest) {
    // Excluir apaga de vez: só o admin. O Painel Prefeitura cancela (status CANCELADO).
    const { user, response } = await requireUser(["ADMIN"]);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const protocolo = searchParams.get("protocolo");

    if (!protocolo) {
        return NextResponse.json({ error: "Protocolo não informado" }, { status: 400 });
    }

    try {
        const agendamento = await prisma.agendamento.findUnique({
            where: { protocolo }
        });

        if (!agendamento) {
            return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
        }

        await prisma.agendamento.delete({
            where: { protocolo }
        });

        if (agendamento.inscimobVinculo) {
            const imovel = await prisma.imovel.findUnique({
                where: { inscimob: agendamento.inscimobVinculo }
            });
            if (imovel && imovel.status === "AGENDADO") {
                await prisma.imovel.update({
                    where: { inscimob: agendamento.inscimobVinculo },
                    data: {
                        status: "NAO_INICIADO",
                        usuarioAlt: `Agendamento excluído por ${ROLE_LABEL[user.role] || user.role}: ${user.name || user.email}`
                    }
                });
            }
        }

        // Registrar auditoria
        await createAuditLog({
            userId: user.id,
            userEmail: user.email || "desconhecido",
            action: "DELETE_AGENDAMENTO",
            resource: "agendamento",
            resourceId: protocolo,
            details: {
                perfil: user.role,
                inscimob: agendamento.inscimobVinculo,
                mensagem: `Agendamento excluído (${ROLE_LABEL[user.role] || user.role})`,
                dadosExcluidos: agendamento
            },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao excluir agendamento:", error);
        return NextResponse.json({ error: "Erro interno ao excluir agendamento" }, { status: 500 });
    }
}
