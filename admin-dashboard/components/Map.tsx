'use client';

import { MapContainer, TileLayer, Marker, Popup, ScaleControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import HeatmapLayer from './HeatmapLayer';
import { useEffect, useState } from 'react';

// Component to handle map view changes
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

// Fix Leaflet marker icons in Next.js
const fixLeafletIcons = () => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
};

interface MapProps {
    issues: any[];
    center?: [number, number];
    zoom?: number;
}

export default function Map({ issues, center = [20.5937, 78.9629], zoom = 10 }: MapProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        fixLeafletIcons();
    }, []);

    if (!isClient) return <div className="w-full h-full bg-zinc-900 animate-pulse rounded-2xl flex items-center justify-center font-bold text-zinc-700">Loading Map...</div>;

    // Prepare heatmap points: [lat, lng, intensity (based on upvotes)]
    const heatmapPoints: [number, number, number][] = issues
        .filter(issue => issue.location?.latitude && issue.location?.longitude)
        .map(issue => [
            issue.location.latitude,
            issue.location.longitude,
            (issue.upvotes || 1) * 0.5 // Scale intensity by upvotes
        ]);

    return (
        <div className="w-full h-full relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <MapContainer
                center={center}
                zoom={zoom}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false} // We can add custom controls or just use default zoom
            >
                <ChangeView center={center} zoom={zoom} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                <HeatmapLayer points={heatmapPoints} />

                {issues.filter(issue => issue.location?.latitude && issue.location?.longitude).map((issue) => (
                    <Marker
                        key={issue.id}
                        position={[issue.location.latitude, issue.location.longitude]}
                    >
                        <Popup>
                            <div className="p-1 min-w-[150px]">
                                <h4 className="font-bold text-[#00ff88] mb-1">{issue.title || 'Untitled Issue'}</h4>
                                <p className="text-xs text-zinc-300 mb-2">{issue.category}</p>
                                <div className="flex justify-between items-center border-t border-white/10 pt-2 mt-1">
                                    <span className="text-[10px] text-zinc-400">{issue.district || 'Unassigned'}</span>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${issue.priority === 4 ? 'bg-red-500/20 text-red-400' :
                                                issue.priority === 3 ? 'bg-orange-500/20 text-orange-400' :
                                                    issue.priority === 2 ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-zinc-500/20 text-zinc-400'
                                            }`}>
                                            P{issue.priority || 1}
                                        </span>
                                        <span className="text-[10px] bg-[#00ff88]/10 text-[#00ff88] px-1.5 py-0.5 rounded-full font-bold">
                                            {issue.upvotes || 0} Upvotes
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                <ScaleControl position="bottomleft" />
            </MapContainer>
        </div>
    );
}
