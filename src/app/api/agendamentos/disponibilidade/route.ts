import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getAvailableSlots } from "@/lib/scheduling";
import { parseISO, addDays, format } from "date-fns";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    const all = searchParams.get("all");

    try {
        if (all === "true") {
            const allSlots: Record<string, string[]> = {};
            const today = new Date();
            // Verifica os próximos 60 dias para englobar config de máximo até uns 2 meses.
            for (let i = 0; i < 60; i++) {
                const checkDate = addDays(today, i);
                const slots = await getAvailableSlots(checkDate);
                if (slots.length > 0) {
                    const formattedDate = format(checkDate, "yyyy-MM-dd");
                    allSlots[formattedDate] = slots.map(d => d.toISOString());
                }
            }
            return NextResponse.json({ slotsByDate: allSlots });
        }

        if (!dateStr) {
            return NextResponse.json({ error: "Data é obrigatória" }, { status: 400 });
        }

        const date = parseISO(dateStr);
        const slots = await getAvailableSlots(date);
        return NextResponse.json({ slots });
    } catch (error) {
        console.error("Erro na API de disponibilidade:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
