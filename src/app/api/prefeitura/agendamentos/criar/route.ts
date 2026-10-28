import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireUser, getRequestMeta, AGENDA_ROLES, ROLE_LABEL } from "@/lib/auth";
import { createAuditLog, diffCampos } from "@/lib/audit";
import { generateUniqueProtocol, buscarConflitoHorario, mensagemConflitoHorario } from "@/lib/agendamentos";
import { buildBrazilDate } from "@/lib/timezone";

export async function POST(req: NextRequest) {
    const { user, response } = await requireUser(AGENDA_ROLES);
    if (response) return response;
    const userEmail = user.email;
    const userName = user.name;
    const userId = user.id;

    try {

        const body = await req.json();
        const { inscimob, data, horario, nome, telefone, observacao, protocolo: existingProtocolo } = body;

        if (!inscimob) {
            return NextResponse.json({ error: "Inscrição imobiliária (inscimob) é obrigatória" }, { status: 400 });
        }

        if (!data || !horario) {
            return NextResponse.json({ error: "Data e horário do agendamento são obrigatórios" }, { status: 400 });
        }

        // Buscar o imóvel
        const imovel = await prisma.imovel.findUnique({
            where: { inscimob: String(inscimob).trim() },
            include: {
                bairro: { select: { id: true, nome: true, visivelInstalacao: true } },
                complementos: true
            }
        });

        if (!imovel) {
            return NextResponse.json({ error: `Imóvel com inscrição ${inscimob} não encontrado.` }, { status: 404 });
        }

        // Montar a data e hora do agendamento (sempre no horário de Brasília)
        const dataHora = buildBrazilDate(data, horario);

        if (!dataHora) {
            return NextResponse.json({ error: "Formato de data ou horário inválido." }, { status: 400 });
        }

        // Montar endereço completo
        const enderecoParts = [];
        if (imovel.endereco) enderecoParts.push(imovel.endereco);
        enderecoParts.push(`Nº ${imovel.numeroAInstalar}`);
        if (imovel.bairro?.nome) enderecoParts.push(imovel.bairro.nome);
        const enderecoCompleto = enderecoParts.join(" - ");

        const contactName = String(nome ?? "").trim() || "Morador / Prefeitura";
        const contactPhone = String(telefone ?? "").trim();

        let targetProtocolo = existingProtocolo;
        if (!targetProtocolo) {
            const existing = await prisma.agendamento.findFirst({
                where: {
                    inscimobVinculo: imovel.inscimob,
                    status: { notIn: ["CONCLUIDO", "CANCELADO"] }
                },
                orderBy: { createdAt: "desc" }
            });
            if (existing) {
                targetProtocolo = existing.protocolo;
            }
        }

        // Apenas um agendamento ativo por horário (ao editar sem trocar o horário, não revalida)
        const atual = targetProtocolo
            ? await prisma.agendamento.findUnique({ where: { protocolo: targetProtocolo } })
            : null;
        const mesmoHorario = !!atual && atual.dataHora?.getTime() === dataHora.getTime()
            && !["CONCLUIDO", "CANCELADO"].includes(atual.status);
        const conflito = mesmoHorario ? null : await buscarConflitoHorario(dataHora, targetProtocolo);
        if (conflito) {
            return NextResponse.json({ error: mensagemConflitoHorario(conflito, horario) }, { status: 409 });
        }

        let agendamento;
        let isEdit = false;

        if (targetProtocolo) {
            isEdit = true;
            agendamento = await prisma.agendamento.update({
                where: { protocolo: targetProtocolo },
                data: {
                    nome: contactName,
                    telefone: contactPhone,
                    enderecoCompleto,
                    dataHora,
                    status: "AGENDADO",
                    inscimobVinculo: imovel.inscimob
                }
            });
        } else {
            targetProtocolo = await generateUniqueProtocol("PREF");
            agendamento = await prisma.agendamento.create({
                data: {
                    protocolo: targetProtocolo,
                    nome: contactName,
                    telefone: contactPhone,
                    enderecoCompleto,
                    dataHora,
                    status: "AGENDADO",
                    inscimobVinculo: imovel.inscimob
                }
            });
        }

        // 2. Atualizar o imóvel com status AGENDADO
        const obsNote = observacao !== undefined
            ? (String(observacao ?? "").trim() || null)
            : imovel.obsPendente;

        const updatedImovel = await prisma.imovel.update({
            where: { inscimob: imovel.inscimob },
            data: {
                status: "AGENDADO",
                obsPendente: obsNote,
                usuarioAlt: isEdit
                    ? `Agendamento editado por ${ROLE_LABEL[user.role] || user.role}: ${userName || userEmail}`
                    : `Agendado por ${ROLE_LABEL[user.role] || user.role}: ${userName || userEmail}`
            },
            include: {
                bairro: { select: { id: true, nome: true, visivelInstalacao: true } },
                complementos: true
            }
        });

        // 3. Log de Auditoria
        await createAuditLog({
            userId: userId || "prefeitura",
            userEmail: userEmail || "prefeitura@projemix.com.br",
            action: isEdit ? "EDITAR_AGENDAMENTO" : "CADASTRAR_AGENDAMENTO",
            resource: "imovel",
            resourceId: imovel.inscimob,
            details: {
                protocolo: targetProtocolo,
                dataHora: dataHora.toISOString(),
                nome: contactName,
                telefone: contactPhone,
                observacao: obsNote,
                isEdit,
                perfil: user.role,
                alteracoes: [
                    ...diffCampos(atual, agendamento, ["nome", "telefone", "dataHora", "status", "inscimobVinculo"]),
                    ...diffCampos(imovel, updatedImovel, ["status", "obsPendente"]).map(a => ({ ...a, campo: `imovel.${a.campo}` })),
                ],
                antes: atual
            },
            ...getRequestMeta(req)
        });

        return NextResponse.json({
            success: true,
            protocolo: targetProtocolo,
            agendamento,
            imovel: updatedImovel,
            isEdit
        });
    } catch (error: any) {
        console.error("Erro ao cadastrar agendamento pela prefeitura:", error);
        return NextResponse.json({ error: "Erro interno ao cadastrar agendamento" }, { status: 500 });
    }
}
