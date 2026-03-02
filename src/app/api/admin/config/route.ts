import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const configs = await prisma.config.findMany();
        const configMap = configs.reduce((acc: Record<string, string>, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);
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
