# Guia de Configuração - PocketBase

Siga estes passos para configurar seu servidor PocketBase para o projeto.

## 1. Instalação
1. Baixe o executável em [pocketbase.io](https://pocketbase.io).
2. Execute o comando: `./pocketbase serve`.
3. Acesse o Admin UI em `http://127.0.0.1:8090/_/`.

## 2. Estrutura de Coleções

### Coleção: `users` (Já existe por padrão)
- Adicione o campo `role` (Select: ADMIN, OPERATOR, INSTALLER).

### Coleção: `bairros`
- `nome` (Plain text, Required)
- `status` (Select: ATIVO, ARQUIVADO, default: ATIVO)
- `observacoes` (Plain text)

### Coleção: `imoveis`
- `inscimob` (Plain text, Unique, Required)
- `x` (Number, Required)
- `y` (Number, Required)
- `numeroAInstalar` (Plain text, Required)
- `endereco` (Plain text)
- `status` (Select: NAO_INICIADO, CONCLUIDO, PENDENTE, default: NAO_INICIADO)
- `dataExecucao` (DateTime)
- `instaladorResp` (Relation: users, Single)
- `fotos` (Plain text)
- `obsPendente` (Plain text)
- `bairroId` (Relation: bairros, Single, Required)

### Coleção: `agendamentos`
- `protocolo` (Plain text, Unique, Required)
- `nome` (Plain text, Required)
- `telefone` (Plain text, Required)
- `enderecoCompleto` (Plain text, Required)
- `dataHora` (DateTime, Required)
- `status` (Select: AGENDADO, EM_ROTA, CONCLUIDO, REAGENDAR, CANCELADO, PENDENTE, default: AGENDADO)
- `inscimobVinculo` (Plain text)

### Coleção: `config`
- `key` (Plain text, Unique, Required)
- `value` (Plain text, Required)

## 3. Regras de Acesso (API Rules)
Para agilizar o desenvolvimento, você pode definir as regras de `List/Search`, `View`, `Create`, `Update` como `Admin Only` ou abertas para o público se estiver em ambiente seguro, mas o ideal é:
- **agendamentos (Create)**: Público (para moradores agendarem).
- **Demais**: Apenas usuários autenticados.
