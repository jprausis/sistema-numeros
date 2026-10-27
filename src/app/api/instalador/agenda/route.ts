import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { sincronizarAgendamentosConcluidos } from "@/lib/agendamentos";
import { brazilDayRange, todayBrazil } from "@/lib/timezone";

export async function GET(req: NextRequest) {
    const { response } = await requireUser();
    if (response) return response;

    try {
        const { searchParams } = new URL(req.url);
        const filter = searchParams.get("filter") || "proximos"; // 'proximos' | 'hoje' | 'atrasados' | 'todos' | 'concluidos'
        // Dia específico (YYYY-MM-DD, horário de Brasília), combinável com qualquer aba
        const dia = searchParams.get("data");
        const diaRange = dia ? brazilDayRange(dia) : null;

        // Garante que agendamentos de imóveis já concluídos sejam marcados como CONCLUIDO
        await sincronizarAgendamentosConcluidos();

        // Condição de status no banco
        // Concluídos aparecem SOMENTE na aba 'concluidos'
        let statusCondition: any = {};
        if (filter === "concluidos") {
            statusCondition = { status: "CONCLUIDO" };
        } else {
            // 'proximos', 'hoje' e 'todos' pegam agendamentos que ainda precisam ser executados
            statusCondition = { status: { notIn: ["CONCLUIDO", "CANCELADO"] } };
        }

        const agendamentos = await prisma.agendamento.findMany({
            where: {
                ...statusCondition,
                protocolo: { startsWith: "PREF-" },
                inscimobVinculo: { not: null }
            },
            orderBy: [
                { dataHora: "asc" },
                { createdAt: "asc" }
            ]
        });

        // Buscar todos os imóveis vinculados
        const inscimobs = Array.from(new Set(agendamentos.map(a => a.inscimobVinculo).filter(Boolean))) as string[];
        const imoveis = await prisma.imovel.findMany({
            where: { inscimob: { in: inscimobs } },
            include: {
                bairro: { select: { id: true, nome: true, visivelInstalacao: true } },
                complementos: {
                    orderBy: { unidade: 'asc' }
                }
            }
        });
        const imovelMap = new Map(imoveis.map(i => [i.inscimob, i]));

        // "Hoje" no horário de Brasília (o servidor roda em UTC)
        const now = new Date();
        const { gte: startOfToday, lte: endOfToday } = brazilDayRange(todayBrazil())!;

        // Enriquecer os agendamentos com os dados completos do imóvel e flags
        const enriched = agendamentos.map(ag => {
            const imovel = ag.inscimobVinculo ? imovelMap.get(ag.inscimobVinculo) || null : null;
            const itemDate = ag.dataHora ? new Date(ag.dataHora) : null;
            const isHoje = itemDate ? (itemDate >= startOfToday && itemDate <= endOfToday) : false;
            const isAtrasado = itemDate && ag.status !== "CONCLUIDO" ? (itemDate < now) : false;

            return {
                ...ag,
                imovel,
                isHoje,
                isAtrasado
            };
        });

        // A "próxima instalação" é a pendente mais cedo da fila inteira, independente do filtro aplicado
        const proximaProtocolo = enriched
            .filter(a => a.status !== "CONCLUIDO" && a.dataHora)
            .sort((a, b) => new Date(a.dataHora!).getTime() - new Date(b.dataHora!).getTime())[0]?.protocolo
            ?? enriched.find(a => a.status !== "CONCLUIDO")?.protocolo;

        // Filtrar por 'hoje' / 'atrasados' se requisitado
        let results = enriched;
        if (filter === "hoje") {
            results = enriched.filter(item => item.isHoje);
        } else if (filter === "atrasados") {
            results = enriched.filter(item => item.isAtrasado);
        }

        // Filtro por dia: na aba de concluídos vale o dia da execução, nas demais o dia agendado
        if (diaRange) {
            results = results.filter(item => {
                const ref = filter === "concluidos"
                    ? (item.imovel?.dataExecucao || item.dataHora)
                    : item.dataHora;
                if (!ref) return false;
                const d = new Date(ref);
                return d >= diaRange.gte && d <= diaRange.lte;
            });
        }

        // Ordenar pela ordem da próxima instalação que deve ser feita:
        // 1. Agendamentos pendentes com data e horário em ordem cronológica ascendente
        // 2. Agendamentos pendentes sem dataHora marcada (por ordem de solicitação)
        // 3. Concluídos por último (caso a visão seja 'todos' ou 'concluidos')
        results.sort((a, b) => {
            // Na aba de concluídos, mostrar as conclusões mais recentes primeiro
            if (filter === "concluidos") {
                const aExec = a.imovel?.dataExecucao ? new Date(a.imovel.dataExecucao).getTime() : 0;
                const bExec = b.imovel?.dataExecucao ? new Date(b.imovel.dataExecucao).getTime() : 0;
                return bExec - aExec;
            }

            const aDone = a.status === "CONCLUIDO";
            const bDone = b.status === "CONCLUIDO";
            if (aDone && !bDone) return 1;
            if (!aDone && bDone) return -1;

            if (a.dataHora && b.dataHora) {
                return new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime();
            }
            if (a.dataHora && !b.dataHora) return -1;
            if (!a.dataHora && b.dataHora) return 1;

            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        results = results.map(item => ({ ...item, proximaInstalacao: item.protocolo === proximaProtocolo }));

        // Na aba de concluídos a consulta só traz concluídos: os contadores das outras abas não se aplicam
        const contadores = filter === "concluidos" ? {} : {
            totalPendentes: enriched.filter(a => a.status !== "CONCLUIDO").length,
            totalHoje: enriched.filter(a => a.isHoje && a.status !== "CONCLUIDO").length,
            totalAtrasados: enriched.filter(a => a.isAtrasado).length,
        };

        return NextResponse.json({
            agendamentos: results,
            ...contadores
        });
    } catch (error: any) {
        console.error("Erro ao listar agenda do instalador:", error);
        return NextResponse.json({ error: "Erro ao buscar agenda" }, { status: 500 });
    }
}
