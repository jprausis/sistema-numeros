'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import styles from './map.module.css';
import { utmToLatLng } from '@/utils/geo';

// Corrigir ícones do Leaflet
const getIcon = (status: string) => {
    let color = '#ef4444'; // Vermelho (NÃO INICIADO)
    if (status === 'CONCLUIDO') color = '#10b981'; // Verde
    if (status === 'PENDENTE') color = '#f59e0b'; // Amarelo

    return L.divIcon({
        className: styles.markerIcon || '',
        html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.4);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
};

// Componente para forçar o Leaflet a reconhecer o tamanho correto do container
function MapEffect({ focusOn, userLocation, layerType }: { focusOn?: [number, number] | null, userLocation?: { lat: number, lon: number } | null, layerType: string }) {
    const map = useMap();
    const [lastLoc, setLastLoc] = useState<string>('');

    useEffect(() => {
        // Pequeno delay para garantir que o DOM já tenha as dimensões
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map, layerType]);

    useEffect(() => {
        if (focusOn) {
            const [lat, lng] = utmToLatLng(focusOn[0], focusOn[1]);
            map.setView([lat, lng], 18);
        }
    }, [focusOn, map]);

    // Centralizar no usuário quando a localização mudar pela primeira vez ou quando quiser resetar
    useEffect(() => {
        if (userLocation && !lastLoc) {
            map.setView([userLocation.lat, userLocation.lon], 16);
            setLastLoc(`${userLocation.lat},${userLocation.lon}`);
        }
    }, [userLocation, map, lastLoc]);

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
}

export default function InstallerMap({
    properties,
    focusOn,
    userLocation,
    onEdit
}: {
    properties: Property[],
    focusOn?: [number, number] | null,
    userLocation?: { lat: number, lon: number } | null,
    onEdit?: (p: any) => void
}) {
    const [isMounted, setIsMounted] = useState(false);
    const [layerType, setLayerType] = useState<'street' | 'satellite'>('street');
    const [mapRef, setMapRef] = useState<L.Map | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return <div className={styles.loader}>Iniciando GPS...</div>;

    const mapCenter: [number, number] = focusOn
        ? utmToLatLng(focusOn[0], focusOn[1])
        : [-25.187883706053842, -49.314766448822134];

    return (
        <div className={styles.mapWrapper} style={{ flex: 1, minHeight: '500px', height: '100%', position: 'relative' }}>
            {/* Botão de Alternância - Fora do MapContainer para evitar erros de renderização */}
            <div className={styles.mapControls}>
                <div
                    className={styles.controlBtn}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLayerType(prev => prev === 'street' ? 'satellite' : 'street');
                    }}
                    title="Alternar Camada"
                >
                    {layerType === 'street' ? '🛰️' : '🛣️'}
                </div>

                {userLocation && (
                    <div
                        className={styles.controlBtn}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (mapRef) {
                                mapRef.setView([userLocation.lat, userLocation.lon], 18);
                            }
                        }}
                        title="Minha Localização"
                    >
                        🎯
                    </div>
                )}
            </div>

            <MapContainer
                center={mapCenter}
                zoom={focusOn ? 18 : 14}
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
                        icon={L.divIcon({
                            className: '',
                            html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        })}
                    >
                        <Popup>Você está aqui</Popup>
                    </Marker>
                )}

                {properties.map((prop) => {
                    if (typeof prop.x !== 'number' || typeof prop.y !== 'number' || isNaN(prop.x) || isNaN(prop.y)) {
                        return null;
                    }

                    const [lat, lng] = utmToLatLng(prop.x, prop.y);

                    return (
                        <Marker
                            key={`${prop.inscimob}-${prop.status}`}
                            position={[lat, lng]}
                            icon={getIcon(prop.status)}
                        >
                            <Popup>
                                <div className={styles.popup}>
                                    <h3>Nº {prop.numeroAInstalar}</h3>
                                    <p><strong>Bairro:</strong> {prop.bairro?.nome}</p>
                                    <p><strong>Status:</strong> {prop.status}</p>

                                    {prop.fotos && (
                                        <div className={styles.photoThumb}>
                                            <img src={prop.fotos} alt="Foto imovel" onClick={() => window.open(prop.fotos, '_blank')} />
                                        </div>
                                    )}

                                    <div className={styles.actions}>
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                                            target="_blank"
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
