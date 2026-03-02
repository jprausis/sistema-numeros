import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const usuarios = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ usuarios });
    } catch (error) {
        return NextResponse.json({ error: "Erro ao listar usuários" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { name, email, password, role } = await req.json();

        if (!email || !role || !password) {
            return NextResponse.json({ error: "Email, Senha e Papel são obrigatórios" }, { status: 400 });
        }

        // 1. Criar usuário no Supabase Auth (Sistema de Login real)
        const supabaseAdmin = createAdminClient();
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Já cria confirmado
            user_metadata: { name, role }
        });

        if (authError) {
            console.error("Erro no Auth do Supabase:", authError);
            return NextResponse.json({ error: "Erro ao criar acesso: " + authError.message }, { status: 400 });
        }

        // 2. Criar registro no nosso banco de dados para gestão de perfis
        const newUser = await prisma.user.create({
            data: {
                id: authData.user.id, // Sincroniza o ID com o do Supabase
                name,
                email,
                role
            }
        });

        return NextResponse.json({ success: true, user: newUser });
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 });
    }
}
