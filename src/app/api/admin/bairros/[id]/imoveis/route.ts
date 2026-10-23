import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, STAFF_ROLES } from "@/lib/auth";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { response } = await requireUser(STAFF_ROLES);
    if (response) return response;

    const { id } = await params;

    try {
        const [bairro, imoveis] = await Promise.all([
            prisma.bairro.findUnique({ where: { id }, select: { id: true, nome: true } }),
            prisma.imovel.findMany({
                where: { bairroId: id },
                select: {
                    inscimob: true,
                    numeroAInstalar: true,
                    endereco: true,
                    status: true,
                    dataExecucao: true,
                    instaladorResp: true,
                    _count: { select: { complementos: true } }
                },
                orderBy: { numeroAInstalar: 'asc' }
            })
        ]);

        if (!bairro) {
            return NextResponse.json({ error: "Bairro não encontrado" }, { status: 404 });
        }

        return NextResponse.json({ bairro, imoveis });
    } catch (error) {
        console.error("Erro ao buscar imóveis do bairro:", error);
        return NextResponse.json({ error: "Erro ao buscar imóveis" }, { status: 500 });
    }
}
