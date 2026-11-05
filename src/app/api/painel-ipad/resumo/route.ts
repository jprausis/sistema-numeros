import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { gerarResumoPrefeitura } from "@/lib/resumoPrefeitura";

export const dynamic = "force-dynamic";

// Leitura para o painel do iPad (via n8n). Autentica por token próprio, sem sessão de usuário,
// não grava no banco e usa o mesmo resumo da prefeitura, que não expõe moradores nem equipe.
function tokenValido(request: NextRequest) {
    const esperado = process.env.PAINEL_IPAD_TOKEN || "";
    if (esperado.length < 16) return false;
    const a = Buffer.from((request.headers.get("authorization") || "").replace(/^Bearer /, ""));
    const b = Buffer.from(esperado);
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
    if (!tokenValido(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    try {
        return NextResponse.json(await gerarResumoPrefeitura({ sincronizar: false }));
    } catch (error) {
        console.error("Erro ao carregar resumo do painel iPad:", error);
        return NextResponse.json({ error: "Erro ao carregar o resumo" }, { status: 500 });
    }
}
