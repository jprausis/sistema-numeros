// Página inicial (painel) de cada papel após o login
export const ROLE_HOME: Record<string, string> = {
    ADMIN: '/admin',
    OPERATOR: '/admin',
    PREFEITURA: '/prefeitura',
    PAINEL_PREFEITURA: '/painel-prefeitura',
    INSTALLER: '/instalador',
};

export function homeForRole(role?: string | null) {
    return (role && ROLE_HOME[role]) || '/instalador';
}
