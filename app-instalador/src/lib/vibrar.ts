import { Haptics, NotificationType } from '@capacitor/haptics';
import { isNative } from './native';

/** Vibração de confirmação: o instalador sabe que salvou sem precisar olhar a tela. */
export function vibrar(tipo: 'sucesso' | 'aviso' | 'leve' = 'sucesso') {
    if (!isNative) {
        navigator.vibrate?.(tipo === 'leve' ? 30 : 120);
        return;
    }
    if (tipo === 'leve') Haptics.vibrate({ duration: 40 }).catch(() => {});
    else Haptics.notification({ type: tipo === 'sucesso' ? NotificationType.Success : NotificationType.Warning }).catch(() => {});
}
