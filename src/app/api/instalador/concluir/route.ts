import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { concluirAgendamentosDoImovel } from "@/lib/agendamentos";

export async function PATCH(req: NextRequest) {
    try {
        const { inscimob, status, fotoUrl, fotoLocalInstalacao, obs, protocolo, usuarioAlt, userId, userEmail } = await req.json();

        if (!inscimob || !status) {
            return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
        }

        // 1. Atualizar o Imóvel
        const imovel = await prisma.imovel.update({
            where: { inscimob },
            data: {
                status: status, // Geralmente CONCLUIDO ou PENDENTE
                fotos: fotoUrl,
                ...(fotoLocalInstalacao !== undefined && { fotoLocalInstalacao }),
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
                    inscimobVinculo: inscimob,
                    ...(status === 'PENDENTE' ? { status: 'PENDENTE' } : {})
                }
            });
        }

        // 3. Imóvel concluído => concluir todos os agendamentos em aberto vinculados a ele
        if (imovel.status === 'CONCLUIDO') {
            await concluirAgendamentosDoImovel(inscimob);
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
                fotoLocalInstalacao,
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
