'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, Home, LayoutDashboard, Loader2, LogOut } from 'lucide-react';
import styles from './layout.module.css';
import { createClient } from '@/utils/supabase/client';

const ROLES_PERMITIDOS = ['PAINEL_PREFEITURA', 'ADMIN', 'OPERATOR'];

const MENU = [
    { label: 'Visão geral', href: '/painel-prefeitura', icon: LayoutDashboard },
    { label: 'Imóveis', href: '/painel-prefeitura/imoveis', icon: Home },
    { label: 'Agendamentos', href: '/painel-prefeitura/agendamentos', icon: CalendarDays },
];

export default function PainelPrefeituraLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<{ name?: string; email?: string; role: string } | null>(null);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => {
                const role = data.user?.role;
                if (role === 'PREFEITURA') return router.replace('/prefeitura');
                if (!ROLES_PERMITIDOS.includes(role)) return router.replace('/instalador');
                setUser(data.user);
            })
            .catch(() => router.replace('/login'));
    }, [router]);

    const sair = async () => {
        await createClient().auth.signOut();
        router.push('/login');
    };

    if (!user) {
        return (
            <div className="page-loading" style={{ minHeight: '100vh' }}>
                <Loader2 size={28} className="spin" />
                Carregando painel...
            </div>
        );
    }

    const isActive = (href: string) => href === '/painel-prefeitura' ? pathname === href : pathname.startsWith(href);

    return (
        <div className={styles.page}>
            <header className={styles.topBar}>
                <div className={styles.brand}>
                    <span className={styles.logoMark}>Nº</span>
                    <div>
                        <strong>Rio Branco do Sul tem endereço</strong>
                        <span>Painel da Prefeitura</span>
                    </div>
                </div>
                <nav className={styles.nav} aria-label="Menu do painel">
                    {MENU.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`${styles.navItem} ${isActive(href) ? styles.active : ''}`}
                            aria-current={isActive(href) ? 'page' : undefined}
                        >
                            <Icon size={16} aria-hidden /> {label}
                        </Link>
                    ))}
                </nav>
                <div className={styles.userArea}>
                    <span className={styles.userName}>{user.name || user.email}</span>
                    <button type="button" onClick={sair} className={styles.btnGhost}>
                        <LogOut size={16} aria-hidden /> Sair
                    </button>
                </div>
            </header>
            <main className={styles.main}>{children}</main>
        </div>
    );
}
