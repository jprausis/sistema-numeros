import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tipo = searchParams.get("tipo") || "agendamentos"; // "agendamentos" | "contatos"
        const search = searchParams.get("q")?.trim();

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

        // Contagens globais para exibição de abas e badges
        const [totalAgendamentos, totalContatos] = await Promise.all([
            prisma.agendamento.count({ where: whereAgendamentos }),
            prisma.agendamento.count({ where: whereContatos })
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
                totalContatos
            });
        }

        // Caso padrão: "agendamentos" (oficiais para instalação)
        const whereCondition: any = { ...whereAgendamentos };
        if (search) {
            whereCondition.AND = [
                {
                    OR: [
                        { protocolo: { contains: search, mode: "insensitive" } },
                        { nome: { contains: search, mode: "insensitive" } },
                        { telefone: { contains: search, mode: "insensitive" } },
                        { inscimobVinculo: { contains: search, mode: "insensitive" } }
                    ]
                }
            ];
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
                    complementos: true
                }
            })
            : [];
        const imovelMap = new Map(imoveis.map(i => [i.inscimob, i]));

        const enriched = agendamentos.map(ag => {
            const imovel = ag.inscimobVinculo ? imovelMap.get(ag.inscimobVinculo) || null : null;
            let dataStr = "";
            let horarioStr = "09:00";
            if (ag.dataHora) {
                const d = new Date(ag.dataHora);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                dataStr = `${yyyy}-${mm}-${dd}`;
                const hh = String(d.getHours()).padStart(2, "0");
                const min = String(d.getMinutes()).padStart(2, "0");
                horarioStr = `${hh}:${min}`;
            }

            return {
                ...ag,
                imovel,
                dataStr,
                horarioStr,
                observacao: imovel?.obsPendente || ""
            };
        });

        return NextResponse.json({
            tipo: "agendamentos",
            items: enriched,
            totalAgendamentos,
            totalContatos
        });
    } catch (error) {
        console.error("Erro ao listar agendamentos:", error);
        return NextResponse.json({ error: "Erro ao buscar agendamentos" }, { status: 500 });
    }
}
