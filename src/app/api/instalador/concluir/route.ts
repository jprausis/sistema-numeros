import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireUser, getRequestMeta } from "@/lib/auth";
import { concluirAgendamentosDoImovel } from "@/lib/agendamentos";
import { movimentarEstoqueSeguro } from "@/lib/estoque";

const STATUS_PERMITIDOS = ["NAO_INICIADO", "LIBERADO", "AUSENTE", "PENDENTE", "CONCLUIDO"];

// Usado pela tela da Prefeitura para Liberar / Marcar Ausente / Resetar um imóvel.
// Campos omitidos (undefined) não são alterados — evita apagar fotos e observações existentes.
export async function PATCH(req: NextRequest) {
    const { user, response } = await requireUser(["ADMIN", "OPERATOR", "PREFEITURA"]);
    if (response) return response;

    try {
        const { inscimob, status, fotoUrl, fotoLocalInstalacao, obs, protocolo } = await req.json();

        if (!inscimob || !status) {
            return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
        }
        if (!STATUS_PERMITIDOS.includes(status)) {
            return NextResponse.json({ error: "Status inválido" }, { status: 400 });
        }

        const atual = await prisma.imovel.findUnique({ where: { inscimob } });
        if (!atual) {
            return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
        }

        const usuarioAlt = `${user.role === "PREFEITURA" ? "Prefeitura" : user.role}: ${user.name || user.email}`;

        const imovel = await prisma.imovel.update({
            where: { inscimob },
            data: {
                status,
                usuarioAlt,
                ...(fotoUrl !== undefined && { fotos: fotoUrl }),
                ...(fotoLocalInstalacao !== undefined && { fotoLocalInstalacao }),
                ...(obs !== undefined && { obsPendente: obs }),
                ...(status !== atual.status && { dataExecucao: new Date() }),
            }
        });

        if (protocolo) {
            await prisma.agendamento.updateMany({
                where: { protocolo },
                data: {
                    inscimobVinculo: inscimob,
                    ...(status === 'PENDENTE' ? { status: 'PENDENTE' } : {})
                }
            });
        }

        await movimentarEstoqueSeguro(prisma, {
            numero: imovel.numeroAInstalar,
            statusAnterior: atual.status,
            statusNovo: imovel.status,
            referencia: inscimob,
            descricao: `imóvel Nº ${imovel.numeroAInstalar} (${inscimob})`,
            userEmail: user.email,
        });

        // Imóvel concluído => concluir todos os agendamentos em aberto vinculados a ele
        if (imovel.status === 'CONCLUIDO') {
            await concluirAgendamentosDoImovel(inscimob);
        }

        await createAuditLog({
            userId: user.id,
            userEmail: user.email || "sistema@projemix.com.br",
            action: `CONCLUIR_IMOVEL_${status}`,
            resource: "imovel",
            resourceId: inscimob,
            details: {
                status,
                statusAnterior: atual.status,
                fotoUrl,
                fotoLocalInstalacao,
                obs,
                protocolo
            },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, imovel });
    } catch (error: any) {
        console.error("Erro ao concluir instalação:", error);
        return NextResponse.json({ error: "Erro interno ao atualizar o imóvel" }, { status: 500 });
    }
}
