'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import styles from './map.module.css';
import { utmToLatLng } from '@/utils/geo';

// Corrigir ícones do Leaflet
const getIcon = (status: string, isSelected: boolean = false) => {
    let color = '#ef4444'; // NAO_INICIADO (Vermelho)
    if (status === 'LIBERADO') color = '#3b82f6'; // Azul
    if (status === 'AUSENTE') color = '#f97316'; // Laranja
    if (status === 'PENDENTE') color = '#eab308'; // Amarelo
    if (status === 'CONCLUIDO') color = '#22c55e'; // Verde

    const size = isSelected ? 18 : 14;
    const border = isSelected ? '3px solid #000' : '2px solid #fff';

    return L.divIcon({
        className: styles.markerIcon || '',
        html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${border}; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
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
    fotoLocalInstalacao?: string;
    malha?: any; // Geometria GeoJSON
    complementos?: any[];
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
    const [selectedInsc, setSelectedInsc] = useState<string | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return <div className={styles.loader}>Iniciando GPS...</div>;

    const mapCenter: [number, number] = focusOn
        ? utmToLatLng(focusOn[0], focusOn[1])
        : [-25.187883706053842, -49.314766448822134];

    const selectedProperty = properties.find(p => p.inscimob === selectedInsc);

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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
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
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 2v3m0 14v3m-7-10H2m17 0h3" />
                        </svg>
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
                            html: `
                                <div style="
                                    width: 24px; 
                                    height: 24px; 
                                    background-color: #3b82f6; 
                                    border: 2px solid white; 
                                    border-radius: 50%;
                                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                ">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white" style="transform: rotate(-45deg); margin-top: -2px; margin-right: -2px;">
                                        <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                                    </svg>
                                </div>
                            `,
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })}
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

                    let pinStatus = prop.status;
                    // Como complementos são opcionais (só instala se quiser), o status do imóvel principal 
                    // NÃO deve ser "puxado" para pendente se já estiver concluído.
                    // O mapa refletirá a exata realidade do imóvel principal.

                    return (
                        <Marker
                            key={`${prop.inscimob}-${prop.status}`}
                            position={[lat, lng]}
                            icon={getIcon(pinStatus, selectedInsc === prop.inscimob)}
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
                                    <p><strong>Status:</strong> {prop.status}</p>
                                    {prop.complementos && prop.complementos.length > 0 && (
                                        <p style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                                            ⚠️ Possui {prop.complementos.length} complementos
                                        </p>
                                    )}

                                    {(prop.status === 'CONCLUIDO' ? prop.fotos : (prop.fotoLocalInstalacao || prop.fotos)) && (
                                        <div className={styles.photoThumb}>
                                            <span style={{ fontSize: '10px', fontWeight: 'bold', backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', marginBottom: '4px', display: 'inline-block' }}>
                                                {prop.status === 'CONCLUIDO' || (!prop.fotoLocalInstalacao && prop.fotos) ? '📸 Foto Instalação' : '📍 Foto Orientação'}
                                            </span>
                                            <img src={(prop.status === 'CONCLUIDO' ? prop.fotos : (prop.fotoLocalInstalacao || prop.fotos)) as string} alt="Foto imovel" onClick={() => window.open((prop.status === 'CONCLUIDO' ? prop.fotos : (prop.fotoLocalInstalacao || prop.fotos)) as string, '_blank')} />
                                        </div>
                                    )}

                                    {prop.complementos && prop.complementos.length > 0 && (
                                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Fotos de Complementos:</p>
                                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                {prop.complementos.map(c => {
                                                    const foto = c.fotos && c.fotos !== 'null' && c.fotos !== '[]' ? JSON.parse(c.fotos)[0] : null;
                                                    if (!foto) return null;
                                                    return (
                                                        <div key={c.id} style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => window.open(foto, '_blank')} title={c.status === 'CONCLUIDO' ? 'Foto Instalada' : 'Orientação/Pendente'}>
                                                            <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', border: c.status === 'CONCLUIDO' ? '2px solid #22c55e' : '2px solid #e2e8f0' }}>
                                                                <img src={foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Comp" />
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
