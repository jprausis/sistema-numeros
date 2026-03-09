import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const prisma = new PrismaClient()

async function sync() {
    console.log("Buscando usuários no Supabase Auth...")
    const { data: { users }, error } = await supabase.auth.admin.listUsers()

    if (error) {
        console.error("Erro ao listar usuários:", error)
        return
    }

    console.log(`Encontrados ${users.length} usuários. Sincronizando com Prisma...`)

    for (const user of users) {
        const existing = await prisma.user.findUnique({ where: { id: user.id } })

        if (!existing) {
            console.log(`Criando perfil para: ${user.email}`)
            await prisma.user.create({
                data: {
                    id: user.id,
                    email: user.email!,
                    name: user.user_metadata?.name || null,
                    role: user.user_metadata?.role || 'ADMIN' // Por segurança, se for o admin rodando, define como ADMIN
                }
            })
        } else {
            console.log(`Usuário já existe: ${user.email} (Role: ${existing.role})`)
        }
    }
}

sync()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
