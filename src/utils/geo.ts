/**
 * Utilitário para conversão de coordenadas UTM para Lat/Long
 * Focado na Zona 22S (Rio Branco do Sul - PR)
 */

export function utmToLatLng(x: number, y: number): [number, number] {
    // Se os números forem pequenos (já estão em Lat/Long), retorna direto
    if (Math.abs(x) < 180 && Math.abs(y) < 180) {
        return [x, y];
    }

    // Algoritmo de conversão UTM para Lat/Long (WGS84 / SIRGAS 2000)
    // Para a Zona 22S (Hemisfério Sul, Meridiano Central -51)

    const utmX = x;
    const utmY = y;
    const zone = 22;
    const southHemi = true;

    const cgl_a = 6378137.0; // WGS84 Semi-major axis
    const cgl_f = 1 / 298.257223563; // WGS84 Flattening
    const cgl_b = cgl_a * (1 - cgl_f);
    const cgl_e = Math.sqrt(1 - (Math.pow(cgl_b, 2) / Math.pow(cgl_a, 2)));

    const utmCentralMeridian = (zone * 6 - 183) * (Math.PI / 180);
    const k0 = 0.9996;
    const e2 = Math.pow(cgl_e, 2);
    const e4 = Math.pow(e2, 2);
    const e6 = Math.pow(e4, 2);
    const ep2 = e2 / (1 - e2);

    const x_val = utmX - 500000.0;
    const y_val = southHemi ? utmY - 10000000.0 : utmY;

    const m = y_val / k0;
    const mu = m / (cgl_a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));

    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const phi1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
        + (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
        + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu)
        + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);

    const n1 = cgl_a / Math.sqrt(1 - e2 * Math.pow(Math.sin(phi1), 2));
    const t1 = Math.pow(Math.tan(phi1), 2);
    const c1 = ep2 * Math.pow(Math.cos(phi1), 2);
    const r1 = cgl_a * (1 - e2) / Math.pow(1 - e2 * Math.pow(Math.sin(phi1), 2), 1.5);
    const d = x_val / (n1 * k0);

    let lat = phi1 - (n1 * Math.tan(phi1) / r1) * (
        Math.pow(d, 2) / 2 - (5 + 3 * t1 + 10 * c1 - 4 * Math.pow(c1, 2) - 9 * ep2) * Math.pow(d, 4) / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * Math.pow(t1, 2) - 252 * ep2 - 3 * Math.pow(c1, 2)) * Math.pow(d, 6) / 720
    );

    let lon = utmCentralMeridian + (d - (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * Math.pow(c1, 2) + 8 * ep2 + 24 * Math.pow(t1, 2)) * Math.pow(d, 5) / 120) / Math.cos(phi1);

    return [lat * (180 / Math.PI), lon * (180 / Math.PI)];
}
