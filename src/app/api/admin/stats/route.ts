import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const totalImoveis = await prisma.imovel.count();
        const concluidos = await prisma.imovel.count({ where: { status: "CONCLUIDO" } });
        const liberados = await prisma.imovel.count({ where: { status: "LIBERADO" } });
        const ausentes = await prisma.imovel.count({ where: { status: "AUSENTE" } });
        const pendentes = await prisma.imovel.count({ where: { status: "PENDENTE" } });

        const totalComplementos = await prisma.complemento.count();
        const complementosLiberados = await prisma.complemento.count({ where: { liberadoInstalacao: true } });

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

        const agendamentosPendentes = await prisma.agendamento.count({ where: { status: "PENDENTE" } });

        const imoveisData = await prisma.imovel.findMany({
            select: { numeroAInstalar: true, status: true }
        });

        let totalDigitos = 0;
        let digitosInstalados = 0;
        let totalAlgarismosLiberados = 0;
        const faltantesPorDigito: Record<string, number> = {
            "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0
        };

        const liberadosPorDigito: Record<string, number> = {
            "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0
        };

        imoveisData.forEach(im => {
            const numStr = im.numeroAInstalar || "";
            const len = numStr.length;
            totalDigitos += len;

            if (im.status === "CONCLUIDO") {
                digitosInstalados += len;
            } else {
                // Se não está concluído, contamos os caracteres para a produção geral
                for (const char of numStr) {
                    if (faltantesPorDigito[char] !== undefined) {
                        faltantesPorDigito[char]++;
                    }
                }

                // Se está liberado, contamos especificamente para os liberados
                if (im.status === "LIBERADO") {
                    totalAlgarismosLiberados += len;
                    for (const char of numStr) {
                        if (liberadosPorDigito[char] !== undefined) {
                            liberadosPorDigito[char]++;
                        }
                    }
                }
            }
        });

        return NextResponse.json({
            totalImoveis,
            concluidos,
            liberados,
            ausentes,
            pendentes,
            totalComplementos,
            complementosLiberados,
            agendamentosHoje,
            agendamentosSemana,
            agendamentosPendentes,
            totalAlgarismosLiberados,
            digitos: {
                totalNecessario: totalDigitos,
                totalInstalado: digitosInstalados,
                faltantesPorDigito,
                liberadosPorDigito
            }
        });
    } catch (error) {
        return NextResponse.json({ error: "Erro ao carregar estatísticas" }, { status: 500 });
    }
}
