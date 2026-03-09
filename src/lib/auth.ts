import { createClient } from "../utils/supabase/server";
import prisma from "./prisma";
import { NextResponse } from "next/server";

export async function getSessionUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id }
    });

    return dbUser;
}

export async function isAdmin() {
    const user = await getSessionUser();
    return user?.role === 'ADMIN';
}

export async function restrictToAdmin() {
    const admin = await isAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Acesso negado. Apenas administradores podem realizar esta ação." }, { status: 403 });
    }
    return null;
}
