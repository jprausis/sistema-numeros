import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateUniqueProtocol } from "@/lib/agendamentos";

export const dynamic = "force-dynamic";

// Formulário público (/agendar): registra o contato do morador para a equipe retornar.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
        const nome = clean(body.nome, 120);
        const telefone = clean(body.telefone, 30);
        const rua = clean(body.rua, 150);
        const numero = clean(body.numero, 20);
        const bairro = clean(body.bairro, 80);

        if (!nome || !telefone || !rua || !numero || !bairro) {
            return NextResponse.json({ error: "Todos os campos são obrigatórios" }, { status: 400 });
        }
        if (telefone.replace(/\D/g, "").length < 10) {
            return NextResponse.json({ error: "Informe um telefone válido com DDD." }, { status: 400 });
        }

        const protocolo = await generateUniqueProtocol("AG");

        const agendamento = await prisma.agendamento.create({
            data: {
                protocolo,
                nome,
                telefone,
                enderecoCompleto: `${rua}, ${numero} - ${bairro}`,
                dataHora: new Date(), // Data do pedido; a data da instalação é definida depois pela equipe
                status: "AGENDADO",
            },
        });

        return NextResponse.json({ protocolo: agendamento.protocolo });
    } catch (error) {
        console.error("Erro na criação de agendamento:", error);
        return NextResponse.json({ error: "Erro ao criar agendamento" }, { status: 500 });
    }
}
