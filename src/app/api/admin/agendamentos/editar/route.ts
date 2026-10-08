import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser, restrictToAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { buildBrazilDate } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const restriction = await restrictToAdmin();
        if (restriction) return restriction;

        const user = await getSessionUser();
        const body = await req.json();
        const { protocolo, data, horario, nome, telefone, observacao, status } = body;

        if (!protocolo) {
            return NextResponse.json({ error: "Protocolo é obrigatório" }, { status: 400 });
        }

        const agendamento = await prisma.agendamento.findUnique({
            where: { protocolo }
        });

        if (!agendamento) {
            return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
        }

        let dataHora: Date | null = agendamento.dataHora;
        if (data && horario) {
            const parsed = buildBrazilDate(data, horario);
            if (parsed) dataHora = parsed;
        }

        const updateAgendamentoData: any = {};
        if (nome !== undefined) updateAgendamentoData.nome = nome.trim() || agendamento.nome;
        if (telefone !== undefined) updateAgendamentoData.telefone = telefone.trim();
        if (dataHora !== undefined) updateAgendamentoData.dataHora = dataHora;
        if (status !== undefined) updateAgendamentoData.status = status;

        const updated = await prisma.agendamento.update({
            where: { protocolo },
            data: updateAgendamentoData
        });

        // Se houver imóvel vinculado, sincronizar observação e status conforme necessário
        if (agendamento.inscimobVinculo) {
            const updateImovelData: any = {};
            if (observacao !== undefined) {
                updateImovelData.obsPendente = observacao.trim() || null;
            }

            if (status === "CANCELADO") {
                updateImovelData.status = "NAO_INICIADO";
            } else if (status === "CONCLUIDO") {
                updateImovelData.status = "CONCLUIDO";
            } else if (status === "AGENDADO") {
                updateImovelData.status = "AGENDADO";
            }

            updateImovelData.usuarioAlt = `Agendamento editado por admin: ${user?.email || 'admin'}`;

            await prisma.imovel.update({
                where: { inscimob: agendamento.inscimobVinculo },
                data: updateImovelData
            });
        }

        // Registrar Log de Auditoria
        await createAuditLog({
            userId: user?.id || "admin",
            userEmail: user?.email || "admin@projemix.com.br",
            action: "UPDATE_AGENDAMENTO",
            resource: "agendamento",
            resourceId: protocolo,
            details: {
                antes: agendamento,
                depois: updated,
                observacao
            }
        });

        return NextResponse.json({ success: true, agendamento: updated });
    } catch (error: any) {
        console.error("Erro ao editar agendamento:", error);
        return NextResponse.json({ error: "Erro interno ao atualizar agendamento" }, { status: 500 });
    }
}
