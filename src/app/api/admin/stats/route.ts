import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { temFotosReais } from "@/utils/fotos";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { response } = await requireUser(["ADMIN", "OPERATOR"]);
    if (response) return response;

    try {
        const { searchParams } = new URL(req.url);
        const bairroId = searchParams.get("bairroId") || undefined;

        const whereImovel = bairroId ? { bairroId } : {};
        const whereComplemento = bairroId ? { imovel: { bairroId } } : {};

        const [imoveisData, complementosData] = await Promise.all([
            prisma.imovel.findMany({
                where: whereImovel,
                select: { numeroAInstalar: true, status: true }
            }),
            prisma.complemento.findMany({
                where: whereComplemento,
                select: { numeroPredial: true, status: true, fotos: true, liberadoInstalacao: true }
            })
        ]);

        const porStatus: Record<string, number> = {};
        let totalDigitos = 0;
        let digitosInstalados = 0;

        for (const im of imoveisData) {
            porStatus[im.status] = (porStatus[im.status] || 0) + 1;
            const len = (im.numeroAInstalar || "").length;
            totalDigitos += len;
            if (im.status === "CONCLUIDO") digitosInstalados += len;
        }

        let complementosInstalados = 0;
        let algarismosComplementosInstalados = 0;
        let complementosLiberados = 0;

        for (const c of complementosData) {
            if (c.liberadoInstalacao) complementosLiberados++;
            if (c.status === "CONCLUIDO" && temFotosReais(c.fotos)) {
                complementosInstalados++;
                algarismosComplementosInstalados += (c.numeroPredial || "").length;
            }
        }

        return NextResponse.json({
            totalImoveis: imoveisData.length,
            concluidos: porStatus.CONCLUIDO || 0,
            liberados: porStatus.LIBERADO || 0,
            ausentes: porStatus.AUSENTE || 0,
            agendados: porStatus.AGENDADO || 0,
            pendentes: porStatus.PENDENTE || 0,
            naoIniciados: porStatus.NAO_INICIADO || 0,
            totalComplementos: complementosData.length,
            complementosLiberados,
            complementosInstalados,
            algarismosComplementosInstalados,
            totalGeralAlgarismosInstalados: digitosInstalados + algarismosComplementosInstalados,
            digitos: {
                totalNecessario: totalDigitos,
                totalInstalado: digitosInstalados
            }
        });
    } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
        return NextResponse.json({ error: "Erro ao carregar estatísticas" }, { status: 500 });
    }
}
