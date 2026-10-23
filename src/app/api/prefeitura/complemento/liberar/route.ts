import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireUser, getRequestMeta } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
    const { user, response } = await requireUser(["ADMIN", "OPERATOR", "PREFEITURA"]);
    if (response) return response;

    try {
        const body = await req.json();
        const { id, liberado, fotoLocalInstalacao } = body;

        if (!id || typeof liberado !== "boolean") {
            return NextResponse.json({ error: "ID e status de liberação são obrigatórios" }, { status: 400 });
        }

        const complemento = await prisma.complemento.update({
            where: { id },
            data: {
                liberadoInstalacao: liberado,
                // Só substitui a foto de orientação quando uma nova foi enviada
                ...(fotoLocalInstalacao !== undefined && { fotoLocalInstalacao })
            }
        });

        await createAuditLog({
            userId: user.id,
            userEmail: user.email || "sistema@projemix.com.br",
            action: liberado ? "RELEASE_COMPLEMENTO" : "BLOCK_COMPLEMENTO",
            resource: "complemento",
            resourceId: id,
            details: {
                liberado,
                fotoLocalInstalacao,
                inscimob: complemento.inscimob
            },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, complemento });
    } catch (error) {
        console.error("Erro ao liberar complemento:", error);
        return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
    }
}
