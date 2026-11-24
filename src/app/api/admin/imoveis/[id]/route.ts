import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, getRequestMeta } from "@/lib/auth";
import { createAuditLog, diffCampos } from "@/lib/audit";
import { concluirAgendamentosDoImovel } from "@/lib/agendamentos";
import { movimentarEstoqueSeguro } from "@/lib/estoque";

// Campos que o Painel Prefeitura pode mudar: o número em qualquer imóvel; os dados de cadastro só nos que ele cadastrou
const CAMPOS_CADASTRO = ["endereco", "x", "y", "bairroId"] as const;
const CAMPOS_AUDITADOS = ["numeroAInstalar", "endereco", "x", "y", "bairroId", "status", "obsPendente", "fotos"];

/** O imóvel foi cadastrado por este usuário? (o cadastro fica registrado na auditoria) */
async function cadastradoPor(userId: string, inscimob: string) {
    const log = await prisma.auditLog.findFirst({
        where: { action: "CREATE_IMOVEL", resource: "imovel", resourceId: inscimob, userId },
        select: { id: true }
    });
    return !!log;
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, response } = await requireUser(["ADMIN", "OPERATOR", "PREFEITURA", "PAINEL_PREFEITURA"]);
    if (response) return response;

    const { id } = await params;
    const body = await req.json();
    const { status, fotos, obsPendente, instaladorResp, numeroAInstalar, endereco, x, y, bairroId } = body;
    const mudaCadastro = CAMPOS_CADASTRO.some(c => body[c] !== undefined);

    // OPERATOR, PREFEITURA e PAINEL_PREFEITURA: número do imóvel; o Painel Prefeitura também
    // corrige endereço, bairro e coordenadas dos imóveis que ele mesmo cadastrou
    if (user.role !== 'ADMIN') {
        if (status !== undefined || fotos !== undefined || obsPendente !== undefined || instaladorResp !== undefined) {
            return NextResponse.json({ error: "Seu perfil não pode editar status, fotos ou observações diretamente." }, { status: 403 });
        }
        if (mudaCadastro) {
            if (user.role !== 'PAINEL_PREFEITURA' || !(await cadastradoPor(user.id, id))) {
                return NextResponse.json({ error: "Endereço, bairro e coordenadas só podem ser alterados nos imóveis que você cadastrou." }, { status: 403 });
            }
        }
        if (numeroAInstalar === undefined && !mudaCadastro) {
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

        if (endereco !== undefined) updateData.endereco = endereco ? String(endereco).trim() || null : null;
        if (x !== undefined || y !== undefined) {
            const xNum = parseFloat(x ?? oldImovel.x);
            const yNum = parseFloat(y ?? oldImovel.y);
            if (isNaN(xNum) || isNaN(yNum)) {
                return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
            }
            updateData.x = xNum;
            updateData.y = yNum;
        }
        const trocaBairro = bairroId !== undefined && bairroId !== oldImovel.bairroId;
        if (trocaBairro) {
            const bairro = await prisma.bairro.findUnique({ where: { id: String(bairroId) }, select: { id: true } });
            if (!bairro) return NextResponse.json({ error: "Bairro não encontrado." }, { status: 400 });
            updateData.bairroId = bairro.id;
        }

        if ((status === 'CONCLUIDO' || status === 'PENDENTE') && status !== oldImovel.status) {
            updateData.dataExecucao = new Date();
            if (instaladorResp) updateData.instaladorResp = instaladorResp;
        }

        const imovel = await prisma.$transaction(async (tx) => {
            const atualizado = await tx.imovel.update({
                where: { inscimob: id },
                data: updateData
            });
            // Mantém o contador dos bairros coerente com a base
            if (trocaBairro) {
                await tx.bairro.update({ where: { id: oldImovel.bairroId }, data: { totalImoveis: { decrement: 1 } } });
                await tx.bairro.update({ where: { id: atualizado.bairroId }, data: { totalImoveis: { increment: 1 } } });
            }
            return atualizado;
        });

        await movimentarEstoqueSeguro(prisma, {
            numero: imovel.numeroAInstalar,
            numeroAnterior: oldImovel.numeroAInstalar,
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
                source: body,
                alteracoes: await alteracoesLegiveis(oldImovel, imovel)
            },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, imovel });
    } catch (error) {
        console.error("Erro ao atualizar imóvel:", error);
        return NextResponse.json({ error: "Erro ao atualizar imóvel" }, { status: 500 });
    }
}

/** Diferenças para o histórico, com o nome do bairro no lugar do id. */
async function alteracoesLegiveis(antes: Record<string, any>, depois: Record<string, any>) {
    const alteracoes = diffCampos(antes, depois, CAMPOS_AUDITADOS);
    const bairro = alteracoes.find(a => a.campo === "bairroId");
    if (bairro) {
        const nomes = await prisma.bairro.findMany({
            where: { id: { in: [bairro.antes, bairro.depois].filter(Boolean) } },
            select: { id: true, nome: true }
        });
        const nome = (bid: string | null) => nomes.find(b => b.id === bid)?.nome ?? bid;
        Object.assign(bairro, { campo: "bairro", antes: nome(bairro.antes), depois: nome(bairro.depois) });
    }
    return alteracoes;
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, response } = await requireUser(["ADMIN", "PAINEL_PREFEITURA"]);
    if (response) return response;

    const { id } = await params;

    try {
        const imovel = await prisma.imovel.findUnique({
            where: { inscimob: id },
            include: { complementos: true, bairro: { select: { nome: true } } }
        });
        if (!imovel) {
            return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
        }

        // Painel Prefeitura só exclui o que ele mesmo cadastrou
        if (user.role !== 'ADMIN' && !(await cadastradoPor(user.id, id))) {
            return NextResponse.json({ error: "Você só pode excluir imóveis que você cadastrou." }, { status: 403 });
        }

        // Imóvel já trabalhado em campo fica: excluir apagaria histórico de instalação e estoque
        if (imovel.status !== 'NAO_INICIADO' || imovel.complementos.length > 0) {
            return NextResponse.json({ error: "Só é possível excluir imóveis ainda não iniciados e sem complementos." }, { status: 400 });
        }
        const agendamentos = await prisma.agendamento.count({ where: { inscimobVinculo: id } });
        if (agendamentos > 0) {
            return NextResponse.json({ error: "Este imóvel tem agendamento vinculado. Remova o vínculo antes de excluir." }, { status: 400 });
        }

        await prisma.$transaction([
            prisma.imovel.delete({ where: { inscimob: id } }),
            prisma.bairro.update({ where: { id: imovel.bairroId }, data: { totalImoveis: { decrement: 1 } } })
        ]);

        await createAuditLog({
            userId: user.id,
            userEmail: user.email || 'desconhecido',
            action: "DELETE_IMOVEL",
            resource: "imovel",
            resourceId: id,
            details: { before: imovel },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao excluir imóvel:", error);
        return NextResponse.json({ error: "Erro ao excluir imóvel" }, { status: 500 });
    }
}
