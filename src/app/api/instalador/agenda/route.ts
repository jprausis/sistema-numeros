import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { sincronizarAgendamentosConcluidos } from "@/lib/agendamentos";

export async function GET(req: NextRequest) {
    try {
        let user = await getSessionUser();
        if (!user) {
            const supabase = await createClient();
            const { data: { user: sbUser } } = await supabase.auth.getUser();
            if (!sbUser) {
                return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
            }
            user = {
                id: sbUser.id,
                name: sbUser.user_metadata?.name || sbUser.email,
                email: sbUser.email,
                role: "INSTALLER"
            } as any;
        }

        const { searchParams } = new URL(req.url);
        const filter = searchParams.get("filter") || "proximos"; // 'proximos' | 'hoje' | 'todos' | 'concluidos'

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

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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

        // Filtrar por 'hoje' se requisitado
        let results = enriched;
        if (filter === "hoje") {
            results = enriched.filter(item => item.isHoje);
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

        // Marcar exatamente a 1ª instalação pendente da fila como a próxima!
        let nextFlagged = false;
        results = results.map(item => {
            if (!nextFlagged && item.status !== "CONCLUIDO") {
                nextFlagged = true;
                return { ...item, proximaInstalacao: true };
            }
            return { ...item, proximaInstalacao: false };
        });

        const totalPendentes = enriched.filter(a => a.status !== "CONCLUIDO").length;
        const totalHoje = enriched.filter(a => a.isHoje && a.status !== "CONCLUIDO").length;

        return NextResponse.json({
            agendamentos: results,
            totalPendentes,
            totalHoje
        });
    } catch (error: any) {
        console.error("Erro ao listar agenda do instalador:", error);
        return NextResponse.json({ error: "Erro ao buscar agenda" }, { status: 500 });
    }
}
