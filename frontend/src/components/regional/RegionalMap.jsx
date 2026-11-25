import { divIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { useEffect } from 'react';

const INDIA_CENTER = [20.5937, 78.9629];
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = import.meta.env.VITE_MAP_TILE_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const markerIcon = divIcon({
  className: 'regional-map-marker',
  html: '<span style="display:block;width:18px;height:18px;border-radius:50%;background:#ad4f1b;border:3px solid #fff8ee;box-shadow:0 2px 8px rgba(39,51,79,.35)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitComplaints({ complaints }) {
  const map = useMap();
  useEffect(() => {
    if (complaints.length === 0) {
      map.setView(INDIA_CENTER, 5);
      return;
    }
    if (complaints.length === 1) {
      map.setView([Number(complaints[0].latitude), Number(complaints[0].longitude)], 14);
      return;
    }
    const bounds = complaints.map((complaint) => [
      Number(complaint.latitude),
      Number(complaint.longitude),
    ]);
    map.fitBounds(bounds, { padding: [35, 35], maxZoom: 13 });
  }, [map, complaints]);
  return null;
}

export default function RegionalMap({ complaints }) {
  return (
    <div className="overflow-hidden rounded-b-3xl border-t border-neutral-light">
      <MapContainer
        center={INDIA_CENTER}
        zoom={5}
        scrollWheelZoom
        className="regional-map"
        aria-label="Regional complaint distribution map"
      >
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={TILE_URL}
        />
        <FitComplaints complaints={complaints} />
        {complaints.map((complaint) => (
          <Marker
            key={complaint.id}
            position={[Number(complaint.latitude), Number(complaint.longitude)]}
            icon={markerIcon}
          />
        ))}
      </MapContainer>
    </div>
  );
}
