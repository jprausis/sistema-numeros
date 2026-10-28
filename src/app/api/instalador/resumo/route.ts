import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { brazilDayRange, todayBrazil } from "@/lib/timezone";

export const dynamic = "force-dynamic";

/** Quantidade de algarismos/letras de um número instalado (ex.: "365" = 3, "CS2" = 3). */
const algarismosDe = (numero: string | null | undefined) => (String(numero || "").match(/[0-9a-z]/gi) || []).length;

/**
 * Resumo do dia do instalador logado (horário de Brasília): algarismos instalados (números dos imóveis
 * concluídos + complementos concluídos, somados), imóveis concluídos e pendentes.
 */
export async function GET() {
    const { user, response } = await requireUser(["ADMIN", "OPERATOR", "INSTALLER"]);
    if (response) return response;

    try {
        const hoje = brazilDayRange(todayBrazil())!;
        // Mesmo nome gravado em instaladorResp por /api/instalador/atualizar
        const instalador = user.name || user.email || "Instalador";
        const [imoveisConcluidos, pendentes, complementosConcluidos] = await Promise.all([
            prisma.imovel.findMany({
                where: { instaladorResp: instalador, status: "CONCLUIDO", dataExecucao: hoje },
                select: { numeroAInstalar: true },
            }),
            prisma.imovel.count({ where: { instaladorResp: instalador, status: "PENDENTE", dataExecucao: hoje } }),
            prisma.complemento.findMany({
                where: { status: "CONCLUIDO", dataExecucao: hoje, imovel: { instaladorResp: instalador } },
                select: { numeroPredial: true },
            }),
        ]);

        const algarismos =
            imoveisConcluidos.reduce((soma, i) => soma + algarismosDe(i.numeroAInstalar), 0) +
            complementosConcluidos.reduce((soma, c) => soma + algarismosDe(c.numeroPredial), 0);

        return NextResponse.json({
            algarismos,
            concluidos: imoveisConcluidos.length,
            pendentes,
            complementos: complementosConcluidos.length,
        });
    } catch (error) {
        console.error("Erro ao montar resumo do instalador:", error);
        return NextResponse.json({ error: "Erro ao carregar resumo" }, { status: 500 });
    }
}
