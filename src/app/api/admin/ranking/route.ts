import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { restrictToAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const restriction = await restrictToAdmin();
    if (restriction) return restriction;

    try {
        const { searchParams } = new URL(req.url);
        const dataParam = searchParams.get("data"); // esperado: YYYY-MM-DD
        const bairroId = searchParams.get("bairroId") || undefined;

        // Construção do filtro de data de execução
        let dateFilter: any = undefined;
        if (dataParam) {
            const date = new Date(`${dataParam}T12:00:00`);
            dateFilter = {
                gte: startOfDay(date),
                lte: endOfDay(date)
            };
        }

        // Filtro base para imóveis concluídos
        const whereImovel: any = {
            status: "CONCLUIDO",
            ...(bairroId ? { bairroId } : {}),
            ...(dateFilter ? { dataExecucao: dateFilter } : {})
        };

        // Filtro base para complementos concluídos
        const whereComplemento: any = {
            status: "CONCLUIDO",
            ...(bairroId ? { imovel: { bairroId } } : {}),
            ...(dateFilter ? { dataExecucao: dateFilter } : {})
        };

        // Buscar todos os imóveis e complementos concluídos no período e bairro correspondentes
        const [imoveis, complementos] = await Promise.all([
            prisma.imovel.findMany({
                where: whereImovel,
                select: {
                    instaladorResp: true,
                    numeroAInstalar: true
                }
            }),
            prisma.complemento.findMany({
                where: whereComplemento,
                select: {
                    numeroPredial: true,
                    imovel: {
                        select: {
                            instaladorResp: true
                        }
                    }
                }
            })
        ]);

        // Processar os dados por instalador
        // Estrutura: { [instaladorName]: { totalInstalado: number, digitos: { [char]: number } } }
        const ranking: Record<string, { totalInstalado: number; digitos: Record<string, number> }> = {};

        const initializeInstalador = (nome: string) => {
            if (!ranking[nome]) {
                ranking[nome] = {
                    totalInstalado: 0,
                    digitos: {
                        "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0
                    }
                };
            }
        };

        // Contabilizar imóveis
        imoveis.forEach(im => {
            const instalador = im.instaladorResp || "Sem instalador";
            initializeInstalador(instalador);
            const numStr = im.numeroAInstalar || "";
            ranking[instalador].totalInstalado += numStr.length; // Contabiliza total de algarismos do imóvel

            for (const char of numStr) {
                if (ranking[instalador].digitos[char] !== undefined) {
                    ranking[instalador].digitos[char]++;
                }
            }
        });

        // Contabilizar complementos
        complementos.forEach(comp => {
            const instalador = comp.imovel?.instaladorResp || "Sem instalador";
            initializeInstalador(instalador);
            const numStr = comp.numeroPredial || "";
            ranking[instalador].totalInstalado += numStr.length; // Contabiliza total de algarismos do complemento

            for (const char of numStr) {
                if (ranking[instalador].digitos[char] !== undefined) {
                    ranking[instalador].digitos[char]++;
                }
            }
        });

        // Converter objeto em array e ordenar pelo totalInstalado decrescente
        const sortedRanking = Object.entries(ranking).map(([nome, dados]) => ({
            instalador: nome,
            totalInstalado: dados.totalInstalado,
            digitos: dados.digitos
        })).sort((a, b) => b.totalInstalado - a.totalInstalado);

        return NextResponse.json({ ranking: sortedRanking });
    } catch (error) {
        console.error("Erro ao obter ranking:", error);
        return NextResponse.json({ error: "Erro ao obter ranking" }, { status: 500 });
    }
}

