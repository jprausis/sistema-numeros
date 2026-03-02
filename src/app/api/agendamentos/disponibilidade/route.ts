import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getAvailableSlots } from "@/lib/scheduling";
import { parseISO } from "date-fns";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
        return NextResponse.json({ error: "Data é obrigatória" }, { status: 400 });
    }

    try {
        const date = parseISO(dateStr);
        const slots = await getAvailableSlots(date);
        return NextResponse.json({ slots });
    } catch (error) {
        console.error("Erro na API de disponibilidade:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
