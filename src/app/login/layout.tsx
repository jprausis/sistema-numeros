import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { homeForRole } from '@/lib/roleHome';

export const dynamic = 'force-dynamic';

// Quem já está logado (e tem perfil configurado) vai direto para o seu painel
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();
    if (user) redirect(homeForRole(user.role));

    return children;
}
