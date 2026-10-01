import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { protocolo, inscimob } = await req.json();

        if (!protocolo || !inscimob) {
            return NextResponse.json({ error: "Protocolo e inscimob são obrigatórios" }, { status: 400 });
        }

        const agendamento = await prisma.agendamento.update({
            where: { protocolo },
            data: {
                inscimobVinculo: inscimob,
                status: "AGENDADO" // Garante status correto ao vincular
            }
        });

        const imovel = await prisma.imovel.findUnique({
            where: { inscimob }
        });
        if (imovel) {
            await prisma.imovel.update({
                where: { inscimob },
                data: {
                    status: "AGENDADO",
                    usuarioAlt: "Vinculado a agendamento por admin"
                }
            });
        }

        return NextResponse.json({ success: true, agendamento });
    } catch (error) {
        return NextResponse.json({ error: "Erro ao realizar vínculo" }, { status: 500 });
    }
}
