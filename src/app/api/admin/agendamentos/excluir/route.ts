import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser, restrictToAdmin } from "@/lib/auth";

export async function DELETE(req: NextRequest) {
    const restriction = await restrictToAdmin();
    if (restriction) return restriction;

    const user = await getSessionUser();
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

        // Registrar auditoria
        await prisma.auditLog.create({
            data: {
                userId: user?.id || 'unknown',
                userEmail: user?.email || 'unknown',
                action: "DELETE_AGENDAMENTO",
                resource: "agendamento",
                resourceId: protocolo,
                details: {
                    mensagem: "Agendamento excluído pelo administrador",
                    dadosExcluidos: agendamento
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao excluir agendamento:", error);
        return NextResponse.json({ error: "Erro interno ao excluir agendamento" }, { status: 500 });
    }
}
