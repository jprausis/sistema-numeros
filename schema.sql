-- Script SQL para Configuração do Supabase

-- Tabela de Usuários (Extensão do Auth do Supabase ou Tabela Própria)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT,
    "email" TEXT UNIQUE,
    "password" TEXT,
    "role" TEXT DEFAULT 'INSTALLER',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Bairros (Lotes)
CREATE TABLE IF NOT EXISTS "Bairro" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "dataImportacao" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "totalImoveis" INTEGER DEFAULT 0,
    "status" TEXT DEFAULT 'ATIVO',
    "observacoes" TEXT
);

-- Tabela de Imóveis
CREATE TABLE IF NOT EXISTS "Imovel" (
    "inscimob" TEXT PRIMARY KEY,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "numeroAInstalar" TEXT NOT NULL,
    "endereco" TEXT,
    "status" TEXT DEFAULT 'NAO_INICIADO',
    "dataExecucao" TIMESTAMP WITH TIME ZONE,
    "instaladorResp" TEXT,
    "fotos" TEXT,
    "obsPendente" TEXT,
    "bairroId" TEXT NOT NULL REFERENCES "Bairro"("id") ON DELETE CASCADE
);

-- Tabela de Agendamentos
CREATE TABLE IF NOT EXISTS "Agendamento" (
    "protocolo" TEXT PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "enderecoCompleto" TEXT NOT NULL,
    "dataHora" TIMESTAMP WITH TIME ZONE NOT NULL,
    "status" TEXT DEFAULT 'AGENDADO',
    "inscimobVinculo" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Configurações Dinâmicas
CREATE TABLE IF NOT EXISTS "Config" (
    "key" TEXT PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
