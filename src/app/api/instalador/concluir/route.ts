import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
    try {
        const { inscimob, status, fotoUrl, obs, protocolo, usuarioAlt } = await req.json();

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

        return NextResponse.json({ success: true, imovel });
    } catch (error: any) {
        console.error("Erro ao concluir instalação:", error);
        return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
    }
}
