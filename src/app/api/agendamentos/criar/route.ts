import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { generateProtocol } from "@/lib/scheduling";
import { parseISO } from "date-fns";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nome, telefone, rua, numero, bairro, dataHora } = body;

        if (!nome || !telefone || !rua || !numero || !bairro || !dataHora) {
            return NextResponse.json({ error: "Todos os campos são obrigatórios" }, { status: 400 });
        }

        const protocolo = generateProtocol();
        const enderecoCompleto = `${rua}, ${numero} - ${bairro}`;

        const agendamento = await prisma.agendamento.create({
            data: {
                protocolo,
                nome,
                telefone,
                enderecoCompleto,
                dataHora: parseISO(dataHora),
                status: "AGENDADO",
            },
        });

        return NextResponse.json({ protocolo: agendamento.protocolo });
    } catch (error) {
        console.error("Erro na criação de agendamento:", error);
        return NextResponse.json({ error: "Erro ao criar agendamento" }, { status: 500 });
    }
}
