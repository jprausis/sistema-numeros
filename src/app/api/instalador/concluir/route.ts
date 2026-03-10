import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(req: NextRequest) {
    try {
        const { inscimob, status, fotoUrl, obs, protocolo, usuarioAlt, userId, userEmail } = await req.json();

        if (!inscimob || !status) {
            return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
        }

        // 1. Atualizar o Imóvel
        const imovel = await prisma.imovel.update({
            where: { inscimob },
            data: {
                status: status, // Geralmente CONCLUIDO ou PENDENTE
                fotos: fotoUrl,
                obsPendente: obs,
                usuarioAlt: usuarioAlt,
                dataExecucao: new Date(),
            }
        });

        // 2. Se houver um protocolo, atualizar o agendamento
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
            action: `CONCLUIR_IMOVEL_${status}`,
            resource: "imovel",
            resourceId: inscimob,
            details: {
                status,
                fotoUrl,
                obs,
                protocolo,
                usuarioAlt
            }
        });

        return NextResponse.json({ success: true, imovel });
    } catch (error: any) {
        console.error("Erro ao concluir instalação:", error);
        return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
    }
}
