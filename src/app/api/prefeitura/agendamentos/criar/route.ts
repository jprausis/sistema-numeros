import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { generateProtocol } from "@/lib/scheduling";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
    try {
        let dbUser = await getSessionUser();
        let userEmail = dbUser?.email;
        let userName = dbUser?.name;
        let userId = dbUser?.id;

        if (!dbUser) {
            const supabase = await createClient();
            const { data: { user: sbUser } } = await supabase.auth.getUser();
            if (!sbUser) {
                return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
            }
            userId = sbUser.id;
            userEmail = sbUser.email || "prefeitura@projemix.com.br";
            userName = sbUser.user_metadata?.name || sbUser.email || "Operador Prefeitura";
        }

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

        // Montar a data e hora do agendamento
        const [year, month, day] = String(data).split("-").map(Number);
        const [hours, minutes] = String(horario).split(":").map(Number);

        if (!year || !month || !day || isNaN(hours) || isNaN(minutes)) {
            return NextResponse.json({ error: "Formato de data ou horário inválido." }, { status: 400 });
        }

        const dataHora = new Date(year, month - 1, day, hours, minutes);

        // Montar endereço completo
        const enderecoParts = [];
        if (imovel.endereco) enderecoParts.push(imovel.endereco);
        enderecoParts.push(`Nº ${imovel.numeroAInstalar}`);
        if (imovel.bairro?.nome) enderecoParts.push(imovel.bairro.nome);
        const enderecoCompleto = enderecoParts.join(" - ");

        const contactName = nome?.trim() || "Morador / Prefeitura";
        const contactPhone = telefone?.trim() || "";

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
            const random = Math.floor(100000 + Math.random() * 900000);
            targetProtocolo = `PREF-${random}`;
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
            ? (observacao?.trim() || null)
            : imovel.obsPendente;

        const updatedImovel = await prisma.imovel.update({
            where: { inscimob: imovel.inscimob },
            data: {
                status: "AGENDADO",
                obsPendente: obsNote,
                usuarioAlt: isEdit
                    ? `Agendamento editado por Prefeitura: ${userName || userEmail}`
                    : `Agendado por Prefeitura: ${userName || userEmail}`
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
                observacao: observacao?.trim() || null,
                isEdit
            }
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
        return NextResponse.json({ error: error.message || "Erro interno ao cadastrar agendamento" }, { status: 500 });
    }
}
