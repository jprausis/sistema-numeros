import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const bairroId = searchParams.get("bairroId") || undefined;

        const whereImovel = bairroId ? { bairroId } : {};
        const whereComplemento = bairroId ? { imovel: { bairroId } } : {};

        const totalImoveis = await prisma.imovel.count({ where: whereImovel });
        const concluidos = await prisma.imovel.count({ where: { ...whereImovel, status: "CONCLUIDO" } });
        const liberados = await prisma.imovel.count({ where: { ...whereImovel, status: "LIBERADO" } });
        const ausentes = await prisma.imovel.count({ where: { ...whereImovel, status: "AUSENTE" } });
        const pendentes = await prisma.imovel.count({ where: { ...whereImovel, status: "PENDENTE" } });

        const totalComplementos = await prisma.complemento.count({ where: whereComplemento });
        const complementosLiberados = await prisma.complemento.count({ where: { ...whereComplemento, liberadoInstalacao: true } });

        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);

        // Para agendamentos, se houver filtro por bairro, precisamos de uma lógica mais complexa
        // pois a relação não é formal no banco (inscimobVinculo -> imovel.inscimob)
        let whereAgendamento: any = {
            dataHora: { gte: todayStart, lte: todayEnd }
        };

        let whereAgendamentoSemana: any = {
            dataHora: { gte: startOfWeek(now), lte: endOfWeek(now) }
        };

        let whereAgendamentoPendente: any = { status: "PENDENTE" };

        if (bairroId) {
            const imoveisNoBairro = await prisma.imovel.findMany({
                where: { bairroId },
                select: { inscimob: true }
            });
            const inscimobs = imoveisNoBairro.map(i => i.inscimob);
            
            whereAgendamento.inscimobVinculo = { in: inscimobs };
            whereAgendamentoSemana.inscimobVinculo = { in: inscimobs };
            whereAgendamentoPendente.inscimobVinculo = { in: inscimobs };
        }

        const agendamentosHoje = await prisma.agendamento.count({ where: whereAgendamento });
        const agendamentosSemana = await prisma.agendamento.count({ where: whereAgendamentoSemana });
        const agendamentosPendentes = await prisma.agendamento.count({ where: whereAgendamentoPendente });

        const imoveisData = await prisma.imovel.findMany({
            where: whereImovel,
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
        console.error("Erro ao carregar estatísticas:", error);
        return NextResponse.json({ error: "Erro ao carregar estatísticas" }, { status: 500 });
    }
}
