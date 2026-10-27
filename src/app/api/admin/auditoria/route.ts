import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { restrictToAdmin } from "@/lib/auth";
import { brazilDayRange } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const restriction = await restrictToAdmin();
    if (restriction) return restriction;

    try {
        const { searchParams } = new URL(req.url);
        const userEmail = searchParams.get("userEmail");
        const imovel = searchParams.get("imovel")?.trim();
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
        const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
        const skip = (page - 1) * limit;

        const where: any = {};

        if (userEmail) {
            where.userEmail = { contains: userEmail, mode: 'insensitive' };
        }

        // Nº do imóvel (ou inscrição / protocolo): logs do imóvel, dos seus complementos e agendamentos
        if (imovel) {
            const imoveis = await prisma.imovel.findMany({
                where: { OR: [{ numeroAInstalar: { equals: imovel, mode: "insensitive" } }, { inscimob: imovel }] },
                select: { inscimob: true }
            });
            const inscimobs = imoveis.map(i => i.inscimob);
            const [complementos, agendamentos] = inscimobs.length > 0
                ? await Promise.all([
                    prisma.complemento.findMany({ where: { inscimob: { in: inscimobs } }, select: { id: true } }),
                    prisma.agendamento.findMany({ where: { inscimobVinculo: { in: inscimobs } }, select: { protocolo: true } })
                ])
                : [[], []];
            where.resourceId = {
                in: [imovel, ...inscimobs, ...complementos.map(c => c.id), ...agendamentos.map(a => a.protocolo)]
            };
        }

        // Datas interpretadas no horário de Brasília
        const startRange = startDate ? brazilDayRange(startDate) : null;
        const endRange = endDate ? brazilDayRange(endDate) : null;
        if (startRange || endRange) {
            where.createdAt = {};
            if (startRange) where.createdAt.gte = startRange.gte;
            if (endRange) where.createdAt.lte = endRange.lte;
        }

        const [logs, totalCount] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: sortOrder },
                skip,
                take: limit
            }),
            prisma.auditLog.count({ where })
        ]);

        // Nº e bairro do imóvel de cada log, para exibição
        const ids = Array.from(new Set(logs.map(l => l.resourceId).filter(Boolean))) as string[];
        const [imoveisLog, complementosLog, agendamentosLog] = ids.length > 0
            ? await Promise.all([
                prisma.imovel.findMany({ where: { inscimob: { in: ids } }, select: { inscimob: true } }),
                prisma.complemento.findMany({ where: { id: { in: ids } }, select: { id: true, inscimob: true, numeroPredial: true } }),
                prisma.agendamento.findMany({ where: { protocolo: { in: ids }, inscimobVinculo: { not: null } }, select: { protocolo: true, inscimobVinculo: true } })
            ])
            : [[], [], []];
        const inscimobDoId = new Map<string, string>();
        imoveisLog.forEach(i => inscimobDoId.set(i.inscimob, i.inscimob));
        complementosLog.forEach(c => inscimobDoId.set(c.id, c.inscimob));
        agendamentosLog.forEach(a => inscimobDoId.set(a.protocolo, a.inscimobVinculo!));
        const dadosImoveis = inscimobDoId.size > 0
            ? await prisma.imovel.findMany({
                where: { inscimob: { in: Array.from(new Set(inscimobDoId.values())) } },
                select: { inscimob: true, numeroAInstalar: true, bairro: { select: { nome: true } } }
            })
            : [];
        const imovelMap = new Map(dadosImoveis.map(i => [i.inscimob, i]));
        const complementoMap = new Map(complementosLog.map(c => [c.id, c.numeroPredial]));

        const logsComImovel = logs.map(log => {
            const insc = log.resourceId ? inscimobDoId.get(log.resourceId) : undefined;
            const im = insc ? imovelMap.get(insc) : undefined;
            return {
                ...log,
                imovel: im ? {
                    inscimob: im.inscimob,
                    numero: im.numeroAInstalar,
                    bairro: im.bairro?.nome || null,
                    complemento: complementoMap.get(log.resourceId!) || null
                } : null
            };
        });

        return NextResponse.json({ 
            logs: logsComImovel, 
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        console.error("Erro ao buscar logs:", error);
        return NextResponse.json({ error: "Erro ao buscar logs de auditoria" }, { status: 500 });
    }
}
