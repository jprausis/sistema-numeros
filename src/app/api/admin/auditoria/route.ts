import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { restrictToAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const restriction = await restrictToAdmin();
    if (restriction) return restriction;

    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        return NextResponse.json({ logs });
    } catch (error) {
        console.error("Erro ao buscar logs:", error);
        return NextResponse.json({ error: "Erro ao buscar logs de auditoria" }, { status: 500 });
    }
}
