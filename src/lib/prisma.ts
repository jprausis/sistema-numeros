import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prismaClientSingleton = () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({
        adapter,
        // Fora de todas as consultas por padrão: a malha (polígono do lote) é mais da metade do peso de
        // cada imóvel e só o mapa a usa (pede com `omit: { malha: false }`); a senha nunca deve sair do banco
        omit: {
            imovel: { malha: true },
            user: { password: true },
        },
    });
};

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
