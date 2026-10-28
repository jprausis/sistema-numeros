import { createClient } from "../utils/supabase/server";
import prisma from "./prisma";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export type Role = "ADMIN" | "OPERATOR" | "PREFEITURA" | "PAINEL_PREFEITURA" | "INSTALLER";

// Papéis com acesso ao painel administrativo / gestão da base
export const STAFF_ROLES: Role[] = ["ADMIN", "OPERATOR", "PREFEITURA"];

// Papéis que gerenciam agendamentos (o Painel Prefeitura agenda pela página própria)
export const AGENDA_ROLES: Role[] = [...STAFF_ROLES, "PAINEL_PREFEITURA"];

// Nome do papel gravado em `usuarioAlt` / logs
export const ROLE_LABEL: Record<string, string> = {
    ADMIN: "Admin",
    OPERATOR: "Operador",
    PREFEITURA: "Prefeitura",
    PAINEL_PREFEITURA: "Painel Prefeitura",
    INSTALLER: "Instalador",
};

export async function getSessionUser() {
    const supabase = await createClient();

    // App Android do instalador: não usa cookies, envia o token do Supabase no cabeçalho
    const authHeader = (await headers()).get("authorization");
    const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

    const { data: { user } } = bearer
        ? await supabase.auth.getUser(bearer)
        : await supabase.auth.getUser();

    if (!user) return null;

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id }
    });

    return dbUser;
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/**
 * Garante que existe um usuário autenticado (e, opcionalmente, com um dos papéis informados).
 * Retorna `{ user }` em caso de sucesso ou `{ response }` com o erro HTTP a ser devolvido.
 */
export async function requireUser(roles?: Role[]): Promise<{ user: SessionUser; response?: never } | { user?: never; response: NextResponse }> {
    const user = await getSessionUser();
    if (!user) {
        return { response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
    }
    if (roles && !roles.includes(user.role as Role)) {
        return { response: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
    }
    return { user };
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

export function getRequestMeta(req: Request) {
    return {
        ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
    };
}
