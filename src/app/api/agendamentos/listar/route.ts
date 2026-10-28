import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sincronizarAgendamentosConcluidos } from "@/lib/agendamentos";
import { requireUser } from "@/lib/auth";
import { splitBrazilDate, brazilDayRange, buildBrazilDate, todayBrazil } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { response } = await requireUser(["ADMIN", "OPERATOR", "PAINEL_PREFEITURA"]);
    if (response) return response;

    try {
        const { searchParams } = new URL(req.url);
        const tipo = searchParams.get("tipo") || "agendamentos"; // "agendamentos" | "concluidos" | "contatos"
        const search = searchParams.get("q")?.trim();
        // Filtros da fila: periodo = todos | atrasados | hoje | amanha | semana | dia (com data=YYYY-MM-DD)
        const periodo = searchParams.get("periodo") || "todos";
        const dataFiltro = searchParams.get("data") || "";
        const statusFiltro = searchParams.get("status") || "";

        // Garante que agendamentos de imóveis já concluídos sejam marcados como CONCLUIDO
        await sincronizarAgendamentosConcluidos();

        // 1. Agendamentos Oficiais da Prefeitura / Para Instalação:
        // Protocolo começa com PREF- ou possui inscimobVinculo
        const whereAgendamentos: any = {
            OR: [
                { protocolo: { startsWith: "PREF-" } },
                { inscimobVinculo: { not: null } }
            ]
        };

        // 2. Contatos / Cadastros Antigos:
        // Protocolo NÃO começa com PREF- e inscimobVinculo é nulo
        const whereContatos: any = {
            NOT: { protocolo: { startsWith: "PREF-" } },
            inscimobVinculo: null
        };

        // 1.1 Em aberto (fila de instalação) x Concluídos (histórico para conferência)
        const whereAbertos: any = { AND: [whereAgendamentos, { status: { not: "CONCLUIDO" } }] };
        const whereConcluidos: any = { AND: [whereAgendamentos, { status: "CONCLUIDO" }] };

        // Atrasados: em aberto com horário marcado que já passou
        const agora = new Date();
        const whereAtrasados: any = { AND: [...whereAbertos.AND, { dataHora: { lt: agora } }] };

        // Contagens globais para exibição de abas e badges
        const [totalAgendamentos, totalConcluidos, totalContatos, totalAtrasados] = await Promise.all([
            prisma.agendamento.count({ where: whereAbertos }),
            prisma.agendamento.count({ where: whereConcluidos }),
            prisma.agendamento.count({ where: whereContatos }),
            prisma.agendamento.count({ where: whereAtrasados })
        ]);

        if (tipo === "contatos") {
            const whereCondition: any = { ...whereContatos };
            if (search) {
                whereCondition.OR = [
                    { protocolo: { contains: search, mode: "insensitive" } },
                    { nome: { contains: search, mode: "insensitive" } },
                    { telefone: { contains: search, mode: "insensitive" } },
                    { enderecoCompleto: { contains: search, mode: "insensitive" } }
                ];
            }

            const contatos = await prisma.agendamento.findMany({
                where: whereCondition,
                orderBy: { createdAt: "desc" }
            });

            return NextResponse.json({
                tipo: "contatos",
                items: contatos,
                totalAgendamentos,
                totalConcluidos,
                totalContatos,
                totalAtrasados
            });
        }

        // "agendamentos" (em aberto) ou "concluidos" (oficiais para instalação)
        const isConcluidos = tipo === "concluidos";
        const whereCondition: any = { AND: [...(isConcluidos ? whereConcluidos.AND : whereAbertos.AND)] };
        if (search) {
            whereCondition.AND.push({
                OR: [
                    { protocolo: { contains: search, mode: "insensitive" } },
                    { nome: { contains: search, mode: "insensitive" } },
                    { telefone: { contains: search, mode: "insensitive" } },
                    { inscimobVinculo: { contains: search, mode: "insensitive" } }
                ]
            });
        }

        const hoje = todayBrazil();
        const diaMs = 24 * 60 * 60 * 1000;
        const inicioHoje = buildBrazilDate(hoje, "00:00")!;
        if (periodo === "atrasados" && !isConcluidos) {
            whereCondition.AND.push({ dataHora: { lt: agora } });
        } else if (periodo === "hoje") {
            whereCondition.AND.push({ dataHora: brazilDayRange(hoje) });
        } else if (periodo === "amanha") {
            const amanha = splitBrazilDate(new Date(inicioHoje.getTime() + diaMs)).data;
            whereCondition.AND.push({ dataHora: brazilDayRange(amanha) });
        } else if (periodo === "semana") {
            // Próximos 7 dias (hoje incluso)
            whereCondition.AND.push({ dataHora: { gte: inicioHoje, lt: new Date(inicioHoje.getTime() + 7 * diaMs) } });
        } else if (periodo === "dia" && dataFiltro) {
            const range = brazilDayRange(dataFiltro);
            if (range) whereCondition.AND.push({ dataHora: range });
        }
        if (statusFiltro && !isConcluidos) {
            whereCondition.AND.push({ status: statusFiltro });
        }

        const agendamentos = await prisma.agendamento.findMany({
            where: whereCondition,
            orderBy: [
                { dataHora: "asc" },
                { createdAt: "desc" }
            ]
        });

        // Enriquecer com dados do imóvel e observação da prefeitura
        const inscimobs = Array.from(new Set(agendamentos.map(a => a.inscimobVinculo).filter(Boolean))) as string[];
        const imoveis = inscimobs.length > 0
            ? await prisma.imovel.findMany({
                where: { inscimob: { in: inscimobs } },
                include: {
                    bairro: { select: { id: true, nome: true } },
                    complementos: { orderBy: { unidade: "asc" } }
                }
            })
            : [];
        const imovelMap = new Map(imoveis.map(i => [i.inscimob, i]));

        const enriched = agendamentos.map(ag => {
            const imovel = ag.inscimobVinculo ? imovelMap.get(ag.inscimobVinculo) || null : null;
            let dataStr = "";
            let horarioStr = "09:00";
            if (ag.dataHora) {
                // Sempre no horário de Brasília (o servidor roda em UTC)
                const { data, horario } = splitBrazilDate(new Date(ag.dataHora));
                dataStr = data;
                horarioStr = horario;
            }

            return {
                ...ag,
                imovel,
                dataStr,
                horarioStr,
                observacao: imovel?.obsPendente || "",
                atrasado: !isConcluidos && !!ag.dataHora && ag.dataHora < agora
            };
        });

        // Concluídos: mais recentes (data de execução do imóvel) primeiro
        if (isConcluidos) {
            enriched.sort((a, b) => {
                const aExec = a.imovel?.dataExecucao ? new Date(a.imovel.dataExecucao).getTime() : 0;
                const bExec = b.imovel?.dataExecucao ? new Date(b.imovel.dataExecucao).getTime() : 0;
                return bExec - aExec;
            });
        }

        return NextResponse.json({
            tipo: isConcluidos ? "concluidos" : "agendamentos",
            items: enriched,
            totalAgendamentos,
            totalConcluidos,
            totalContatos,
            totalAtrasados
        });
    } catch (error) {
        console.error("Erro ao listar agendamentos:", error);
        return NextResponse.json({ error: "Erro ao buscar agendamentos" }, { status: 500 });
    }
}
