import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, status, fotos, instaladorResp, userId, userEmail } = body;

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
        if (fotos !== undefined) {
            dataUpdate.fotos = (fotos === null || (Array.isArray(fotos) && fotos.length === 0)) ? null : (Array.isArray(fotos) ? JSON.stringify(fotos) : fotos);
        }

        const complemento = await prisma.complemento.update({
            where: { id },
            data: dataUpdate
        });

        // Opcional: Atualizar status do imóvel pai se todos os complementos estiverem concluídos
        const parentImovel = await prisma.imovel.findUnique({
            where: { inscimob: complemento.inscimob },
            include: { complementos: true }
        });

        if (parentImovel && parentImovel.complementos.every(c => c.status === "CONCLUIDO")) {
            await prisma.imovel.update({
                where: { inscimob: parentImovel.inscimob },
                data: {
                    status: "CONCLUIDO",
                    dataExecucao: new Date(),
                    instaladorResp: instaladorResp || "Instalador Padrão"
                }
            });
        }

        // Registrar Log de Auditoria
        await createAuditLog({
            userId: userId || "sistema",
            userEmail: userEmail || "sistema@projemix.com.br",
            action: "UPDATE_COMPLEMENTO",
            resource: "complemento",
            resourceId: id,
            details: {
                status,
                fotos,
                inscimob: complemento.inscimob
            }
        });

        return NextResponse.json({ success: true, complemento });
    } catch (error) {
        console.error("Erro ao atualizar complemento:", error);
        return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
    }
}
