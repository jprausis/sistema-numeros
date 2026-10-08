import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { splitBrazilDate } from "@/lib/timezone";

export async function GET(req: NextRequest) {
    try {
        let dbUser = await getSessionUser();
        if (!dbUser) {
            const supabase = await createClient();
            const { data: { user: sbUser } } = await supabase.auth.getUser();
            if (!sbUser) {
                return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
            }
        }

        const { searchParams } = new URL(req.url);
        const inscimob = searchParams.get("inscimob")?.trim();
        const protocolo = searchParams.get("protocolo")?.trim();

        if (!inscimob && !protocolo) {
            return NextResponse.json({ error: "Informe inscimob ou protocolo." }, { status: 400 });
        }

        const whereCondition: any = {};
        if (protocolo) {
            whereCondition.protocolo = protocolo;
        } else if (inscimob) {
            whereCondition.inscimobVinculo = inscimob;
            whereCondition.status = { not: "CANCELADO" };
        }

        const agendamento = await prisma.agendamento.findFirst({
            where: whereCondition,
            orderBy: { createdAt: "desc" }
        });

        if (!agendamento) {
            return NextResponse.json({ agendamento: null });
        }

        let dataStr = "";
        let horarioStr = "09:00";

        if (agendamento.dataHora) {
            const { data, horario } = splitBrazilDate(new Date(agendamento.dataHora));
            dataStr = data;
            horarioStr = horario;
        }

        // Buscar dados do imóvel para observação
        const imovel = agendamento.inscimobVinculo
            ? await prisma.imovel.findUnique({
                where: { inscimob: agendamento.inscimobVinculo },
                select: { obsPendente: true }
            })
            : null;

        return NextResponse.json({
            agendamento: {
                ...agendamento,
                data: dataStr,
                horario: horarioStr,
                observacao: imovel?.obsPendente || ""
            }
        });
    } catch (error: any) {
        console.error("Erro ao buscar dados do agendamento:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
