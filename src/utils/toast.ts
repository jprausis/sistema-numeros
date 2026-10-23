/**
 * Notificações leves (toast) sem dependências, para substituir alert().
 * Uso: toast.success("Salvo!"), toast.error("Falhou"), toast.info("...").
 */
type ToastType = 'success' | 'error' | 'info';

const ICONS: Record<ToastType, string> = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
};

function getRegion(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    let region = document.getElementById('toast-region');
    if (!region) {
        region = document.createElement('div');
        region.id = 'toast-region';
        region.className = 'toast-region';
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        document.body.appendChild(region);
    }
    return region;
}

function show(message: string, type: ToastType = 'info', duration = 3800) {
    const region = getRegion();
    if (!region) return;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    if (type === 'error') el.setAttribute('role', 'alert');

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.innerHTML = ICONS[type];
    const text = document.createElement('span');
    text.textContent = message;
    el.append(icon, text);

    const remove = () => {
        el.classList.add('toast-leaving');
        setTimeout(() => el.remove(), 170);
    };
    el.addEventListener('click', remove);
    region.appendChild(el);
    setTimeout(remove, type === 'error' ? duration + 2000 : duration);
}

export const toast = {
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error'),
    info: (message: string) => show(message, 'info'),
};
