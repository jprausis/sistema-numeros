'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './layout.module.css';
import { createClient } from '@/utils/supabase/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const menuItems = [
        { label: 'Dashboard', href: '/admin' },
        { label: 'Bairros / Lotes', href: '/admin/bairros' },
        { label: 'Imóveis (Base)', href: '/admin/imoveis' },
        { label: 'Agendamentos', href: '/admin/agendamentos' },
        { label: 'Importar XLS', href: '/admin/importar' },

        { label: 'Usuários', href: '/admin/usuarios' },
        { label: 'Configurações', href: '/admin/configuracoes' },

    ];

    return (
        <div className={styles.adminContainer}>
            <aside className={styles.sidebar}>
                <div className={styles.logo}>
                    <strong>Admin</strong>
                    <span>Painel de Gestão</span>
                </div>
                <nav className={styles.nav}>
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <footer className={styles.sidebarFooter}>
                    <button onClick={handleLogout} className={styles.logoutButton}>Sair do Sistema</button>
                </footer>
            </aside>
            <main className={styles.mainContent}>
                {children}
            </main>
        </div>
    );
}
