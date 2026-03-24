import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { restrictToAdmin } from "@/lib/auth";

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
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        const where: any = {};

        if (userEmail) {
            where.userEmail = { contains: userEmail, mode: 'insensitive' };
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
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
