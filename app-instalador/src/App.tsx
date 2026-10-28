import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { isNative } from './lib/native';
import { registrarLocalizacao } from './lib/localizacao';
import LoginPage from './pages/Login';
import InstallerDashboard from './pages/Painel';
import ImovelDetalhesPage from './pages/Imovel';

export default function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [session, setSession] = useState<Session | null | undefined>(undefined);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            // App aberto já logado: registra onde o instalador está
            if (data.session) registrarLocalizacao('ABERTURA');
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!isNative) return;
        StatusBar.setBackgroundColor({ color: '#15803d' }).catch(() => {});
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    }, []);

    // App volta do segundo plano: registra a localização de novo
    useEffect(() => {
        if (!isNative) return;
        const handle = CapApp.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) return;
            supabase.auth.getSession().then(({ data }) => {
                if (data.session) registrarLocalizacao('ABERTURA');
            });
        });
        return () => { handle.then(h => h.remove()); };
    }, []);

    // Botão "voltar" do Android: fecha a foto ampliada / volta de tela / sai do app no painel
    useEffect(() => {
        if (!isNative) return;
        const handle = CapApp.addListener('backButton', () => {
            const lightbox = document.querySelector('.lightbox') as HTMLElement | null;
            if (lightbox) { lightbox.click(); return; }
            if (location.pathname.startsWith('/imovel/')) navigate(-1);
            else CapApp.exitApp();
        });
        return () => { handle.then(h => h.remove()); };
    }, [location.pathname, navigate]);

    if (session === undefined) {
        return <div className="page-loading" style={{ minHeight: '100dvh' }}><Loader2 size={28} className="spin" />Carregando...</div>;
    }

    return (
        <Routes>
            {/* O login confere o perfil antes de entrar no painel */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={session ? <InstallerDashboard /> : <Navigate to="/login" replace />} />
            <Route path="/imovel/:id" element={session ? <ImovelDetalhesPage /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
