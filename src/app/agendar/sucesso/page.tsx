'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { CheckCircle2 } from 'lucide-react';
import styles from '../page.module.css';

function SucessoContent() {
    const searchParams = useSearchParams();
    const protocolo = searchParams.get('protocolo');

    return (
        <div className={styles.page}>
            <div className={`${styles.container} ${styles.success}`}>
                <CheckCircle2 size={64} className={styles.successIcon} aria-hidden />
                <h1 className={styles.title}>Solicitação recebida!</h1>
                <p className={styles.subtitle}>Seus dados foram registrados com sucesso.</p>

                {protocolo && (
                    <div className={styles.protocolBox}>
                        <span>Protocolo de acompanhamento</span>
                        <strong>{protocolo}</strong>
                    </div>
                )}

                <p className={styles.subtitle}>
                    Guarde este número. A equipe entrará em contato em breve para combinar os detalhes da instalação.
                </p>

                <Link href="/" className={styles.submitButton}>Voltar para o início</Link>
            </div>
        </div>
    );
}

export default function SucessoPage() {
    return (
        <Suspense fallback={<div className="page-loading">Carregando...</div>}>
            <SucessoContent />
        </Suspense>
    );
}
