-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'INSTALLER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Bairro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "dataImportacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalImoveis" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT
);

-- CreateTable
CREATE TABLE "Imovel" (
    "inscimob" TEXT NOT NULL PRIMARY KEY,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "numeroAInstalar" TEXT NOT NULL,
    "endereco" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NAO_INICIADO',
    "dataExecucao" DATETIME,
    "instaladorResp" TEXT,
    "fotos" TEXT,
    "obsPendente" TEXT,
    "bairroId" TEXT NOT NULL,
    CONSTRAINT "Imovel_bairroId_fkey" FOREIGN KEY ("bairroId") REFERENCES "Bairro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Agendamento" (
    "protocolo" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "enderecoCompleto" TEXT NOT NULL,
    "dataHora" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGENDADO',
    "inscimobVinculo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
