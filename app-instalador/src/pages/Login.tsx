import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, MapPin } from 'lucide-react';
import styles from './Login.module.css';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { registrarLocalizacao } from '@/lib/localizacao';

// Perfis que podem usar o painel do instalador (mesmas permissões da API)
const PERFIS_PERMITIDOS = ['INSTALLER', 'ADMIN', 'OPERATOR'];

function traduzirErro(message: string) {
    if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(message)) return 'E-mail ainda não confirmado.';
    if (/network|fetch/i.test(message)) return 'Sem conexão com o servidor. Verifique sua internet.';
    return message;
}

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Já tem sessão salva no aparelho: vai direto para o painel
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) navigate('/', { replace: true });
        });
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (authError) {
                setError(traduzirErro(authError.message));
                setLoading(false);
                return;
            }

            // Perfil (papel) do usuário logado no nosso banco
            const response = await apiFetch('/api/auth/me');
            if (!response.ok) {
                await supabase.auth.signOut();
                setError('Seu acesso ainda não foi configurado. Fale com o administrador.');
                setLoading(false);
                return;
            }
            const { user } = await response.json();
            if (!PERFIS_PERMITIDOS.includes(user?.role)) {
                await supabase.auth.signOut();
                setError('Este aplicativo é exclusivo para instaladores. Use o sistema web.');
                setLoading(false);
                return;
            }
            registrarLocalizacao('LOGIN');
            navigate('/', { replace: true });
        } catch (err: any) {
            setError(traduzirErro(err?.message || 'Erro inesperado ao entrar.'));
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <form onSubmit={handleLogin} className={styles.card} noValidate={false}>
                <div className={styles.brand}>
                    <span className={styles.brandIcon}><MapPin size={22} /></span>
                    <span>Rio Branco do Sul <strong>tem endereço</strong></span>
                </div>

                <h1 className={styles.title}>Painel do Instalador</h1>
                <p className={styles.subtitle}>Entre com as credenciais fornecidas pela coordenação.</p>

                <div className={styles.formGroup}>
                    <label htmlFor="email">E-mail</label>
                    <div className={styles.inputWrapper}>
                        <Mail size={18} className={styles.inputIcon} aria-hidden />
                        <input
                            id="email"
                            type="email"
                            inputMode="email"
                            autoComplete="username"
                            className={styles.input}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required
                            autoFocus
                        />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="password">Senha</label>
                    <div className={styles.inputWrapper}>
                        <Lock size={18} className={styles.inputIcon} aria-hidden />
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            className={styles.input}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                        <button
                            type="button"
                            className={styles.togglePassword}
                            onClick={() => setShowPassword(v => !v)}
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                {error && <p className={styles.error} role="alert">{error}</p>}

                <button type="submit" className={styles.button} disabled={loading}>
                    {loading ? <><Loader2 size={18} className={styles.spin} /> Entrando...</> : 'Entrar'}
                </button>
            </form>
        </div>
    );
}
