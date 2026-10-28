import { supabase } from './supabase';

/** Endereço do sistema web (mesma API e mesma base de dados). */
export const API_URL = (import.meta.env.VITE_API_URL || 'https://sistema-numeros.vercel.app').replace(/\/+$/, '');

/**
 * fetch para a API do sistema: prefixa o servidor e envia o token do Supabase
 * (o app não tem os cookies do site, então a API aceita `Authorization: Bearer`).
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);

    const res = await fetch(`${API_URL}${path}`, { ...init, headers });

    // Sessão expirada ou removida: volta para o login
    if (res.status === 401 && !path.startsWith('/api/auth/me')) {
        await supabase.auth.signOut();
        window.location.hash = '#/login';
    }
    return res;
}
