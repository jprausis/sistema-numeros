import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const imoveis = await prisma.imovel.findMany({
            include: { bairro: { select: { nome: true } } }
        });

        const header = "Inscimob;Bairro;Numero;Status;DataExecucao;Instalador;Fotos\n";
        const rows = imoveis.map(i => {
            const dataStr = i.dataExecucao ? new Date(i.dataExecucao).toLocaleDateString() : "";
            return `${i.inscimob};${i.bairro.nome};${i.numeroAInstalar};${i.status};${dataStr};${i.instaladorResp || ""};${i.fotos || ""}`;
        }).join("\n");

        const csvContent = header + rows;

        return new Response(csvContent, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="relatorio_instalacoes_${new Date().toISOString().split('T')[0]}.csv"`
            }
        });
    } catch (error) {
        return NextResponse.json({ error: "Erro ao gerar relatório" }, { status: 500 });
    }
}
