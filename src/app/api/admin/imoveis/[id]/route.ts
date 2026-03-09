import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { restrictToAdmin, getSessionUser } from "@/lib/auth";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await req.json();
    const { status, fotos, obsPendente, instaladorResp, usuarioAlt } = body;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // Restrição para OPERATOR: não pode editar imóveis
    if (user.role === 'OPERATOR') {
        return NextResponse.json({ error: "Operadores não podem editar imóveis diretamente." }, { status: 403 });
    }

    try {
        // Buscar estado anterior para o log
        const oldImovel = await prisma.imovel.findUnique({ where: { inscimob: id } });

        const updateData: any = {
            status,
            fotos,
            obsPendente,
            usuarioAlt: user.email // Garante que registramos quem alterou
        };

        if (status === 'CONCLUIDO' || status === 'PENDENTE') {
            updateData.dataExecucao = new Date();
            if (instaladorResp) updateData.instaladorResp = instaladorResp;
        }

        const imovel = await prisma.imovel.update({
            where: { inscimob: id },
            data: updateData
        });

        // Registrar Log de Auditoria
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                userEmail: user.email || 'desconhecido',
                action: "UPDATE_IMOVEL",
                resource: "imovel",
                resourceId: id,
                details: {
                    before: oldImovel,
                    after: imovel,
                    source: body
                },
                ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
                userAgent: req.headers.get('user-agent')
            }
        });

        return NextResponse.json({ success: true, imovel });
    } catch (error) {
        console.error("Erro ao atualizar imóvel:", error);
        return NextResponse.json({ error: "Erro ao atualizar imóvel" }, { status: 500 });
    }
}

