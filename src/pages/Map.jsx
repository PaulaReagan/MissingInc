import { MapContainer, TileLayer } from 'react-leaflet';

export default function MapPage() {
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <MapContainer
        center={[38.5, -122.8]}
        zoom={10}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>
    </div>
  );
}
