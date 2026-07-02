import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const hasAccess = user.role === 'ADMIN' || user.role === 'OPERATOR' || user.role === 'PREFEITURA';
    if (!hasAccess) {
        return NextResponse.json({ error: "Acesso negado. Apenas administradores, operadores ou prefeitura podem cadastrar imóveis." }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { inscimob, x, y, numeroAInstalar, bairroId, endereco } = body;

        if (!inscimob || !x || !y || !numeroAInstalar || !bairroId) {
            return NextResponse.json({ error: "Parâmetros obrigatórios ausentes (inscimob, x, y, numeroAInstalar, bairroId)." }, { status: 400 });
        }

        // Verificar se imóvel já existe
        const existing = await prisma.imovel.findUnique({
            where: { inscimob }
        });

        if (existing) {
            return NextResponse.json({ error: `Imóvel com INSCIMOB ${inscimob} já está cadastrado.` }, { status: 400 });
        }

        // Criar imóvel
        const imovel = await prisma.imovel.create({
            data: {
                inscimob: String(inscimob).trim(),
                x: parseFloat(x),
                y: parseFloat(y),
                numeroAInstalar: String(numeroAInstalar).trim(),
                bairroId,
                endereco: endereco ? String(endereco).trim() : null,
                status: "NAO_INICIADO"
            }
        });

        // Registrar Log de Auditoria
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                userEmail: user.email || 'desconhecido',
                action: "CREATE_IMOVEL",
                resource: "imovel",
                resourceId: imovel.inscimob,
                details: {
                    after: imovel
                },
                ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
                userAgent: req.headers.get('user-agent')
            }
        });

        return NextResponse.json({ success: true, imovel });
    } catch (error) {
        console.error("Erro ao cadastrar imóvel:", error);
        return NextResponse.json({ error: "Erro interno ao cadastrar imóvel" }, { status: 500 });
    }
}
