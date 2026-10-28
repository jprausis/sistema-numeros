import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DIAS = 30;

/** Última localização de cada instalador (registrada pelo app), para o mapa do painel admin. */
export async function GET() {
    const { response } = await requireUser(["ADMIN", "OPERATOR"]);
    if (response) return response;

    try {
        const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000);
        const registros = await prisma.localizacaoInstalador.findMany({
            where: { createdAt: { gte: desde } },
            orderBy: { createdAt: "desc" },
            distinct: ["userId"],
        });

        // Nome atual do usuário (pode ter mudado depois do registro)
        const usuarios = await prisma.user.findMany({
            where: { id: { in: registros.map(r => r.userId) } },
            select: { id: true, name: true, email: true },
        });
        const porId = new Map(usuarios.map(u => [u.id, u]));

        const localizacoes = registros.map(r => {
            const u = porId.get(r.userId);
            return {
                userId: r.userId,
                nome: u?.name || r.userNome || u?.email || r.userEmail || "Instalador",
                lat: r.lat,
                lon: r.lon,
                precisao: r.precisao,
                evento: r.evento,
                createdAt: r.createdAt,
            };
        });

        return NextResponse.json({ localizacoes });
    } catch (error) {
        console.error("Erro ao listar localizações:", error);
        return NextResponse.json({ error: "Erro ao carregar localizações dos instaladores" }, { status: 500 });
    }
}
