import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';

export const isNative = Capacitor.isNativePlatform();

/** Abre links externos (WhatsApp, Google Maps, fotos) no app correspondente do celular. */
export function abrirExterno(url: string) {
    if (isNative) {
        AppLauncher.openUrl({ url }).catch(() => { window.location.href = url; });
    } else {
        window.open(url, '_blank', 'noopener');
    }
}

/**
 * No app, links com target="_blank" e window.open não abrem nova janela na WebView:
 * redireciona para o app do sistema (WhatsApp, Maps, navegador).
 */
export function instalarLinksExternos() {
    if (!isNative) return;
    document.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
        if (!a || !/^https?:|^tel:|^mailto:/i.test(a.href)) return;
        if (a.target !== '_blank' && a.origin === window.location.origin) return;
        e.preventDefault();
        abrirExterno(a.href);
    }, true);
    window.open = ((url?: string | URL) => {
        if (url) abrirExterno(String(url));
        return null;
    }) as typeof window.open;
}
