import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, liberado, fotoLocalInstalacao, userId, userEmail } = body;

        if (!id) {
            return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
        }

        const complemento = await prisma.complemento.update({
            where: { id },
            data: {
                liberadoInstalacao: liberado,
                ...(fotoLocalInstalacao !== undefined && { fotoLocalInstalacao })
            }
        });

        // Registrar Log de Auditoria
        await createAuditLog({
            userId: userId || "sistema",
            userEmail: userEmail || "sistema@projemix.com.br",
            action: liberado ? "RELEASE_COMPLEMENTO" : "BLOCK_COMPLEMENTO",
            resource: "complemento",
            resourceId: id,
            details: {
                liberado,
                fotoLocalInstalacao,
                inscimob: complemento.inscimob
            }
        });

        return NextResponse.json({ success: true, complemento });
    } catch (error) {
        console.error("Erro ao liberar complemento:", error);
        return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
    }
}
