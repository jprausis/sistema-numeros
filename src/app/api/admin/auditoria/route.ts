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

        return NextResponse.json({ 
            logs, 
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
