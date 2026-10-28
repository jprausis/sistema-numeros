# Rio Branco do Sul tem endereço

Sistema de gestão da instalação da numeração predial (Next.js + Prisma/PostgreSQL + Supabase Auth/Storage).

## Perfis

| Papel | Acesso |
|-------|--------|
| `ADMIN` | Painel completo: dashboard, imóveis, agendamentos, importação, usuários e auditoria |
| `OPERATOR` | Painel sem funções administrativas (sem importar, usuários ou auditoria) |
| `PREFEITURA` | Tela `/prefeitura`: libera imóveis/complementos, fotos de orientação e agendamentos |
| `PAINEL_PREFEITURA` | `/painel-prefeitura`: indicadores (geral, por bairro, ritmo, agendamentos, estoque), relatórios CSV por bairro e gestão de agendamentos. Toda alteração em agendamento vai para a Auditoria com o "antes → depois" |
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

## Estoque de algarismos (Admin → Estoque)

- Controla os caracteres físicos `0`–`9`, `C` e `S`. Entradas e ajustes de contagem são lançados manualmente (somente ADMIN).
- **Baixa automática:** quando um imóvel ou complemento passa para *Concluído*, cada caractere do número é descontado. Se o status sair de *Concluído*, os caracteres voltam (estorno). Toda movimentação fica em `EstoqueMovimento`.
- **Pendentes (previsão de produção):** imóveis com status *Liberado* ou *Ausente* + complementos liberados pela prefeitura ainda não instalados (exceto os marcados como pendentes). Visão geral e por bairro, com exportação em CSV.
- Instalações anteriores à criação do estoque não foram descontadas: registre a contagem física atual em "Ajustar contagem".
- Tabelas criadas pelo SQL em `prisma/manual/20261023_estoque.sql`.

Todas as datas e horários são tratados no fuso de Brasília (`src/lib/timezone.ts`).
