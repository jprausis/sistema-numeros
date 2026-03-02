import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // 1. Tentar deletar no Supabase Auth primeiro (se o ID for um UUID)
        const supabase = createAdminClient();

        // Verificamos se o ID parece um e-mail (caso temporário) ou UUID
        if (!id.includes('@')) {
            const { error: authError } = await supabase.auth.admin.deleteUser(id);
            if (authError) console.error("Erro ao deletar no Supabase Auth:", authError);
        }

        // 2. Deletar no nosso banco Prisma
        await prisma.user.delete({
            where: { id }
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
    const { id } = await params;
    const { name, role } = await req.json();

    try {
        const user = await prisma.user.update({
            where: { id },
            data: { name, role }
        });

        // Opcional: Atualizar metadata no Supabase se id for UUID
        if (!id.includes('@')) {
            const supabase = createAdminClient();
            await supabase.auth.admin.updateUserById(id, {
                user_metadata: { name, role }
            });
        }

        return NextResponse.json({ success: true, user });
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
    }
}
