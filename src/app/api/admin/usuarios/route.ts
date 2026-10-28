import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireUser, getRequestMeta, Role } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const VALID_ROLES: Role[] = ["ADMIN", "OPERATOR", "PREFEITURA", "PAINEL_PREFEITURA", "INSTALLER"];

export async function GET() {
    const { response } = await requireUser(["ADMIN"]);
    if (response) return response;

    try {
        const usuarios = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ usuarios });
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        return NextResponse.json({ error: "Erro ao listar usuários" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { user: admin, response } = await requireUser(["ADMIN"]);
    if (response) return response;

    try {
        const body = await req.json();
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const role = body.role as Role;

        if (!email || !role || !password) {
            return NextResponse.json({ error: "Email, Senha e Papel são obrigatórios" }, { status: 400 });
        }
        if (!VALID_ROLES.includes(role)) {
            return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 });
        }

        // 0. Verificar se já existe no banco local para dar erro amigável
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json({ error: "Este e-mail já está cadastrado no sistema." }, { status: 400 });
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
        let newUser;
        try {
            newUser = await prisma.user.create({
                data: {
                    id: authData.user.id, // Sincroniza o ID com o do Supabase
                    name: name || null,
                    email,
                    role
                }
            });
        } catch (dbError) {
            // Desfaz o acesso criado no Auth para não deixar login sem perfil
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw dbError;
        }

        await createAuditLog({
            userId: admin.id,
            userEmail: admin.email || "admin",
            action: "CREATE_USER",
            resource: "user",
            resourceId: newUser.id,
            details: { email, role },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, user: newUser });
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 });
    }
}
