'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Filter, Layers, List } from 'lucide-react';
import styles from './map.module.css';
import { utmToLatLng } from '@/utils/geo';
import { parseFotos, fotoDestaque } from '@/utils/fotos';
import { STATUS_COLORS, statusLabel } from '@/utils/status';

// Ícones dos pinos (cor = status do imóvel principal)
const getIcon = (status: string, isSelected: boolean = false) => {
    const color = STATUS_COLORS[status] || STATUS_COLORS.NAO_INICIADO;

    const size = isSelected ? 18 : 14;
    const border = isSelected ? '3px solid #000' : '2px solid #fff';

    return L.divIcon({
        className: styles.markerIcon || '',
        html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${border}; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
};

const userLocationIcon = L.divIcon({
    className: '',
    html: `<div class="${styles.userDot}"><span></span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
});

const LEGEND = ['NAO_INICIADO', 'LIBERADO', 'AGENDADO', 'AUSENTE', 'PENDENTE', 'CONCLUIDO'];

// Componente para controlar posicionamento e redimensionamento do Leaflet
function MapEffect({ focusOn, userLocation, layerType }: { focusOn?: [number, number] | null, userLocation?: { lat: number, lon: number } | null, layerType: string }) {
    const map = useMap();
    const hasCenteredUser = useRef<boolean>(false);
    const lastFocusedCoord = useRef<string | null>(null);

    useEffect(() => {
        // Pequeno delay para garantir que o DOM já tenha as dimensões
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 100);
        return () => clearTimeout(timer);
    }, [map, layerType]);

    // Foco em coordenada de imóvel (tem prioridade máxima)
    useEffect(() => {
        if (focusOn && typeof focusOn[0] === 'number' && typeof focusOn[1] === 'number') {
            const coordKey = `${focusOn[0]},${focusOn[1]}`;
            if (lastFocusedCoord.current !== coordKey) {
                lastFocusedCoord.current = coordKey;
                // Impede que a localização do usuário sobreponha o imóvel solicitado
                hasCenteredUser.current = true;
                const [lat, lng] = utmToLatLng(focusOn[0], focusOn[1]);
                map.setView([lat, lng], 18, { animate: true });
            }
        } else if (!focusOn) {
            lastFocusedCoord.current = null;
        }
    }, [focusOn, map]);

    // Centralizar no usuário APENAS se não houver imóvel com foco solicitado e ainda não tiver centralizado
    useEffect(() => {
        if (!focusOn && userLocation && !hasCenteredUser.current) {
            hasCenteredUser.current = true;
            map.setView([userLocation.lat, userLocation.lon], 16);
        }
    }, [focusOn, userLocation, map]);

    return null;
}

interface Property {
    inscimob: string;
    x: number;
    y: number;
    numeroAInstalar: string;
    status: string;
    bairro: { nome: string };
    fotos?: string;
    fotoLocalInstalacao?: string;
    malha?: any; // Geometria GeoJSON
    complementos?: any[];
}

export default function InstallerMap({
    properties,
    focusOn,
    userLocation,
    onEdit,
    onFilterClick,
    filterActive
}: {
    properties: Property[],
    focusOn?: [number, number] | null,
    userLocation?: { lat: number, lon: number } | null,
    onEdit?: (p: any) => void,
    onFilterClick?: () => void,
    filterActive?: boolean
}) {
    const [isMounted, setIsMounted] = useState(false);
    const [layerType, setLayerType] = useState<'street' | 'satellite'>('street');
    const [mapRef, setMapRef] = useState<L.Map | null>(null);
    const [selectedInsc, setSelectedInsc] = useState<string | null>(null);
    const [showLegend, setShowLegend] = useState(false);
    const markerRefs = useRef<Map<string, L.Marker>>(new Map());

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Sincronizar selectedInsc quando focusOn for fornecido
    useEffect(() => {
        if (focusOn && properties.length > 0) {
            // focusOn vem exatamente de property.x/y; comparação por tolerância selecionava
            // o imóvel errado quando as coordenadas estão em graus (lat/lng)
            const target = properties.find(p => p.x === focusOn[0] && p.y === focusOn[1]);
            if (target) {
                setSelectedInsc(target.inscimob);
            }
        }
    }, [focusOn, properties]);

    // Abrir popup do imóvel focado
    useEffect(() => {
        if (selectedInsc) {
            const marker = markerRefs.current.get(selectedInsc);
            if (marker) {
                const timer = setTimeout(() => {
                    marker.openPopup();
                }, 150);
                return () => clearTimeout(timer);
            }
        }
    }, [selectedInsc]);

    if (!isMounted) return <div className={styles.loader}>Iniciando GPS...</div>;

    const mapCenter: [number, number] = focusOn
        ? utmToLatLng(focusOn[0], focusOn[1])
        : userLocation
            ? [userLocation.lat, userLocation.lon]
            : [-25.187883706053842, -49.314766448822134];

    const selectedProperty = properties.find(p => p.inscimob === selectedInsc);

    return (
        <div className={styles.mapWrapper} style={{ flex: 1, minHeight: '500px', height: '100%', position: 'relative' }}>
            {/* Botão de Alternância - Fora do MapContainer para evitar erros de renderização */}
            <div className={styles.mapControls}>
                <button
                    type="button"
                    className={`${styles.controlBtn} ${layerType === 'satellite' ? styles.controlActive : ''}`}
                    onClick={() => setLayerType(prev => prev === 'street' ? 'satellite' : 'street')}
                    title={layerType === 'street' ? 'Ver satélite' : 'Ver mapa de ruas'}
                    aria-label={layerType === 'street' ? 'Ver satélite' : 'Ver mapa de ruas'}
                >
                    <Layers size={20} />
                </button>

                {userLocation && (
                    <button
                        type="button"
                        className={styles.controlBtn}
                        onClick={() => mapRef?.setView([userLocation.lat, userLocation.lon], 18)}
                        title="Minha localização"
                        aria-label="Centralizar na minha localização"
                    >
                        <Crosshair size={20} />
                    </button>
                )}

                {onFilterClick && (
                    <button
                        type="button"
                        className={`${styles.controlBtn} ${filterActive ? styles.controlActive : ''}`}
                        onClick={onFilterClick}
                        title="Filtrar por bairro"
                        aria-label="Filtrar por bairro"
                        aria-pressed={!!filterActive}
                    >
                        <Filter size={20} />
                    </button>
                )}

                <button
                    type="button"
                    className={`${styles.controlBtn} ${showLegend ? styles.controlActive : ''}`}
                    onClick={() => setShowLegend(v => !v)}
                    title="Legenda de cores"
                    aria-label="Legenda de cores"
                    aria-expanded={showLegend}
                >
                    <List size={20} />
                </button>
            </div>

            {showLegend && (
                <ul className={styles.legend} aria-label="Legenda de status">
                    {LEGEND.map(status => (
                        <li key={status}>
                            <span style={{ background: STATUS_COLORS[status] }} />
                            {statusLabel(status)}
                        </li>
                    ))}
                </ul>
            )}

            <MapContainer
                center={mapCenter}
                zoom={focusOn ? 18 : (userLocation ? 16 : 14)}
                style={{ height: '100%', width: '100%', zIndex: 1 }}
                scrollWheelZoom={true}
                ref={setMapRef}
            >
                <MapEffect focusOn={focusOn} userLocation={userLocation} layerType={layerType} />

                <TileLayer
                    key={layerType} // Força recarregar os tiles ao trocar de camada
                    url={layerType === 'street'
                        ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    }
                    attribution={layerType === 'street'
                        ? '&copy; OpenStreetMap'
                        : 'Tiles &copy; Esri'
                    }
                />

                {userLocation && (
                    <Marker
                        position={[userLocation.lat, userLocation.lon]}
                        icon={userLocationIcon}
                        zIndexOffset={1000}
                    >
                        <Popup>Você está aqui</Popup>
                    </Marker>
                )}

                {/* Renderizar Vetor (Polygon) se o imóvel estiver selecionado e tiver malha */}
                {selectedProperty?.malha && (
                    <GeoJSON
                        key={`vector-${selectedProperty.inscimob}`}
                        data={selectedProperty.malha}
                        style={{
                            color: '#2563eb',
                            weight: 3,
                            opacity: 0.8,
                            fillColor: '#3b82f6',
                            fillOpacity: 0.3
                        }}
                    />
                )}

                {properties.map((prop) => {
                    if (typeof prop.x !== 'number' || typeof prop.y !== 'number' || isNaN(prop.x) || isNaN(prop.y)) {
                        return null;
                    }

                    const [lat, lng] = utmToLatLng(prop.x, prop.y);

                    // O pino reflete o status do imóvel principal (complementos são opcionais)
                    const destaque = fotoDestaque(prop);

                    return (
                        <Marker
                            key={`${prop.inscimob}-${prop.status}`}
                            position={[lat, lng]}
                            icon={getIcon(prop.status, selectedInsc === prop.inscimob)}
                            ref={(ref) => {
                                if (ref) {
                                    markerRefs.current.set(prop.inscimob, ref);
                                    if (selectedInsc === prop.inscimob && !ref.isPopupOpen()) {
                                        setTimeout(() => ref.openPopup(), 100);
                                    }
                                } else {
                                    markerRefs.current.delete(prop.inscimob);
                                }
                            }}
                            eventHandlers={{
                                click: () => {
                                    setSelectedInsc(prop.inscimob);
                                }
                            }}
                        >
                            <Popup eventHandlers={{ remove: () => setSelectedInsc(null) }}>
                                <div className={styles.popup}>
                                    <h3>Nº {prop.numeroAInstalar}</h3>
                                    <p><strong>Insc:</strong> {prop.inscimob}</p>
                                    <p><strong>Bairro:</strong> {prop.bairro?.nome}</p>
                                    <p className={styles.popupStatus}>
                                        <span style={{ background: STATUS_COLORS[prop.status] || '#94a3b8' }} />
                                        {statusLabel(prop.status)}
                                    </p>
                                    {prop.complementos && prop.complementos.length > 0 && (
                                        <p className={styles.popupComp}>
                                            + {prop.complementos.length} complemento{prop.complementos.length > 1 ? 's' : ''} ({prop.complementos.filter(c => c.status === 'CONCLUIDO').length} instalado{prop.complementos.filter(c => c.status === 'CONCLUIDO').length === 1 ? '' : 's'})
                                        </p>
                                    )}

                                    {destaque && (
                                        <div className={styles.photoThumb}>
                                            <span className={styles.photoTag}>Foto de {destaque.tipo.toLowerCase()}</span>
                                            <a href={destaque.url} target="_blank" rel="noopener noreferrer">
                                                <img src={destaque.url} alt={`Foto de ${destaque.tipo.toLowerCase()}`} loading="lazy" />
                                            </a>
                                        </div>
                                    )}

                                    {prop.complementos && prop.complementos.length > 0 && (
                                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Fotos de Complementos:</p>
                                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                {prop.complementos.map(c => {
                                                    const foto = parseFotos(c.fotos);
                                                    if (!foto) return null;
                                                    return (
                                                        <div key={c.id} style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => window.open(foto || '', '_blank')} title={c.status === 'CONCLUIDO' ? 'Foto Instalada' : 'Orientação/Pendente'}>
                                                            <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', border: c.status === 'CONCLUIDO' ? '2px solid #22c55e' : '2px solid #e2e8f0' }}>
                                                                <img src={foto || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Comp" />
                                                            </div>
                                                            <span style={{ fontSize: '10px', display: 'block' }}>{c.numeroPredial}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className={styles.actions}>
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.button}
                                        >
                                            Abrir no Maps
                                        </a>
                                        {onEdit && (
                                            <button
                                                onClick={() => onEdit(prop)}
                                                className={styles.buttonSecondary}
                                            >
                                                Editar / Concluir
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
