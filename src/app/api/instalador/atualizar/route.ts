import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { inscimob, status, obsPendente, fotos, instaladorResp, userEmail, userId } = body;

        if (!inscimob || !status) {
            return NextResponse.json({ error: "Inscimob e Status são obrigatórios" }, { status: 400 });
        }

        const imovel = await prisma.imovel.update({
            where: { inscimob },
            data: {
                status,
                obsPendente: status === "PENDENTE" ? obsPendente : null,
                fotos: fotos ? JSON.stringify(fotos) : undefined,
                dataExecucao: new Date(),
                instaladorResp: instaladorResp || "Instalador Padrão"
            }
        });

        // Registrar Log de Auditoria
        await createAuditLog({
            userId: userId || "sistema",
            userEmail: userEmail || "sistema@projemix.com.br",
            action: "UPDATE_IMOVEL",
            resource: "imovel",
            resourceId: inscimob,
            details: {
                status,
                obsPendente,
                fotos
            }
        });

        return NextResponse.json({ success: true, imovel });
    } catch (error) {
        console.error("Erro ao atualizar imóvel:", error);
        return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
    }
}
