import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const totalImoveis = await prisma.imovel.count();
        const concluidos = await prisma.imovel.count({ where: { status: "CONCLUIDO" } });
        const pendentes = await prisma.imovel.count({ where: { status: "PENDENTE" } });

        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);

        const agendamentosHoje = await prisma.agendamento.count({
            where: {
                dataHora: { gte: todayStart, lte: todayEnd }
            }
        });

        const agendamentosSemana = await prisma.agendamento.count({
            where: {
                dataHora: { gte: startOfWeek(now), lte: endOfWeek(now) }
            }
        });

        return NextResponse.json({
            totalImoveis,
            concluidos,
            pendentes,
            agendamentosHoje,
            agendamentosSemana
        });
    } catch (error) {
        return NextResponse.json({ error: "Erro ao carregar estatísticas" }, { status: 500 });
    }
}
