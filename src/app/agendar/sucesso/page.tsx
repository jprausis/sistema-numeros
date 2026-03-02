'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import styles from '../page.module.css';

function SucessoContent() {
    const searchParams = useSearchParams();
    const protocolo = searchParams.get('protocolo');

    return (
        <div className={styles.container} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h1 className={styles.title}>Agendamento Confirmado!</h1>
            <p className={styles.subtitle}>Sua solicitação foi registrada com sucesso.</p>

            <div style={{
                background: 'var(--accent)',
                padding: '2rem',
                borderRadius: 'var(--radius)',
                margin: '2rem 0',
                border: '1px dashed var(--primary)'
            }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--secondary)', marginBottom: '0.5rem' }}>Protocolo de Acompanhamento</p>
                <h2 style={{ fontSize: '2rem', color: 'var(--primary)', letterSpacing: '2px' }}>{protocolo}</h2>
            </div>

            <p style={{ color: 'var(--secondary)', marginBottom: '2rem' }}>
                A instalação será realizada no dia e horário selecionados.
                Mantenha o local acessível para nossos instaladores.
            </p>

            <Link href="/" className={styles.submitButton} style={{ display: 'inline-block', textDecoration: 'none' }}>
                Voltar para o Início
            </Link>
        </div>
    );
}

export default function SucessoPage() {
    return (
        <Suspense fallback={<div className="container text-center">Carregando...</div>}>
            <SucessoContent />
        </Suspense>
    );
}
