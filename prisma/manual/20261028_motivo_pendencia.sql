-- Motivo padronizado da pendência (botões do app do instalador), para relatórios do admin
ALTER TABLE "Imovel" ADD COLUMN IF NOT EXISTS "motivoPendencia" TEXT;
CREATE INDEX IF NOT EXISTS "Imovel_motivoPendencia_idx" ON "Imovel" ("motivoPendencia") WHERE "motivoPendencia" IS NOT NULL;
