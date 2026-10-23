# Rio Branco do Sul tem endereço

Sistema de gestão da instalação da numeração predial (Next.js + Prisma/PostgreSQL + Supabase Auth/Storage).

## Perfis

| Papel | Acesso |
|-------|--------|
| `ADMIN` | Painel completo: dashboard, imóveis, agendamentos, importação, usuários e auditoria |
| `OPERATOR` | Painel sem funções administrativas (sem importar, usuários ou auditoria) |
| `PREFEITURA` | Tela `/prefeitura`: libera imóveis/complementos, fotos de orientação e agendamentos |
| `INSTALLER` | Tela `/instalador`: mapa, agenda, busca por GPS e registro das instalações com foto |

Páginas públicas: `/` (informações ao morador) e `/agendar` (formulário de contato, vai para a aba "Lista de Contatos" dos agendamentos).

## Variáveis de ambiente (`.env`)

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # usado só no servidor (criação de usuários e upload)
```

As fotos ficam no bucket público `fotos-imoveis` do Supabase Storage.

## Desenvolvimento

```bash
npm install
npm run dev
```

Usuários são criados pelo painel em **Usuários** (Supabase Auth + tabela `User` com o mesmo ID).

## Importação de dados (Admin → Importar Dados)

1. Planilha de imóveis (`inscimob`, `x`, `y`, `Número`) — cria o bairro/lote
2. Malha GeoJSON dos lotes (vinculada por `inscimob`)
3. Planilha de complementos (`unidade`, `indicacaof`, `número predial`)
4. GeoJSON com a posição dos complementos

Coordenadas em UTM (zona 22S) são convertidas automaticamente para latitude/longitude.

Todas as datas e horários são tratados no fuso de Brasília (`src/lib/timezone.ts`).
