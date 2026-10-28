import { apiFetch } from './api';

type Evento = 'LOGIN' | 'ABERTURA' | 'EXPEDIENTE';

// Evita registros repetidos quando o app vai e volta do segundo plano em sequência
const INTERVALO_MINIMO_MS = 2 * 60 * 1000;
let ultimoEnvio = 0;

/**
 * Registra a posição do instalador no sistema (aparece no mapa do painel admin).
 * Falhas de GPS ou de rede são ignoradas: não atrapalham o uso do app.
 */
export function registrarLocalizacao(evento: Evento) {
    if (!navigator.geolocation) return;
    if (evento !== 'LOGIN' && Date.now() - ultimoEnvio < INTERVALO_MINIMO_MS) return;
    ultimoEnvio = Date.now();

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            apiFetch('/api/instalador/localizacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    precisao: pos.coords.accuracy,
                    evento,
                }),
            }).catch(() => {});
        },
        () => { ultimoEnvio = 0; },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
}

// Com o app aberto, a posição é enviada a cada 10 minutos (o Android pausa o app em segundo plano)
const INTERVALO_EXPEDIENTE_MS = 10 * 60 * 1000;

/** Envio periódico da localização enquanto o app está aberto. Retorna a função para parar. */
export function iniciarLocalizacaoExpediente(): () => void {
    const timer = window.setInterval(() => {
        if (document.visibilityState === 'visible') registrarLocalizacao('EXPEDIENTE');
    }, INTERVALO_EXPEDIENTE_MS);
    return () => window.clearInterval(timer);
}

const CHAVE_AVISO = 'avisoLocalizacaoVisto';

/** Aviso (LGPD) de que a localização é registrada: mostrado uma vez por aparelho. */
export function precisaAvisoLocalizacao(): boolean {
    try { return localStorage.getItem(CHAVE_AVISO) !== '1'; } catch { return false; }
}

export function marcarAvisoLocalizacaoVisto() {
    try { localStorage.setItem(CHAVE_AVISO, '1'); } catch { /* ignora */ }
}
