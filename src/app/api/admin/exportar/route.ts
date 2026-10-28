import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatBrazil, todayBrazil } from "@/lib/timezone";
import { limparLinksImagens, temFotosReais } from "@/utils/fotos";

export const dynamic = "force-dynamic";

// Escapa um valor para CSV separado por ";" (aspas, quebras de linha e o próprio separador)
function csvCell(value: unknown): string {
    const str = value === null || value === undefined ? "" : String(value);
    return /[";\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function GET(req: NextRequest) {
    const { response } = await requireUser(["ADMIN", "OPERATOR", "PAINEL_PREFEITURA"]);
    if (response) return response;

    try {
        const { searchParams } = new URL(req.url);
        const bairroId = searchParams.get("bairroId") || undefined;

        const where = bairroId ? { bairroId } : {};

        const imoveis = await prisma.imovel.findMany({
            where,
            select: {
                inscimob: true,
                numeroAInstalar: true,
                status: true,
                dataExecucao: true,
                instaladorResp: true,
                fotos: true,
                bairro: { select: { nome: true } },
                complementos: {
                    select: { inscimob: true, numeroPredial: true, status: true, dataExecucao: true, fotos: true },
                    orderBy: { unidade: 'asc' }
                }
            },
            orderBy: { inscimob: 'asc' }
        });

        const header = ["Inscimob", "Bairro", "Numero", "Status", "DataExecucao", "Instalador", "Fotos", "Tipo"];
        const rows: string[] = [header.join(";")];

        for (const i of imoveis) {
            rows.push([
                i.inscimob,
                i.bairro.nome,
                i.numeroAInstalar,
                i.status,
                formatBrazil(i.dataExecucao),
                i.instaladorResp || "",
                limparLinksImagens(i.fotos),
                "Principal"
            ].map(csvCell).join(";"));

            for (const c of i.complementos) {
                const cConcluido = c.status === "CONCLUIDO" && temFotosReais(c.fotos);
                const statusText = cConcluido ? "CONCLUIDO" : (c.status === "CONCLUIDO" ? "PENDENTE" : c.status);
                rows.push([
                    c.inscimob,
                    i.bairro.nome,
                    `${i.numeroAInstalar} - ${c.numeroPredial}`,
                    statusText,
                    formatBrazil(c.dataExecucao),
                    cConcluido ? (i.instaladorResp || "") : "",
                    limparLinksImagens(c.fotos),
                    "Complemento"
                ].map(csvCell).join(";"));
            }
        }

        // BOM para o Excel reconhecer acentos (UTF-8)
        const csvContent = "﻿" + rows.join("\r\n");

        return new Response(csvContent, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="relatorio_instalacoes_${todayBrazil()}.csv"`
            }
        });
    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        return NextResponse.json({ error: "Erro ao gerar relatório" }, { status: 500 });
    }
}
