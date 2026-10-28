/** Nome usado antigamente quando o agendamento era salvo sem o nome do morador. */
export const NOME_PADRAO_AGENDAMENTO = "Morador / Prefeitura";

/**
 * Nome e telefone do morador são obrigatórios nos agendamentos.
 * Retorna a mensagem de erro, ou null se estiver tudo certo.
 */
export function validarContato(nome: unknown, telefone: unknown): string | null {
    const n = String(nome ?? "").trim();
    if (!n || n === NOME_PADRAO_AGENDAMENTO) return "Informe o nome do morador.";
    if (String(telefone ?? "").replace(/\D/g, "").length < 10) return "Informe um telefone válido com DDD.";
    return null;
}
