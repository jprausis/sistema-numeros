'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { data, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        // Busca o perfil do usuário no nosso banco de dados (Prisma)
        const response = await fetch(`/api/auth/profile?email=${email}`);
        const profile = await response.json();

        if (profile?.role === 'ADMIN' || profile?.role === 'OPERATOR') {
            router.push('/admin');
        } else {
            router.push('/instalador');
        }
    };

    return (
        <div className={styles.container}>
            <form onSubmit={handleLogin} className={styles.card}>
                <h1 className={styles.title}>Acesso Restrito</h1>
                <p className={styles.subtitle}>Entre com suas credenciais de operador.</p>

                <div className={styles.formGroup}>
                    <label>Email</label>
                    <input
                        type="email"
                        className={styles.input}
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className={styles.formGroup}>
                    <label>Senha</label>
                    <input
                        type="password"
                        className={styles.input}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button type="submit" className={styles.button} disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                </button>


                <button type="button" onClick={() => router.back()} className={styles.backButton}>
                    Voltar ao Início
                </button>
            </form>
        </div>
    );
}
