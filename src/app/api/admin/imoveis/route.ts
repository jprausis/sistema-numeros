import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, getRequestMeta, STAFF_ROLES } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const { user, response } = await requireUser(STAFF_ROLES);
    if (response) return response;

    try {
        const body = await req.json();
        const { x, y, numeroAInstalar, bairroId, endereco } = body;
        const inscimob = String(body.inscimob || "").trim();
        const xNum = parseFloat(x);
        const yNum = parseFloat(y);

        if (!inscimob || !numeroAInstalar || !bairroId || isNaN(xNum) || isNaN(yNum)) {
            return NextResponse.json({ error: "Parâmetros obrigatórios ausentes ou inválidos (inscimob, x, y, numeroAInstalar, bairroId)." }, { status: 400 });
        }

        // Verificar se imóvel já existe
        const existing = await prisma.imovel.findUnique({
            where: { inscimob }
        });

        if (existing) {
            return NextResponse.json({ error: `Imóvel com INSCIMOB ${inscimob} já está cadastrado.` }, { status: 400 });
        }

        const imovel = await prisma.$transaction(async (tx) => {
            const created = await tx.imovel.create({
                data: {
                    inscimob,
                    x: xNum,
                    y: yNum,
                    numeroAInstalar: String(numeroAInstalar).trim(),
                    bairroId,
                    endereco: endereco ? String(endereco).trim() : null,
                    status: "NAO_INICIADO",
                    usuarioAlt: user.email
                }
            });
            // Mantém o contador do bairro coerente com a base
            await tx.bairro.update({
                where: { id: bairroId },
                data: { totalImoveis: { increment: 1 } }
            });
            return created;
        });

        await createAuditLog({
            userId: user.id,
            userEmail: user.email || 'desconhecido',
            action: "CREATE_IMOVEL",
            resource: "imovel",
            resourceId: imovel.inscimob,
            details: { after: imovel },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, imovel });
    } catch (error) {
        console.error("Erro ao cadastrar imóvel:", error);
        return NextResponse.json({ error: "Erro interno ao cadastrar imóvel" }, { status: 500 });
    }
}

export async function GET() {
    const { response } = await requireUser(STAFF_ROLES);
    if (response) return response;

    try {
        const imoveis = await prisma.imovel.findMany({
            include: {
                bairro: { select: { nome: true } },
                complementos: { orderBy: { unidade: 'asc' } }
            }
        });
        return NextResponse.json({ imoveis });
    } catch (error) {
        console.error("Erro ao listar imóveis para administração:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
