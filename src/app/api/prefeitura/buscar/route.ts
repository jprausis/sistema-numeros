import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireUser, AGENDA_ROLES } from "@/lib/auth";

export async function GET(req: NextRequest) {
    const { response } = await requireUser(AGENDA_ROLES);
    if (response) return response;

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim() || "";
        const bairroId = searchParams.get("bairroId")?.trim() || "";

        if (!query) {
            return NextResponse.json({ imoveis: [] });
        }

        const whereCondition: any = {
            OR: [
                { inscimob: { contains: query, mode: "insensitive" } },
                { numeroAInstalar: { contains: query, mode: "insensitive" } },
                { endereco: { contains: query, mode: "insensitive" } }
            ]
        };

        if (bairroId) {
            whereCondition.bairroId = bairroId;
        }

        const imoveis = await prisma.imovel.findMany({
            where: whereCondition,
            include: {
                bairro: { select: { id: true, nome: true, visivelInstalacao: true } },
                complementos: {
                    orderBy: { unidade: 'asc' }
                }
            },
            take: 40
        });

        // Ordenação inteligente: correspondência exata ou inicial na inscrição imobiliária primeiro
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
        console.error("Erro na busca de imóveis da prefeitura:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
