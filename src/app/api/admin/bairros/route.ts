import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, STAFF_ROLES } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    // Leitura também liberada para o Painel Prefeitura
    const { response } = await requireUser([...STAFF_ROLES, "PAINEL_PREFEITURA"]);
    if (response) return response;

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
        console.error("Erro ao listar bairros:", error);
        return NextResponse.json({ error: "Erro ao listar bairros" }, { status: 500 });
    }
}
