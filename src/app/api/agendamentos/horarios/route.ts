import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, AGENDA_ROLES } from "@/lib/auth";
import { WHERE_AGENDAMENTO_OFICIAL } from "@/lib/agendamentos";
import { brazilDayRange, splitBrazilDate } from "@/lib/timezone";

export const dynamic = "force-dynamic";

// Horários já ocupados em um dia (YYYY-MM-DD), para travar a escolha nos formulários.
export async function GET(req: NextRequest) {
    const { response } = await requireUser(AGENDA_ROLES);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const range = brazilDayRange(searchParams.get("data") || "");
    if (!range) {
        return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }
    const ignorar = searchParams.get("ignorar")?.trim();

    try {
        const ocupados = await prisma.agendamento.findMany({
            where: {
                AND: [WHERE_AGENDAMENTO_OFICIAL],
                dataHora: range,
                status: { notIn: ["CONCLUIDO", "CANCELADO"] },
                ...(ignorar ? { NOT: { protocolo: ignorar } } : {})
            },
            select: { protocolo: true, dataHora: true, inscimobVinculo: true },
            orderBy: { dataHora: "asc" }
        });

        return NextResponse.json({
            ocupados: ocupados.map(a => ({
                protocolo: a.protocolo,
                inscimob: a.inscimobVinculo,
                horario: splitBrazilDate(new Date(a.dataHora!)).horario
            }))
        });
    } catch (error) {
        console.error("Erro ao listar horários ocupados:", error);
        return NextResponse.json({ error: "Erro ao buscar horários" }, { status: 500 });
    }
}
