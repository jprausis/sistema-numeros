import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
        return NextResponse.json({ error: "Email não informado" }, { status: 400 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        return NextResponse.json(user);
    } catch (error) {
        return NextResponse.json({ error: "Erro ao buscar perfil" }, { status: 500 });
    }
}
