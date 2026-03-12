import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { inscimob, status, obsPendente, fotos, instaladorResp, userEmail, userId, complementosData } = body;

        if (!inscimob || !status) {
            return NextResponse.json({ error: "Inscimob e Status são obrigatórios" }, { status: 400 });
        }

        // 1. Atualizar o imóvel principal
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

        // 2. Atualizar os complementos (se enviados no lote)
        if (complementosData && Array.isArray(complementosData) && complementosData.length > 0) {
            for (const comp of complementosData) {
                if (comp.id && comp.status) {
                    await prisma.complemento.update({
                        where: { id: comp.id },
                        data: {
                            status: comp.status,
                            fotos: comp.fotos && comp.fotos.length > 0 ? JSON.stringify(comp.fotos) : undefined,
                            dataExecucao: (comp.status === "CONCLUIDO" || comp.status === "PENDENTE") ? new Date() : undefined
                        }
                    });
                }
            }
        }

        // 3. Vincular Agendamento se protocolo existir
        const { protocolo } = body;
        if (protocolo) {
            await prisma.agendamento.update({
                where: { protocolo },
                data: {
                    status: 'CONCLUIDO',
                    inscimobVinculo: inscimob
                }
            });
        }

        // Registrar Log de Auditoria
        await createAuditLog({
            userId: userId || "sistema",
            userEmail: userEmail || "sistema@projemix.com.br",
            action: "UPDATE_IMOVEL_LOTE",
            resource: "imovel",
            resourceId: inscimob,
            details: {
                status,
                obsPendente,
                fotos,
                complementosData
            }
        });

        return NextResponse.json({ success: true, imovel });
    } catch (error) {
        console.error("Erro ao atualizar imóvel e complementos:", error);
        return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
    }
}
