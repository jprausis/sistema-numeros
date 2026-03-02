import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const bairros = await prisma.bairro.findMany({
            include: {
                _count: {
                    select: { imoveis: true }
                }
            },
            orderBy: { dataImportacao: 'desc' }
        });

        return NextResponse.json({ bairros });
    } catch (error) {
        return NextResponse.json({ error: "Erro ao listar bairros" }, { status: 500 });
    }
}
