import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const EVENTOS = ["LOGIN", "ABERTURA"];

/** Registra a localização do instalador (enviada pelo app Android no login e ao abrir o app). */
export async function POST(req: NextRequest) {
    const { user, response } = await requireUser(["ADMIN", "OPERATOR", "INSTALLER"]);
    if (response) return response;

    try {
        const body = await req.json();
        const lat = Number(body.lat);
        const lon = Number(body.lon);
        const precisao = body.precisao != null && isFinite(Number(body.precisao)) ? Number(body.precisao) : null;
        const evento = EVENTOS.includes(body.evento) ? body.evento : "ABERTURA";

        if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            return NextResponse.json({ error: "Coordenadas inválidas" }, { status: 400 });
        }

        await prisma.localizacaoInstalador.create({
            data: {
                userId: user.id,
                userNome: user.name,
                userEmail: user.email,
                lat,
                lon,
                precisao,
                evento,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao registrar localização:", error);
        return NextResponse.json({ error: "Erro ao registrar localização" }, { status: 500 });
    }
}
