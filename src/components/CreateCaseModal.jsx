import { useEffect, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useAuth } from "../contexts/AuthContext";
import { createStory } from "../data/stories";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER = [38.5, -122.8];

function LocationPicker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  if (!position) return null;
  return <Marker position={position} />;
}

export default function CreateCaseModal({ onClose }) {
  const { currentUser, userProfile } = useAuth();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [image, setImage] = useState("");
  const [lastSeen, setLastSeen] = useState("");
  const [lastSeenDate, setLastSeenDate] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [hair, setHair] = useState("");
  const [eyes, setEyes] = useState("");
  const [summary, setSummary] = useState("");
  const [position, setPosition] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }

    setSubmitting(true);
    try {
      await createStory(
        {
          name,
          age,
          image,
          lastSeen,
          lastSeenDate,
          height,
          weight,
          hair,
          eyes,
          summary,
          lat: position ? position[0] : null,
          lng: position ? position[1] : null,
          createdByName:
            userProfile?.username || currentUser?.displayName || currentUser?.email,
        },
        currentUser
      );
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create case. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">Create New Case</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {error && <div className="modal-error">{error}</div>}

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="case-name">Name *</label>
              <input
                id="case-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="case-age">Age</label>
              <input
                id="case-age"
                type="text"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 17"
              />
            </div>

            <div className="form-group modal-grid-full">
              <label htmlFor="case-image">Photo URL</label>
              <input
                id="case-image"
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://… (leave blank for placeholder)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="case-lastseen">Last Seen (City)</label>
              <input
                id="case-lastseen"
                type="text"
                value={lastSeen}
                onChange={(e) => setLastSeen(e.target.value)}
                placeholder="e.g. Santa Rosa, CA"
              />
            </div>

            <div className="form-group">
              <label htmlFor="case-lastseendate">Date</label>
              <input
                id="case-lastseendate"
                type="date"
                value={lastSeenDate}
                onChange={(e) => setLastSeenDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="case-height">Height</label>
              <input
                id="case-height"
                type="text"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 5'7&quot;"
              />
            </div>

            <div className="form-group">
              <label htmlFor="case-weight">Weight</label>
              <input
                id="case-weight"
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 135 lbs"
              />
            </div>

            <div className="form-group">
              <label htmlFor="case-hair">Hair</label>
              <input
                id="case-hair"
                type="text"
                value={hair}
                onChange={(e) => setHair(e.target.value)}
                placeholder="e.g. Brown, long"
              />
            </div>

            <div className="form-group">
              <label htmlFor="case-eyes">Eyes</label>
              <input
                id="case-eyes"
                type="text"
                value={eyes}
                onChange={(e) => setEyes(e.target.value)}
                placeholder="e.g. Hazel"
              />
            </div>

            <div className="form-group modal-grid-full">
              <label htmlFor="case-summary">Story / Details</label>
              <textarea
                id="case-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Describe circumstances, clothing last seen, anyone to contact, etc."
                rows={4}
              />
            </div>

            <div className="form-group modal-grid-full">
              <label>Last Seen Location (click the map to drop a pin)</label>
              <div className="modal-map-wrapper">
                <MapContainer
                  center={DEFAULT_CENTER}
                  zoom={10}
                  scrollWheelZoom={false}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationPicker
                    position={position}
                    setPosition={setPosition}
                  />
                </MapContainer>
              </div>
              <div className="modal-coord-row">
                {position ? (
                  <span className="modal-coord-value">
                    Pin: {position[0].toFixed(4)}, {position[1].toFixed(4)}
                  </span>
                ) : (
                  <span className="modal-coord-hint">
                    No location selected (optional)
                  </span>
                )}
                {position && (
                  <button
                    type="button"
                    className="modal-coord-clear"
                    onClick={() => setPosition(null)}
                  >
                    Clear pin
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit Case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
