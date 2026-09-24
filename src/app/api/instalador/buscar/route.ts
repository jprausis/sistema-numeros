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

        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim() || "";

        if (!query) {
            return NextResponse.json({ imoveis: [] });
        }

        const imoveis = await prisma.imovel.findMany({
            where: {
                OR: [
                    { inscimob: { contains: query, mode: "insensitive" } },
                    { numeroAInstalar: { contains: query, mode: "insensitive" } },
                    { endereco: { contains: query, mode: "insensitive" } }
                ]
            },
            include: {
                bairro: { select: { nome: true, visivelInstalacao: true } },
                complementos: {
                    orderBy: { unidade: 'asc' }
                }
            },
            take: 40
        });

        // Ordenar dando prioridade para quem tem inscrição exatamente igual ou iniciando com o termo
        const qLower = query.toLowerCase();
        imoveis.sort((a, b) => {
            const aInsc = a.inscimob.toLowerCase();
            const bInsc = b.inscimob.toLowerCase();

            if (aInsc === qLower) return -1;
            if (bInsc === qLower) return 1;
            if (aInsc.startsWith(qLower) && !bInsc.startsWith(qLower)) return -1;
            if (!aInsc.startsWith(qLower) && bInsc.startsWith(qLower)) return 1;
            return aInsc.localeCompare(bInsc);
        });

        return NextResponse.json({ imoveis });
    } catch (error) {
        console.error("Erro na busca de imóveis:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
