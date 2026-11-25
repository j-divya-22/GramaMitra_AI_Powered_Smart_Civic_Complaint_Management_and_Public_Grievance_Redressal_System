import { useEffect } from 'react';
import { divIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const INDIA_CENTER = [20.5937, 78.9629];
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = import.meta.env.VITE_MAP_TILE_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const pinIcon = divIcon({
  className: 'janvani-map-marker',
  html: '<svg viewBox="0 0 32 40" aria-hidden="true"><path d="M16 1C7.72 1 1 7.72 1 16c0 10.2 15 23 15 23s15-12.8 15-23C31 7.72 24.28 1 16 1Z" fill="#1F4736" stroke="#FFF8EE" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#F29B38"/></svg>',
  iconSize: [32, 40],
  iconAnchor: [16, 39],
});

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.latitude, position.longitude], Math.max(map.getZoom(), 15), { duration: 0.7 });
  }, [map, position]);
  return null;
}

export default function LocationMap({ position, onSelect }) {
  const center = position ? [position.latitude, position.longitude] : INDIA_CENTER;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-light">
      <MapContainer
        center={center}
        zoom={position ? 15 : 5}
        scrollWheelZoom={false}
        className="complaint-map"
        aria-label="Select the complaint location on the map"
      >
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={TILE_URL}
        />
        <MapClickHandler onSelect={onSelect} />
        <RecenterMap position={position} />
        {position && <Marker position={[position.latitude, position.longitude]} icon={pinIcon} />}
      </MapContainer>
    </div>
  );
}
