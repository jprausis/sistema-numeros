# Guia Geral de Funções - Sistema de Numeração Residencial

Este documento descreve todas as funcionalidades e regras de negócio do sistema, conforme a especificação técnica v1.0.

## 1. Objetivo do Sistema
Centralizar o controle das instalações de números residenciais, permitindo o agendamento por moradores e a execução operacional casa a casa baseada em cadastros municipais.

---

## 2. Perfis de Acesso

### 🏠 Morador (Público)
- **Ação principal:** Criar agendamento para instalação do número.
- **Campos:** Nome, Telefone, Endereço completo (Rua, Número, Bairro), Data/Hora.
- **Saída:** Confirmação com número de protocolo (ex: AG-000123).

### 🛠️ Instalador (Restrito)
- **Dashboard:** Resumo do dia e atalhos rápidos.
- **Agendamentos:** Lista de serviços marcados com atalho para Google Maps.
- **Mapa:** Visualização de imóveis importados (Pins: Verde=Concluído, Amarelo=Pendente, Vermelho=Não Iniciado).
- **Modo GPS ("Estou no Local"):** Busca automática dos 3 imóveis mais próximos (raio de 30-80m).
- **Execução:** Atualização de status, envio de foto comprobatória e registro de observações.

### 💼 Administrador / Operador (Restrito)
- **Dashboards:** Indicadores de progresso e alertas de pendências.
- **Gestão de Lotes:** Importação de planilhas XLS (inscimob, x, y, Número).
- **Gestão de Usuários:** Cadastro de instaladores e outros operadores.
- **Regras de Agenda:** Configuração de horários, slots e bloqueios manuais.
- **Relatórios:** Exportação de dados em CSV/PDF para a prefeitura.

---

## 3. Regras de Negócio de Agendamento
- **Janela de Tempo:** Segunda a Sábado, das 08:00 às 19:00.
- **Duração do Slot:** 15 minutos.
- **Capacidade:** 1 atendimento por slot (configurável).
- **Antecedência:** Mínimo de 1 dia (não permite agendar para o próprio dia).
- **Horizonte:** Agenda liberada para 7 dias subsequentes.

---

## 4. Fluxo de Importação Municipal
- **Tipo de Arquivo:** XLS / XLSX.
- **Colunas Obrigatórias:** `inscimob`, `x`, `y`, `Número`.
- **Validações:** Impede duplicidade de `inscimob` e normaliza coordenadas.
- **Lotes:** Cada importação é agrupada por Bairro/Categoria para controle de execução.

---

## 5. Requisitos Técnicos de Execução
- **Fotos:** Compressão automática para 1600px antes do armazenamento para economia de dados.
- **Traceabilidade:** O sistema registra quem executou, quando e as coordenadas GPS no momento da conclusão.
- **Mapa:** Utiliza clusterização para performance com milhares de pontos.

---
*Documento gerado em 01/03/2026.*
