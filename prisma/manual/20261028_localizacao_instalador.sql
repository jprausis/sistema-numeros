-- Aplicado manualmente no Supabase em 28/10/2026.
-- Localização do instalador registrada pelo app Android ao fazer login e ao abrir o app.
create table if not exists public."LocalizacaoInstalador" (
  "id" text primary key,
  "userId" text not null,
  "userNome" text,
  "userEmail" text,
  "lat" double precision not null,
  "lon" double precision not null,
  "precisao" double precision,
  "evento" text not null,
  "createdAt" timestamp(3) without time zone not null default current_timestamp
);

create index if not exists "LocalizacaoInstalador_userId_createdAt_idx" on public."LocalizacaoInstalador" ("userId", "createdAt");
create index if not exists "LocalizacaoInstalador_createdAt_idx" on public."LocalizacaoInstalador" ("createdAt");

-- Sem políticas: bloqueia a API pública; o sistema acessa via Prisma (usuário postgres, bypass RLS)
alter table public."LocalizacaoInstalador" enable row level security;
