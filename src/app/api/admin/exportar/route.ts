import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function limparLinksImagens(fotosStr: string | null | undefined): string {
    if (!fotosStr) return "";
    try {
        const trimmed = fotosStr.trim();
        if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((item: any) => String(item).trim()).join(", ");
            }
            return String(parsed).trim();
        }
        let cleanStr = trimmed;
        if (cleanStr.startsWith("[") && cleanStr.endsWith("]")) {
            cleanStr = cleanStr.slice(1, -1);
            return cleanStr.split(",").map((s: string) => s.replace(/["']/g, "").trim()).join(", ");
        }
        return cleanStr;
    } catch (e) {
        return fotosStr.trim();
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const bairroId = searchParams.get("bairroId") || undefined;
        
        const where = bairroId ? { bairroId } : {};

        const imoveis = await prisma.imovel.findMany({
            where,
            include: { 
                bairro: { select: { nome: true } },
                complementos: {
                    orderBy: { unidade: 'asc' }
                }
            }
        });

        const header = "Inscimob;Bairro;Numero;Status;DataExecucao;Instalador;Fotos;Tipo\n";
        const rows: string[] = [];

        const temFotosReais = (fotosStr: string | null | undefined): boolean => {
            if (!fotosStr) return false;
            const trimmed = fotosStr.trim();
            return trimmed !== "" && trimmed !== "null" && trimmed !== "[]";
        };

        for (const i of imoveis) {
            const dataStr = i.dataExecucao ? new Date(i.dataExecucao).toLocaleDateString() : "";
            const fotosLimpas = limparLinksImagens(i.fotos);
            rows.push(`${i.inscimob};${i.bairro.nome};${i.numeroAInstalar};${i.status};${dataStr};${i.instaladorResp || ""};${fotosLimpas};Principal`);

            if (i.complementos && i.complementos.length > 0) {
                for (const c of i.complementos) {
                    const cDataStr = c.dataExecucao ? new Date(c.dataExecucao).toLocaleDateString() : "";
                    const cConcluido = c.status === "CONCLUIDO" && temFotosReais(c.fotos);
                    const statusText = cConcluido ? "CONCLUIDO" : (c.status === "CONCLUIDO" ? "PENDENTE" : c.status);
                    const instalador = cConcluido ? (i.instaladorResp || "") : "";
                    const cFotosLimpas = limparLinksImagens(c.fotos);
                    rows.push(`${c.inscimob};${i.bairro.nome};${i.numeroAInstalar} - ${c.numeroPredial};${statusText};${cDataStr};${instalador};${cFotosLimpas};Complemento`);
                }
            }
        }

        const csvContent = header + rows.join("\n");

        return new Response(csvContent, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="relatorio_instalacoes_${new Date().toISOString().split('T')[0]}.csv"`
            }
        });
    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        return NextResponse.json({ error: "Erro ao gerar relatório" }, { status: 500 });
    }
}
