import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, getRequestMeta, ROLE_LABEL } from "@/lib/auth";
import { createAuditLog, diffCampos } from "@/lib/audit";
import { movimentarEstoqueSeguro } from "@/lib/estoque";
import { CODIGO_AGENDAMENTO_EXISTENTE, CODIGO_IMOVEL_CONCLUIDO, mensagemAgendamentoExistente, mensagemImovelConcluido } from "@/utils/avisosAgendamento";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const { user, response } = await requireUser(["ADMIN", "OPERATOR", "PAINEL_PREFEITURA"]);
    if (response) return response;

    try {
        const { protocolo, inscimob: rawInscimob, confirmarConcluido, confirmarAgendamentoExistente } = await req.json();
        const inscimob = String(rawInscimob || "").trim();

        if (!protocolo || !inscimob) {
            return NextResponse.json({ error: "Protocolo e inscimob são obrigatórios" }, { status: 400 });
        }

        const imovel = await prisma.imovel.findUnique({ where: { inscimob } });
        if (!imovel) {
            return NextResponse.json({ error: `Imóvel com inscrição ${inscimob} não encontrado.` }, { status: 404 });
        }

        // Imóvel já instalado: só vincula (e volta para AGENDADO) se o usuário confirmar a nova visita
        const remarcandoConcluido = imovel.status === "CONCLUIDO";
        if (remarcandoConcluido && confirmarConcluido !== true) {
            return NextResponse.json({
                error: `${mensagemImovelConcluido(imovel)} Confirme para remarcar uma nova visita.`,
                code: CODIGO_IMOVEL_CONCLUIDO,
                imovel: { inscimob: imovel.inscimob, numeroAInstalar: imovel.numeroAInstalar, dataExecucao: imovel.dataExecucao }
            }, { status: 409 });
        }

        const antes = await prisma.agendamento.findUnique({ where: { protocolo } });
        if (!antes) {
            return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
        }

        // Outro agendamento em aberto para o mesmo imóvel: avisa antes de deixar dois na fila
        const outroAberto = await prisma.agendamento.findFirst({
            where: {
                inscimobVinculo: inscimob,
                status: { notIn: ["CONCLUIDO", "CANCELADO"] },
                NOT: { protocolo }
            },
            orderBy: { createdAt: "desc" },
            select: { protocolo: true, dataHora: true, inscimobVinculo: true }
        });
        if (outroAberto && confirmarAgendamentoExistente !== true) {
            return NextResponse.json({
                error: `${mensagemAgendamentoExistente(outroAberto)} Confirme para vincular mesmo assim.`,
                code: CODIGO_AGENDAMENTO_EXISTENTE,
                agendamento: outroAberto
            }, { status: 409 });
        }

        const agendamento = await prisma.agendamento.update({
            where: { protocolo },
            data: {
                inscimobVinculo: inscimob,
                status: "AGENDADO" // Garante status correto ao vincular
            }
        });

        await prisma.imovel.update({
            where: { inscimob },
            data: {
                status: "AGENDADO",
                usuarioAlt: `Vinculado a agendamento por ${ROLE_LABEL[user.role] || user.role}: ${user.name || user.email}`
            }
        });

        // Saiu de CONCLUIDO: as peças voltam ao estoque, senão a nova conclusão desconta em dobro
        await movimentarEstoqueSeguro(prisma, {
            numero: imovel.numeroAInstalar,
            statusAnterior: imovel.status,
            statusNovo: "AGENDADO",
            referencia: inscimob,
            descricao: `imóvel Nº ${imovel.numeroAInstalar} (${inscimob}) - nova visita pelo agendamento ${protocolo}`,
            userEmail: user.email,
        });

        await createAuditLog({
            userId: user.id,
            userEmail: user.email || "desconhecido",
            action: "VINCULAR_AGENDAMENTO",
            resource: "agendamento",
            resourceId: protocolo,
            details: {
                perfil: user.role,
                inscimob,
                statusAnteriorImovel: imovel.status,
                ...(remarcandoConcluido ? { remarcadoAposConclusao: true } : {}),
                ...(outroAberto ? { outroAgendamentoAberto: outroAberto.protocolo } : {}),
                alteracoes: [
                    ...diffCampos(antes, agendamento, ["inscimobVinculo", "status"]),
                    { campo: "imovel.status", antes: imovel.status, depois: "AGENDADO" },
                ],
            },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, agendamento });
    } catch (error) {
        console.error("Erro ao vincular agendamento:", error);
        return NextResponse.json({ error: "Erro ao realizar vínculo" }, { status: 500 });
    }
}
