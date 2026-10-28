import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, getRequestMeta, ROLE_LABEL } from "@/lib/auth";
import { createAuditLog, diffCampos } from "@/lib/audit";
import { buildBrazilDate, splitBrazilDate } from "@/lib/timezone";
import { movimentarEstoqueSeguro } from "@/lib/estoque";
import { buscarConflitoHorario, mensagemConflitoHorario } from "@/lib/agendamentos";
import { validarContato } from "@/utils/contato";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { user, response } = await requireUser(["ADMIN", "PAINEL_PREFEITURA"]);
        if (response) return response;

        const autor = `${ROLE_LABEL[user.role] || user.role}: ${user.name || user.email}`;
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

        // Nome e telefone do morador são obrigatórios
        const erroContato = validarContato(nome ?? agendamento.nome, telefone ?? agendamento.telefone);
        if (erroContato && (nome !== undefined || telefone !== undefined)) {
            return NextResponse.json({ error: erroContato }, { status: 400 });
        }

        let dataHora: Date | null = agendamento.dataHora;
        if (data && horario) {
            const parsed = buildBrazilDate(data, horario);
            if (parsed) dataHora = parsed;
        }

        // Apenas um agendamento ativo por horário (contatos sem vínculo não ocupam horário)
        const statusFinal = status ?? agendamento.status;
        const ocupaHorario = (agendamento.protocolo.startsWith("PREF-") || agendamento.inscimobVinculo)
            && !["CONCLUIDO", "CANCELADO"].includes(statusFinal);
        const horarioMudou = dataHora?.getTime() !== agendamento.dataHora?.getTime();
        const reativando = ["CONCLUIDO", "CANCELADO"].includes(agendamento.status) && status !== undefined;
        if (ocupaHorario && dataHora && (horarioMudou || reativando)) {
            const conflito = await buscarConflitoHorario(dataHora, protocolo);
            if (conflito) {
                return NextResponse.json({ error: mensagemConflitoHorario(conflito, splitBrazilDate(dataHora).horario) }, { status: 409 });
            }
        }

        const updateAgendamentoData: any = {};
        if (nome !== undefined) updateAgendamentoData.nome = String(nome).trim();
        if (telefone !== undefined) updateAgendamentoData.telefone = String(telefone).trim();
        if (dataHora !== undefined) updateAgendamentoData.dataHora = dataHora;
        if (status !== undefined) updateAgendamentoData.status = status;

        const updated = await prisma.agendamento.update({
            where: { protocolo },
            data: updateAgendamentoData
        });

        // Se houver imóvel vinculado, sincronizar observação e status conforme necessário
        let imovelAlteracoes: ReturnType<typeof diffCampos> = [];
        if (agendamento.inscimobVinculo) {
            const updateImovelData: any = {};
            if (observacao !== undefined) {
                updateImovelData.obsPendente = String(observacao ?? "").trim() || null;
            }

            if (status === "CANCELADO") {
                updateImovelData.status = "NAO_INICIADO";
            } else if (status === "CONCLUIDO") {
                updateImovelData.status = "CONCLUIDO";
            } else if (status === "AGENDADO") {
                updateImovelData.status = "AGENDADO";
            }

            updateImovelData.usuarioAlt = `Agendamento editado por ${autor}`;

            const imovelAntes = await prisma.imovel.findUnique({
                where: { inscimob: agendamento.inscimobVinculo },
                select: { status: true, obsPendente: true }
            });
            if (updateImovelData.status === "CONCLUIDO" && imovelAntes?.status !== "CONCLUIDO") {
                updateImovelData.dataExecucao = new Date();
            }

            const imovelDepois = await prisma.imovel.update({
                where: { inscimob: agendamento.inscimobVinculo },
                data: updateImovelData
            });
            imovelAlteracoes = diffCampos(imovelAntes, imovelDepois, ["status", "obsPendente"])
                .map(a => ({ ...a, campo: `imovel.${a.campo}` }));

            await movimentarEstoqueSeguro(prisma, {
                numero: imovelDepois.numeroAInstalar,
                statusAnterior: imovelAntes?.status,
                statusNovo: imovelDepois.status,
                referencia: imovelDepois.inscimob,
                descricao: `imóvel Nº ${imovelDepois.numeroAInstalar} (${imovelDepois.inscimob}) - via agendamento ${protocolo}`,
                userEmail: user.email,
            });
        }

        const alteracoes = [
            ...diffCampos(agendamento, updated, ["nome", "telefone", "dataHora", "status"]),
            ...imovelAlteracoes,
        ];

        // Registrar Log de Auditoria
        await createAuditLog({
            userId: user.id,
            userEmail: user.email || "desconhecido",
            action: "UPDATE_AGENDAMENTO",
            resource: "agendamento",
            resourceId: protocolo,
            details: {
                perfil: user.role,
                inscimob: agendamento.inscimobVinculo,
                alteracoes,
                antes: agendamento,
                depois: updated,
                observacao
            },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, agendamento: updated });
    } catch (error: any) {
        console.error("Erro ao editar agendamento:", error);
        return NextResponse.json({ error: "Erro interno ao atualizar agendamento" }, { status: 500 });
    }
}
