# Configuração de Autenticação - Supabase

Siga estes passos para habilitar o login no seu projeto.

## 1. No Dashboard do Supabase
1. Vá em **Authentication** > **Providers**.
2. Garanti que **Email** esteja **Enabled**.
3. (Opcional) Desative "Confirm Email" se quiser permitir login imediato após cadastro em ambiente de teste.

## 2. Instalar Dependências
Rode no terminal:
```bash
npm install @supabase/ssr @supabase/supabase-js
```

## 3. Variáveis de Ambiente
Adicione ao seu `.env`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 4. Integração com Prisma
Como já temos a tabela `User` no banco de dados, você tem duas opções:
- **Opção A (Simples):** Continuar usando o login que eu criei, validando a senha via Prisma/BCrypt (mais fácil de manter o código atual).
- **Opção B (Robusta):** Usar o `supabase.auth.signInWithPassword`.

### Recomendação
Para este projeto, como já temos os perfis (Role) na tabela `User` do Prisma, recomendo manter a lógica no Next.js mas apontando para o banco do Supabase. Assim o sistema de permissões atual continua funcionando 100%.

Se quiser migrar o processo de login para o Supabase Auth nativo, eu posso gerar os arquivos de `middleware.ts` e o cliente auth para você. Deseja prosseguir com a migração total para Supabase Auth?
