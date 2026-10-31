import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }

        const { id } = await params;
        // A malha (polígono do lote) só vai quando o mapa pede, com ?malha=1
        const comMalha = req.nextUrl.searchParams.get("malha") === "1";
        const imovel = await prisma.imovel.findUnique({
            where: { inscimob: id },
            omit: { malha: !comMalha },
            include: {
                bairro: { select: { nome: true } },
                complementos: {
                    orderBy: { unidade: 'asc' }
                }
            }
        });

        if (!imovel) {
            return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
        }

        return NextResponse.json({ imovel });
    } catch (error) {
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

