import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { gerarResumoPrefeitura } from "@/lib/resumoPrefeitura";

export const dynamic = "force-dynamic";

export async function GET() {
    const { response } = await requireUser(["ADMIN", "OPERATOR", "PAINEL_PREFEITURA"]);
    if (response) return response;

    try {
        return NextResponse.json(await gerarResumoPrefeitura());
    } catch (error) {
        console.error("Erro ao carregar resumo da prefeitura:", error);
        return NextResponse.json({ error: "Erro ao carregar o resumo" }, { status: 500 });
    }
}
