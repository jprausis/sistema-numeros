import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, getRequestMeta } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const { user, response } = await requireUser(["ADMIN", "OPERATOR"]);
    if (response) return response;

    try {
        const { protocolo, inscimob: rawInscimob } = await req.json();
        const inscimob = String(rawInscimob || "").trim();

        if (!protocolo || !inscimob) {
            return NextResponse.json({ error: "Protocolo e inscimob são obrigatórios" }, { status: 400 });
        }

        const imovel = await prisma.imovel.findUnique({ where: { inscimob } });
        if (!imovel) {
            return NextResponse.json({ error: `Imóvel com inscrição ${inscimob} não encontrado.` }, { status: 404 });
        }

        const agendamento = await prisma.agendamento.update({
            where: { protocolo },
            data: {
                inscimobVinculo: inscimob,
                status: "AGENDADO" // Garante status correto ao vincular
            }
        });

        await prisma.imovel.update({
            where: { inscimob },
            data: {
                status: "AGENDADO",
                usuarioAlt: `Vinculado a agendamento por: ${user.email || "admin"}`
            }
        });

        await createAuditLog({
            userId: user.id,
            userEmail: user.email || "desconhecido",
            action: "VINCULAR_AGENDAMENTO",
            resource: "agendamento",
            resourceId: protocolo,
            details: { inscimob, statusAnteriorImovel: imovel.status },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, agendamento });
    } catch (error) {
        console.error("Erro ao vincular agendamento:", error);
        return NextResponse.json({ error: "Erro ao realizar vínculo" }, { status: 500 });
    }
}
