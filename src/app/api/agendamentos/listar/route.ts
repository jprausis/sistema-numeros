import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");

        const agendamentos = await prisma.agendamento.findMany({
            where: status ? { status } : {},
            orderBy: { dataHora: 'asc' }
        });

        return NextResponse.json({ agendamentos });
    } catch (error) {
        return NextResponse.json({ error: "Erro ao buscar agendamentos" }, { status: 500 });
    }
}
