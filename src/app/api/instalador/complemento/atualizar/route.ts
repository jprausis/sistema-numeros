import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireUser, getRequestMeta } from "@/lib/auth";
import { concluirAgendamentosDoImovel } from "@/lib/agendamentos";

export async function PATCH(req: NextRequest) {
    const { user, response } = await requireUser(["ADMIN", "OPERATOR", "INSTALLER"]);
    if (response) return response;

    try {
        const body = await req.json();
        const { id, status, fotos, numeroPredial } = body;

        if (!id) {
            return NextResponse.json({ error: "ID do complemento é obrigatório" }, { status: 400 });
        }

        const complementoAtual = await prisma.complemento.findUnique({
            where: { id }
        });

        if (!complementoAtual) {
            return NextResponse.json({ error: "Complemento não encontrado" }, { status: 404 });
        }

        const dataUpdate: any = {};
        if (status !== undefined) {
            dataUpdate.status = status;
            dataUpdate.dataExecucao = (status === "CONCLUIDO" || status === "PENDENTE") ? new Date() : null;
        }
        if (numeroPredial !== undefined) {
            dataUpdate.numeroPredial = String(numeroPredial).trim();
        }
        if (fotos !== undefined) {
            dataUpdate.fotos = (fotos === null || (Array.isArray(fotos) && fotos.length === 0)) ? null : (Array.isArray(fotos) ? JSON.stringify(fotos) : fotos);
        }

        const complemento = await prisma.complemento.update({
            where: { id },
            data: dataUpdate
        });

        // Se todos os complementos estiverem concluídos, o imóvel pai também é concluído
        if (status === "CONCLUIDO") {
            const parentImovel = await prisma.imovel.findUnique({
                where: { inscimob: complemento.inscimob },
                include: { complementos: { select: { status: true } } }
            });

            if (parentImovel && parentImovel.status !== "CONCLUIDO" && parentImovel.complementos.every(c => c.status === "CONCLUIDO")) {
                await prisma.imovel.update({
                    where: { inscimob: parentImovel.inscimob },
                    data: {
                        status: "CONCLUIDO",
                        dataExecucao: new Date(),
                        instaladorResp: user.name || user.email || "Instalador"
                    }
                });
                await concluirAgendamentosDoImovel(parentImovel.inscimob);
            }
        }

        await createAuditLog({
            userId: user.id,
            userEmail: user.email || "sem-email@projemix.com.br",
            action: "UPDATE_COMPLEMENTO",
            resource: "complemento",
            resourceId: id,
            details: {
                status,
                statusAnterior: complementoAtual.status,
                fotos,
                inscimob: complemento.inscimob
            },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, complemento });
    } catch (error) {
        console.error("Erro ao atualizar complemento:", error);
        return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
    }
}
