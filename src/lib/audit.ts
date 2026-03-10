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
