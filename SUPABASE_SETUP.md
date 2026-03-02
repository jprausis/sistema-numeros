# Guia de Configuração - Supabase

Siga estes passos para configurar seu projeto com o Supabase.

## 1. Criar Projeto
Acesse [app.supabase.com](https://app.supabase.com) e crie um novo projeto.

## 2. Criar Tabelas
1. No painel do Supabase, vá em **SQL Editor**.
2. Clique em **New Query**.
3. Copie o conteúdo do arquivo `schema.sql` (na raiz do projeto) e cole no editor.
4. Clique em **Run**.

## 3. Configurar Conexão (Next.js)
1. Vá em **Project Settings** > **Database**.
2. Copie a **Connection String** (use a opção **Transaction Connection** ou o formato URI direto).
3. No seu arquivo `.env`, atualize a variável `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://postgres:[SENHA]@[HOST]:5432/postgres?pgbouncer=true"
   ```

## 4. Sincronizar Prisma
Com o banco configurado, rode no terminal:
```bash
npx prisma generate
npx prisma db push
```

## 5. Recarregar Configurações
Rode o script de seed para garantir que o sistema tenha os parâmetros de agendamento:
```bash
npx tsx seed-config.ts
```

---
*Dica: Você pode visualizar os dados diretamente no painel do Supabase em **Table Editor**.*
