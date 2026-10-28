import { apiFetch } from './api';

type Evento = 'LOGIN' | 'ABERTURA';

// Evita registros repetidos quando o app vai e volta do segundo plano em sequência
const INTERVALO_MINIMO_MS = 2 * 60 * 1000;
let ultimoEnvio = 0;

/**
 * Registra a posição do instalador no sistema (aparece no mapa do painel admin).
 * Falhas de GPS ou de rede são ignoradas: não atrapalham o uso do app.
 */
export function registrarLocalizacao(evento: Evento) {
    if (!navigator.geolocation) return;
    if (evento === 'ABERTURA' && Date.now() - ultimoEnvio < INTERVALO_MINIMO_MS) return;
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
