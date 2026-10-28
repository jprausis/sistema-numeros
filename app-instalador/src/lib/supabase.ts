import { createClient } from '@supabase/supabase-js';

// Sessão salva no aparelho: o instalador entra uma vez e o app já abre no painel
export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
        },
    }
);
