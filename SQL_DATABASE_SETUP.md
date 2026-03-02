# Guia de Configuração: Banco de Dados SQL Externo

Este guia explica como conectar o sistema a um banco de dados SQL robusto (PostgreSQL, MySQL ou SQL Server).

## 1. Escolha do Banco de Dados
O sistema utiliza **Prisma ORM**, o que facilita a troca de banco. Recomendamos o uso de **PostgreSQL** para melhor compatibilidade com as funcionalidades do Next.js.

### Exemplo de Strings de Conexão (DATABASE_URL):
- **PostgreSQL:** `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`
- **MySQL:** `mysql://USER:PASSWORD@HOST:PORT/DATABASE`
- **SQL Server:** `sqlserver://HOST:PORT;database=DATABASE;user=USER;password=PASSWORD;encrypt=true`

---

## 2. Passo a Passo da Migração

### Passo A: Atualizar o arquivo `.env`
No arquivo `.env` na raiz do projeto, substitua a linha da `DATABASE_URL` pela string do seu banco:
```env
# Exemplo para PostgreSQL (ex: Supabase, Neon, Render ou Local)
DATABASE_URL="postgresql://postgres:senha_secreta@localhost:5432/sistema_numeros?schema=public"
```

### Passo B: Atualizar o `schema.prisma`
Abra o arquivo `prisma/schema.prisma` e altere o `provider` para o seu banco:
```prisma
datasource db {
  provider = "postgresql" // ou "mysql" ou "sqlserver"
  url      = env("DATABASE_URL")
}
```

### Passo C: Sincronizar o Banco
Abra o terminal na pasta do projeto e execute os comandos:
1. **Gerar o Client:**
   ```bash
   npx prisma generate
   ```
2. **Criar as Tabelas no novo banco:**
   ```bash
   npx prisma migrate dev --name init_sql
   ```

---

## 3. Dicas de Infraestrutura
Se você estiver subindo para produção:
- **Hospedagem de Banco:** [Supabase](https://supabase.com) (PostgreSQL) ou [Neon.tech](https://neon.tech) são excelentes opções gratuitas/baixas.
- **PGBouncer:** Se usar PostgreSQL, lembre-se de adicionar `?pgbouncer=true` se o seu provedor exigir para conexões serverless.

---
*Dúvidas? Entre em contato com o suporte do projeto.*
