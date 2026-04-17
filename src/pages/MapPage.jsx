import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useNavigate } from "react-router-dom";

export default function MapPage() {
  const navigate = useNavigate();

  return (
    <div style={{ height: '100vh', width: '100%' }}>

      <button
        onClick={() => navigate("/")}
        style={{
          position: "absolute",
          top: "20px",
          left: "50px",
          zIndex: 1000,
          padding: "10px",
        }}
      >
        ← Home
      </button>

      <MapContainer
        center={[38.5, -122.8]}
        zoom={11}
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
