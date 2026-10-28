import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { restrictToAdmin } from "@/lib/auth";
import { brazilDayRange, todayBrazil } from "@/lib/timezone";
import { listFotos } from "@/utils/fotos";

export const dynamic = "force-dynamic";

/**
 * Linha do tempo do dia: imóveis concluídos ou marcados como pendentes no dia (horário de Brasília),
 * com o instalador, a foto da instalação e o agendamento vinculado (se houver).
 * Mostra o estado atual do imóvel: um pendente que foi concluído depois aparece como concluído.
 */
export async function GET(req: NextRequest) {
    const restriction = await restrictToAdmin();
    if (restriction) return restriction;

    try {
        const { searchParams } = new URL(req.url);
        const data = searchParams.get("data") || todayBrazil();
        const bairroId = searchParams.get("bairroId") || undefined;

        const dia = brazilDayRange(data);
        if (!dia) {
            return NextResponse.json({ error: "Data inválida" }, { status: 400 });
        }

        const imoveis = await prisma.imovel.findMany({
            where: {
                status: { in: ["CONCLUIDO", "PENDENTE"] },
                dataExecucao: dia,
                ...(bairroId ? { bairroId } : {}),
            },
            orderBy: { dataExecucao: "desc" },
            select: {
                inscimob: true,
                numeroAInstalar: true,
                endereco: true,
                status: true,
                dataExecucao: true,
                instaladorResp: true,
                fotos: true,
                motivoPendencia: true,
                obsPendente: true,
                bairro: { select: { nome: true } },
                complementos: {
                    where: { status: { in: ["CONCLUIDO", "PENDENTE"] }, dataExecucao: dia },
                    select: { numeroPredial: true, status: true },
                },
            },
        });

        const inscimobs = imoveis.map(i => i.inscimob);
        const agendamentos = inscimobs.length
            ? await prisma.agendamento.findMany({
                where: { inscimobVinculo: { in: inscimobs }, status: { not: "CANCELADO" } },
                orderBy: { dataHora: "desc" },
                select: { protocolo: true, nome: true, dataHora: true, status: true, inscimobVinculo: true },
            })
            : [];
        // Um agendamento por imóvel (o mais recente)
        const agendamentoPorImovel = new Map<string, (typeof agendamentos)[number]>();
        for (const ag of agendamentos) {
            if (ag.inscimobVinculo && !agendamentoPorImovel.has(ag.inscimobVinculo)) {
                agendamentoPorImovel.set(ag.inscimobVinculo, ag);
            }
        }

        const itens = imoveis.map(im => {
            const ag = agendamentoPorImovel.get(im.inscimob);
            return {
                inscimob: im.inscimob,
                numero: im.numeroAInstalar,
                endereco: im.endereco,
                bairro: im.bairro?.nome || null,
                status: im.status,
                horario: im.dataExecucao,
                instalador: im.instaladorResp || "Sem instalador",
                fotos: listFotos(im.fotos),
                motivoPendencia: im.motivoPendencia,
                obsPendente: im.obsPendente,
                complementos: im.complementos,
                agendamento: ag ? { protocolo: ag.protocolo, nome: ag.nome, dataHora: ag.dataHora, status: ag.status } : null,
            };
        });

        return NextResponse.json({ data, itens });
    } catch (error) {
        console.error("Erro ao obter linha do tempo:", error);
        return NextResponse.json({ error: "Erro ao obter linha do tempo" }, { status: 500 });
    }
}
