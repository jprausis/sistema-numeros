-- Observação opcional do instalador ao concluir a instalação (exibida na linha do tempo do admin)
ALTER TABLE "Imovel" ADD COLUMN IF NOT EXISTS "obsInstalacao" TEXT;
