import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { status, fotos, obsPendente, instaladorResp } = await req.json();

    try {
        const updateData: any = {
            status,
            fotos,
            obsPendente
        };

        if (status === 'CONCLUIDO' || status === 'PENDENTE') {
            updateData.dataExecucao = new Date();
            if (instaladorResp) updateData.instaladorResp = instaladorResp;
        }

        const imovel = await prisma.imovel.update({
            where: { inscimob: id },
            data: updateData
        });

        return NextResponse.json({ success: true, imovel });
    } catch (error) {
        console.error("Erro ao atualizar imóvel:", error);
        return NextResponse.json({ error: "Erro ao atualizar imóvel" }, { status: 500 });
    }
}
