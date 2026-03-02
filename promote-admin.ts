import "dotenv/config";
import prisma from "./src/lib/prisma";

async function promoteToAdmin(email: string) {
    console.log(`Buscando usuário com email: ${email}...`);

    // Como o usuário foi criado via Supabase Auth, precisamos que ele faça o primeiro login
    // ou que você pegue o ID dele no painel do Supabase.

    // Vamos tentar localizar ou criar o perfil na nossa tabela de usuários do sistema
    try {
        const user = await prisma.user.upsert({
            where: { email: email },
            update: { role: 'ADMIN' },
            create: {
                id: email, // Usando o email como ID temporário se não tivermos o UUID do Supabase
                email: email,
                name: 'Administrador',
                role: 'ADMIN'
            }
        });

        console.log(`✅ Sucesso! O usuário ${email} agora é ADMIN.`);
        console.log(`Detalhes:`, user);
    } catch (error) {
        console.error(`❌ Erro ao promover usuário:`, error);
    }
}

// Pega o email dos argumentos do comando: npx tsx promote-admin.ts email@exemplo.com
const emailArg = process.argv[2];

if (!emailArg) {
    console.error("Por favor, informe o email. Exemplo: npx tsx promote-admin.ts admin@site.com");
} else {
    promoteToAdmin(emailArg);
}
