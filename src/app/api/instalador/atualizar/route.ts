import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireUser, getRequestMeta } from "@/lib/auth";
import { concluirAgendamentosDoImovel } from "@/lib/agendamentos";

export const dynamic = "force-dynamic";

const STATUS_EXECUCAO = ["CONCLUIDO", "PENDENTE"];

export async function PATCH(req: NextRequest) {
    const { user, response } = await requireUser();
    if (response) return response;

    try {
        const body = await req.json();
        const { inscimob, status, obsPendente, fotos, complementosData, protocolo } = body;

        if (!inscimob || !status) {
            return NextResponse.json({ error: "Inscimob e Status são obrigatórios" }, { status: 400 });
        }

        const atual = await prisma.imovel.findUnique({
            where: { inscimob },
            include: { complementos: { select: { id: true } } }
        });
        if (!atual) {
            return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
        }

        const actualInstaladorResp = user.name || user.email || "Instalador";
        const novasFotos = Array.isArray(fotos) && fotos.length > 0;
        // Só registra data/instalador quando o status do principal muda nesta requisição
        // (trocar foto ou salvar só complementos não altera a data usada no ranking diário)
        const principalExecutado = STATUS_EXECUCAO.includes(status) && (status !== atual.status || !atual.dataExecucao);

        const imovelData: any = { status, usuarioAlt: user.email };
        if (novasFotos) imovelData.fotos = JSON.stringify(fotos);
        if (status === "PENDENTE") imovelData.obsPendente = obsPendente ? String(obsPendente).trim() : null;
        if (status === "CONCLUIDO") imovelData.obsPendente = null;
        if (principalExecutado) {
            imovelData.dataExecucao = new Date();
            imovelData.instaladorResp = actualInstaladorResp;
        }

        // Apenas complementos que pertencem a este imóvel
        const idsDoImovel = new Set(atual.complementos.map(c => c.id));
        const compsValidos = Array.isArray(complementosData)
            ? complementosData.filter((comp: any) => comp?.id && comp?.status && idsDoImovel.has(comp.id))
            : [];

        const imovel = await prisma.$transaction(async (tx) => {
            // 1. Atualizar o imóvel principal
            const updated = await tx.imovel.update({
                where: { inscimob },
                data: imovelData
            });

            // 2. Atualizar os complementos (se enviados no lote)
            for (const comp of compsValidos) {
                const numeroPredial = typeof comp.numeroPredial === "string" ? comp.numeroPredial.trim() : "";
                await tx.complemento.update({
                    where: { id: comp.id },
                    data: {
                        status: comp.status,
                        ...(numeroPredial ? { numeroPredial } : {}),
                        fotos: Array.isArray(comp.fotos) && comp.fotos.length > 0 ? JSON.stringify(comp.fotos) : undefined,
                        dataExecucao: STATUS_EXECUCAO.includes(comp.status) ? new Date() : undefined,
                        liberadoInstalacao: comp.status === "CONCLUIDO" ? true : undefined
                    }
                });
            }

            // 3. Vincular Agendamento se protocolo existir
            if (protocolo) {
                await tx.agendamento.updateMany({
                    where: { protocolo },
                    data: {
                        inscimobVinculo: inscimob,
                        ...(status === 'PENDENTE' ? { status: 'PENDENTE' } : {})
                    }
                });
            }

            return updated;
        });

        // 4. Imóvel concluído => concluir todos os agendamentos em aberto vinculados a ele
        // (funciona mesmo quando o instalador acessa o imóvel pelo mapa/busca, sem protocolo)
        if (imovel.status === 'CONCLUIDO') {
            await concluirAgendamentosDoImovel(inscimob);
        }

        await createAuditLog({
            userId: user.id,
            userEmail: user.email || "sem-email@projemix.com.br",
            action: "UPDATE_IMOVEL_LOTE",
            resource: "imovel",
            resourceId: inscimob,
            details: {
                status,
                statusAnterior: atual.status,
                obsPendente,
                fotos,
                complementosData: compsValidos,
                protocolo
            },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, imovel });
    } catch (error) {
        console.error("Erro ao atualizar imóvel e complementos:", error);
        return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
    }
}
