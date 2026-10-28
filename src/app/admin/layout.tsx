'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Calendar, Home, LayoutDashboard, Loader2, LogOut, Map, Menu, Package, ShieldAlert, UploadCloud, Users, X,
    type LucideIcon
} from 'lucide-react';
import styles from './layout.module.css';
import { createClient } from '@/utils/supabase/client';

interface MenuItem {
    label: string;
    href: string;
    icon: LucideIcon;
    adminOnly?: boolean;
}

const MENU: MenuItem[] = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Bairros / Lotes', href: '/admin/bairros', icon: Map },
    { label: 'Imóveis', href: '/admin/imoveis', icon: Home },
    { label: 'Agendamentos', href: '/admin/agendamentos', icon: Calendar },
    { label: 'Estoque', href: '/admin/estoque', icon: Package },
    { label: 'Importar Dados', href: '/admin/importar', icon: UploadCloud, adminOnly: true },
    { label: 'Usuários', href: '/admin/usuarios', icon: Users, adminOnly: true },
    { label: 'Auditoria', href: '/admin/auditoria', icon: ShieldAlert, adminOnly: true },
];

const ROLE_LABEL: Record<string, string> = {
    ADMIN: 'Administrador',
    OPERATOR: 'Operador',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<{ name?: string; email?: string; role: string } | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (!res.ok) {
                    router.replace('/login');
                    return;
                }
                const data = await res.json();
                const role = data.user?.role;
                // Painel administrativo é exclusivo de ADMIN e OPERATOR
                if (role === 'PREFEITURA') return router.replace('/prefeitura');
                if (role === 'PAINEL_PREFEITURA') return router.replace('/painel-prefeitura');
                if (role !== 'ADMIN' && role !== 'OPERATOR') return router.replace('/instalador');
                setUser(data.user);
            } catch (error) {
                console.error("Erro ao buscar papel:", error);
                router.replace('/login');
            }
        };
        fetchUser();
    }, [router]);

    // Fecha o menu móvel ao navegar
    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    const handleLogout = async () => {
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

    const isAdmin = user.role === 'ADMIN';
    const items = MENU.filter(item => !item.adminOnly || isAdmin);
    const isActive = (href: string) => href === '/admin' ? pathname === href : pathname.startsWith(href);

    return (
        <div className={styles.adminContainer}>
            <header className={styles.mobileBar}>
                <button
                    type="button"
                    className={styles.menuToggle}
                    onClick={() => setMenuOpen(true)}
                    aria-label="Abrir menu"
                >
                    <Menu size={22} />
                </button>
                <strong>Painel de Gestão</strong>
            </header>

            {menuOpen && <div className={styles.backdrop} onClick={() => setMenuOpen(false)} aria-hidden />}

            <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`} aria-label="Menu principal">
                <div className={styles.logo}>
                    <span className={styles.logoMark}>Nº</span>
                    <div>
                        <strong>Rio Branco do Sul</strong>
                        <span>Painel de Gestão</span>
                    </div>
                    <button
                        type="button"
                        className={styles.closeMenu}
                        onClick={() => setMenuOpen(false)}
                        aria-label="Fechar menu"
                    >
                        <X size={20} />
                    </button>
                </div>
                <nav className={styles.nav}>
                    {items.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`${styles.navItem} ${isActive(href) ? styles.active : ''}`}
                            aria-current={isActive(href) ? 'page' : undefined}
                        >
                            <Icon size={18} className={styles.navIcon} aria-hidden />
                            <span className={styles.navLabel}>{label}</span>
                        </Link>
                    ))}
                </nav>
                <footer className={styles.sidebarFooter}>
                    <div className={styles.userCard}>
                        <span className={styles.avatar}>{(user.name || user.email || '?').charAt(0).toUpperCase()}</span>
                        <div className={styles.userInfo}>
                            <strong>{user.name || user.email}</strong>
                            <span>{ROLE_LABEL[user.role] || user.role}</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} className={styles.logoutButton}>
                        <LogOut size={18} aria-hidden />
                        Sair do Sistema
                    </button>
                </footer>
            </aside>
            <main className={styles.mainContent}>
                {children}
            </main>
        </div>
    );
}
