import { utmToLatLng } from '@/utils/geo';

export type Posicao = { lat: number; lon: number; precisao: number | null; em: number };

/** Posição atual do GPS (null se negado, indisponível ou demorar demais). */
export function obterPosicao(timeout = 12000): Promise<Posicao | null> {
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, precisao: pos.coords.accuracy ?? null, em: pos.timestamp || Date.now() }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout, maximumAge: 30000 }
        );
    });
}

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function distanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const rad = (g: number) => g * Math.PI / 180;
    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Distância do celular até o imóvel (coordenadas x/y do cadastro), ou null sem coordenadas. */
export function distanciaAteImovel(pos: Posicao, imovel: { x?: number; y?: number } | null): number | null {
    if (!imovel?.x || !imovel?.y) return null;
    const [lat, lon] = utmToLatLng(imovel.x, imovel.y);
    return distanciaMetros(pos.lat, pos.lon, lat, lon);
}

export const formatarDistancia = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
