import prisma from "./prisma";

interface AuditLogParams {
    userId: string;
    userEmail: string;
    action: string;
    resource: string;
    resourceId?: string;
    details: any;
    ip?: string;
    userAgent?: string;
}

/**
 * Lista os campos que mudaram entre dois registros (para o histórico mostrar "antes → depois").
 * Datas são comparadas pelo instante e gravadas em ISO.
 */
export function diffCampos(antes: Record<string, any> | null | undefined, depois: Record<string, any>, campos: string[]) {
    const norm = (v: any) => v instanceof Date ? v.toISOString() : (v === undefined || v === "" ? null : v);
    return campos
        .filter(c => c in depois && norm(antes?.[c]) !== norm(depois[c]))
        .map(campo => ({ campo, antes: norm(antes?.[campo]), depois: norm(depois[campo]) }));
}

export async function createAuditLog({
    userId,
    userEmail,
    action,
    resource,
    resourceId,
    details,
    ip,
    userAgent
}: AuditLogParams) {
    try {
        return await prisma.auditLog.create({
            data: {
                userId,
                userEmail,
                action,
                resource,
                resourceId,
                details,
                ip,
                userAgent
            }
        });
    } catch (error) {
        console.error("Erro ao criar log de auditoria:", error);
    }
}
