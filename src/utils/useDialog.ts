'use client';

import { useEffect, useRef } from 'react';

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento de janela modal: fecha com Esc, mantém o Tab dentro da janela
 * e devolve o foco para quem abriu ao fechar. Use o ref no elemento do diálogo.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(aberto: boolean, onFechar: () => void) {
    const ref = useRef<T>(null);
    const fecharRef = useRef(onFechar);
    useEffect(() => {
        fecharRef.current = onFechar;
    });

    useEffect(() => {
        if (!aberto) return;
        const anterior = document.activeElement as HTMLElement | null;
        const focaveis = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCAVEIS) || []);

        // Campos com autoFocus já recebem o foco; senão vai para o primeiro controle
        const el = ref.current;
        if (el && !el.contains(document.activeElement)) (focaveis()[0] || el).focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                fecharRef.current();
                return;
            }
            if (e.key !== 'Tab') return;
            const lista = focaveis();
            if (lista.length === 0) return;
            const primeiro = lista[0];
            const ultimo = lista[lista.length - 1];
            if (e.shiftKey && document.activeElement === primeiro) {
                e.preventDefault();
                ultimo.focus();
            } else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault();
                primeiro.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            anterior?.focus?.();
        };
    }, [aberto]);

    return ref;
}
