import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }
        return NextResponse.json({ user });
    } catch (error) {
        console.error("Erro ao buscar perfil:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
