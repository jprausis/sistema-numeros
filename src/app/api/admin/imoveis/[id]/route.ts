import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, getRequestMeta } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { concluirAgendamentosDoImovel } from "@/lib/agendamentos";
import { movimentarEstoqueSeguro } from "@/lib/estoque";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, response } = await requireUser(["ADMIN", "OPERATOR", "PREFEITURA"]);
    if (response) return response;

    const { id } = await params;
    const body = await req.json();
    const { status, fotos, obsPendente, instaladorResp, numeroAInstalar } = body;

    // OPERATOR e PREFEITURA: permite apenas alteração do número do imóvel (numeroAInstalar)
    if (user.role !== 'ADMIN') {
        if (status !== undefined || fotos !== undefined || obsPendente !== undefined || instaladorResp !== undefined) {
            return NextResponse.json({ error: "Seu perfil não pode editar status, fotos ou observações diretamente." }, { status: 403 });
        }
        if (numeroAInstalar === undefined) {
            return NextResponse.json({ error: "Nenhum dado editável enviado." }, { status: 400 });
        }
    }

    try {
        // Buscar estado anterior para o log
        const oldImovel = await prisma.imovel.findUnique({ where: { inscimob: id } });
        if (!oldImovel) {
            return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
        }

        const updateData: any = {
            usuarioAlt: user.email // Garante que registramos quem alterou
        };
        if (status !== undefined) updateData.status = status;
        if (fotos !== undefined) updateData.fotos = fotos;
        if (obsPendente !== undefined) updateData.obsPendente = obsPendente ? String(obsPendente).trim() || null : null;

        if (numeroAInstalar !== undefined) {
            const numero = String(numeroAInstalar).trim();
            if (!numero) {
                return NextResponse.json({ error: "O número do imóvel não pode ficar vazio." }, { status: 400 });
            }
            updateData.numeroAInstalar = numero;
        }

        if ((status === 'CONCLUIDO' || status === 'PENDENTE') && status !== oldImovel.status) {
            updateData.dataExecucao = new Date();
            if (instaladorResp) updateData.instaladorResp = instaladorResp;
        }

        const imovel = await prisma.imovel.update({
            where: { inscimob: id },
            data: updateData
        });

        await movimentarEstoqueSeguro(prisma, {
            numero: imovel.numeroAInstalar,
            statusAnterior: oldImovel.status,
            statusNovo: imovel.status,
            referencia: id,
            descricao: `imóvel Nº ${imovel.numeroAInstalar} (${id}) - alterado no painel`,
            userEmail: user.email,
        });

        if (imovel.status === 'CONCLUIDO') {
            await concluirAgendamentosDoImovel(id);
        }

        await createAuditLog({
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
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, imovel });
    } catch (error) {
        console.error("Erro ao atualizar imóvel:", error);
        return NextResponse.json({ error: "Erro ao atualizar imóvel" }, { status: 500 });
    }
}
