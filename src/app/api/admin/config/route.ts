import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { restrictToAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const restriction = await restrictToAdmin();
    if (restriction) return restriction;

    try {
        const configs = await prisma.config.findMany();
        const configMap: Record<string, string> = {};
        for (const curr of configs) {
            configMap[curr.key] = curr.value;
        }
        return NextResponse.json({ config: configMap });
    } catch (error) {
        return NextResponse.json({ error: "Erro ao buscar configurações" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const updates = await req.json(); // { key: value }

        for (const [key, value] of Object.entries(updates)) {
            await prisma.config.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Erro ao atualizar configurações" }, { status: 500 });
    }
}
