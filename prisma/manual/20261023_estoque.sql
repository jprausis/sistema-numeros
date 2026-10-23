-- Aplicado manualmente no Supabase em 23/10/2026 (as migrations em prisma/migrations são antigas, de SQLite).
create table if not exists public."EstoqueItem" (
  "caractere" text primary key,
  "quantidade" integer not null default 0,
  "updatedAt" timestamp(3) without time zone not null default current_timestamp
);

create table if not exists public."EstoqueMovimento" (
  "id" text primary key,
  "caractere" text not null,
  "quantidade" integer not null,
  "tipo" text not null,
  "referencia" text,
  "descricao" text,
  "userEmail" text,
  "createdAt" timestamp(3) without time zone not null default current_timestamp
);

create index if not exists "EstoqueMovimento_createdAt_idx" on public."EstoqueMovimento" ("createdAt");
create index if not exists "EstoqueMovimento_tipo_createdAt_idx" on public."EstoqueMovimento" ("tipo", "createdAt");

-- Sem políticas: bloqueia a API pública; o app acessa via Prisma (usuário postgres, bypass RLS)
alter table public."EstoqueItem" enable row level security;
alter table public."EstoqueMovimento" enable row level security;

insert into public."EstoqueItem" ("caractere", "quantidade")
values ('0',0),('1',0),('2',0),('3',0),('4',0),('5',0),('6',0),('7',0),('8',0),('9',0),('C',0),('S',0)
on conflict ("caractere") do nothing;
