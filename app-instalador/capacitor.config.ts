import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'br.com.projemix.instalador',
    appName: 'Instalador Numeração',
    webDir: 'dist',
    android: {
        // Conteúdo abaixo da barra de status/navegação (Android 15+ força edge-to-edge)
        adjustMarginsForEdgeToEdge: 'force',
    },
    plugins: {
        StatusBar: { backgroundColor: '#15803d', style: 'DARK' },
    },
};

export default config;
