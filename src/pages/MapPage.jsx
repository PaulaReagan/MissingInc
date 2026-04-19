import { useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet"; 
import { useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const MOCK_CASES = [
  {
    id: "1",
    name: "Person 1",
    age: 17,
    lat: 38.4405,
    lng: -122.7144,
    lastSeen: "Santa Rosa, CA",
    lastSeenDate: "2026-04-10",
  },
  {
    id: "2",
    name: "Person 2",
    age: 22,
    lat: 38.2919,
    lng: -122.4580,
    lastSeen: "Petaluma, CA",
    lastSeenDate: "2026-04-12",
  },
  {
    id: "3",
    name: "Person 3",
    age: 14,
    lat: 38.2324,
    lng: -122.6367,
    lastSeen: "Rohnert Park, CA",
    lastSeenDate: "2026-04-08",
  },
];

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

        {MOCK_CASES.map((person) => (
          <Marker key={person.id} position={[person.lat, person.lng]}>
            <Popup>
              <div>
                <strong>{person.name}</strong>
                <br />
                Age: {person.age}
                <br />
                Last seen: {person.lastSeen}
                <br />
                Date: {person.lastSeenDate}
              </div>
            </Popup>
          </Marker>
        ))}

        {markerPosition && (
          <Marker position={markerPosition}>
            <Popup>New reported location</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
