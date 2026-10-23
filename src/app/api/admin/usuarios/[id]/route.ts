import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireUser, getRequestMeta, Role } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

const VALID_ROLES: Role[] = ["ADMIN", "OPERATOR", "PREFEITURA", "INSTALLER"];

// IDs antigos (criados por script) usam o e-mail como ID e não existem no Supabase Auth
const isAuthId = (id: string) => !id.includes('@');

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user: admin, response } = await requireUser(["ADMIN"]);
    if (response) return response;

    const { id } = await params;

    if (id === admin.id) {
        return NextResponse.json({ error: "Você não pode excluir o seu próprio acesso." }, { status: 400 });
    }

    try {
        const target = await prisma.user.findUnique({ where: { id } });
        if (!target) {
            return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
        }

        if (isAuthId(id)) {
            const supabase = createAdminClient();
            const { error: authError } = await supabase.auth.admin.deleteUser(id);
            if (authError) console.error("Erro ao deletar no Supabase Auth:", authError);
        }

        await prisma.user.delete({ where: { id } });

        await createAuditLog({
            userId: admin.id,
            userEmail: admin.email || "admin",
            action: "DELETE_USER",
            resource: "user",
            resourceId: id,
            details: { email: target.email, role: target.role },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        return NextResponse.json({ error: "Erro ao deletar usuário" }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user: admin, response } = await requireUser(["ADMIN"]);
    if (response) return response;

    const { id } = await params;
    const { name, role, password } = await req.json();

    if (role !== undefined && !VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
    }
    if (id === admin.id && role !== undefined && role !== "ADMIN") {
        return NextResponse.json({ error: "Você não pode remover o seu próprio acesso de administrador." }, { status: 400 });
    }
    if (password !== undefined && password !== "" && String(password).length < 6) {
        return NextResponse.json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }

    try {
        const before = await prisma.user.findUnique({ where: { id } });
        if (!before) {
            return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
        }

        const user = await prisma.user.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name: String(name).trim() || null } : {}),
                ...(role !== undefined ? { role } : {})
            }
        });

        if (isAuthId(id)) {
            const supabase = createAdminClient();
            const { error: authError } = await supabase.auth.admin.updateUserById(id, {
                user_metadata: { name: user.name, role: user.role },
                ...(password ? { password: String(password) } : {})
            });
            if (authError) {
                console.error("Erro ao atualizar no Supabase Auth:", authError);
                if (password) {
                    return NextResponse.json({ error: "Dados salvos, mas não foi possível alterar a senha: " + authError.message }, { status: 400 });
                }
            }
        }

        await createAuditLog({
            userId: admin.id,
            userEmail: admin.email || "admin",
            action: "UPDATE_USER",
            resource: "user",
            resourceId: id,
            details: {
                antes: { name: before.name, role: before.role },
                depois: { name: user.name, role: user.role },
                senhaAlterada: Boolean(password)
            },
            ...getRequestMeta(req)
        });

        return NextResponse.json({ success: true, user });
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
    }
}
