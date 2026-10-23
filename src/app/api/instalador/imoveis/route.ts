import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }

        const imoveis = await prisma.imovel.findMany({
            where: {
                bairro: {
                    visivelInstalacao: true
                }
            },
            include: {
                bairro: { select: { nome: true, visivelInstalacao: true } },
                complementos: true
            }
        });

        return NextResponse.json({ imoveis });
    } catch (error) {
        console.error("Erro ao listar imóveis:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

