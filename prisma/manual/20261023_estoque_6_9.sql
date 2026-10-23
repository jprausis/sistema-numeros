-- Aplicado manualmente no Supabase em 23/10/2026.
-- 6 e 9 são a mesma peça: unifica no item "6/9"
insert into public."EstoqueItem" ("caractere", "quantidade", "updatedAt")
select '6/9', coalesce(sum("quantidade"), 0), current_timestamp
from public."EstoqueItem" where "caractere" in ('6', '9')
on conflict ("caractere") do update
  set "quantidade" = public."EstoqueItem"."quantidade" + excluded."quantidade",
      "updatedAt" = current_timestamp;

update public."EstoqueMovimento" set "caractere" = '6/9' where "caractere" in ('6', '9');

delete from public."EstoqueItem" where "caractere" in ('6', '9');
