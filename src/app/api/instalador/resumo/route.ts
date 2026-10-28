import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { brazilDayRange, todayBrazil } from "@/lib/timezone";

export const dynamic = "force-dynamic";

/** Resumo do dia do instalador logado (horário de Brasília): imóveis concluídos e pendentes. */
export async function GET() {
    const { user, response } = await requireUser(["ADMIN", "OPERATOR", "INSTALLER"]);
    if (response) return response;

    try {
        const hoje = brazilDayRange(todayBrazil())!;
        // Mesmo nome gravado em instaladorResp por /api/instalador/atualizar
        const instalador = user.name || user.email || "Instalador";
        const [concluidos, pendentes, complementos] = await Promise.all([
            prisma.imovel.count({ where: { instaladorResp: instalador, status: "CONCLUIDO", dataExecucao: hoje } }),
            prisma.imovel.count({ where: { instaladorResp: instalador, status: "PENDENTE", dataExecucao: hoje } }),
            prisma.complemento.count({ where: { status: "CONCLUIDO", dataExecucao: hoje, imovel: { instaladorResp: instalador } } }),
        ]);

        return NextResponse.json({ concluidos, pendentes, complementos });
    } catch (error) {
        console.error("Erro ao montar resumo do instalador:", error);
        return NextResponse.json({ error: "Erro ao carregar resumo" }, { status: 500 });
    }
}
