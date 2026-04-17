import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";

function LocationMarker({ setMarkerPosition }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setMarkerPosition([lat, lng]);
    },
  });

  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const [markerPosition, setMarkerPosition] = useState(null);

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <button
        onClick={() => navigate("/")}
        style={{
          position: "absolute",
          top: "20px",
          left: "80px",
          zIndex: 1000,
          padding: "10px",
        }}
      >
        ← Home
      </button>

      <MapContainer
        center={[38.5, -122.8]}
        zoom={10}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LocationMarker setMarkerPosition={setMarkerPosition} />

        {markerPosition && (
          <Marker position={markerPosition}>
            <Popup>Last seen location</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
