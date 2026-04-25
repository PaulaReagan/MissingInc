import { useEffect, useRef, useState } from "react";
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
import { updateStory, uploadToCloudinary } from "../data/stories";

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

export default function EditCaseModal({ story, onClose, onSaved }) {
  const { currentUser, userProfile } = useAuth();

  const [name, setName] = useState(story.name || "");
  const [age, setAge] = useState(story.age === "-" ? "" : story.age || "");
  const [lastSeen, setLastSeen] = useState(story.lastSeen === "-" ? "" : story.lastSeen || "");
  const [lastSeenDate, setLastSeenDate] = useState(story.lastSeenDate === "-" ? "" : story.lastSeenDate || "");
  const [height, setHeight] = useState(story.height === "-" ? "" : story.height || "");
  const [weight, setWeight] = useState(story.weight === "-" ? "" : story.weight || "");
  const [hair, setHair] = useState(story.hair === "-" ? "" : story.hair || "");
  const [eyes, setEyes] = useState(story.eyes === "-" ? "" : story.eyes || "");
  const [summary, setSummary] = useState(story.summary === "-" ? "" : story.summary || "");
  const [position, setPosition] = useState(
    typeof story.lat === "number" && typeof story.lng === "number"
      ? [story.lat, story.lng]
      : null
  );

  // Photo state — start with the existing saved URL
  const [existingImageUrl, setExistingImageUrl] = useState(story.image || "");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(story.image || "");

  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

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

  useEffect(() => {
    return () => {
      // Only revoke if it's a local object URL (not the saved Cloudinary URL)
      if (photoPreview && photoPreview !== existingImageUrl) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview, existingImageUrl]);

  function handleFileSelected(file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      setError("Please choose an image file (jpg, png, webp, etc.).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image is too large (max 8 MB).");
      return;
    }
    setError("");
    if (photoPreview && photoPreview !== existingImageUrl) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    if (photoPreview && photoPreview !== existingImageUrl) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview("");
    setExistingImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer?.types?.includes("Files")) setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelected(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = existingImageUrl;

      if (photoFile) {
        setUploadProgress("Uploading new photo…");
        imageUrl = await uploadToCloudinary(photoFile);
      } else if (!photoPreview) {
        imageUrl = "";
      }

      setUploadProgress("Saving changes…");
      await updateStory(
        story.id,
        {
          name,
          age,
          image: imageUrl,
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
            userProfile?.username ||
            currentUser?.displayName ||
            currentUser?.email ||
            "Admin",
        },
        currentUser
      );

      onSaved({ image: imageUrl, name, age, lastSeen, lastSeenDate, height, weight, hair, eyes, summary, lat: position ? position[0] : null, lng: position ? position[1] : null });
      onClose();
    } catch (err) {
      console.error("updateStory error:", err);
      setError(err.message || "Failed to save changes. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal-card${isDragging ? " modal-card-dragging" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="modal-drop-overlay" aria-hidden="true">
            <div className="modal-drop-overlay-text">Drop photo to upload</div>
          </div>
        )}

        <div className="modal-header">
          <h2 className="modal-title" id="edit-modal-title">Edit Case</h2>
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
              <label htmlFor="edit-name">Name *</label>
              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-age">Age</label>
              <input
                id="edit-age"
                type="text"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 17"
              />
            </div>

            <div className="form-group modal-grid-full">
              <label>Photo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
              {photoPreview ? (
                <div className="photo-preview">
                  <img src={photoPreview} alt="Case photo" />
                  <div className="photo-preview-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change Photo
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={clearPhoto}
                    >
                      Remove Photo
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="photo-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="photo-dropzone-primary">
                    Drag &amp; drop a photo here
                  </span>
                  <span className="photo-dropzone-secondary">
                    or click to browse — max 8 MB
                  </span>
                </button>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="edit-lastseen">Last Seen (City)</label>
              <input
                id="edit-lastseen"
                type="text"
                value={lastSeen}
                onChange={(e) => setLastSeen(e.target.value)}
                placeholder="e.g. Santa Rosa, CA"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-lastseendate">Date</label>
              <input
                id="edit-lastseendate"
                type="date"
                value={lastSeenDate}
                onChange={(e) => setLastSeenDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-height">Height</label>
              <input
                id="edit-height"
                type="text"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 5'7&quot;"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-weight">Weight</label>
              <input
                id="edit-weight"
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 135 lbs"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-hair">Hair</label>
              <input
                id="edit-hair"
                type="text"
                value={hair}
                onChange={(e) => setHair(e.target.value)}
                placeholder="e.g. Brown, long"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-eyes">Eyes</label>
              <input
                id="edit-eyes"
                type="text"
                value={eyes}
                onChange={(e) => setEyes(e.target.value)}
                placeholder="e.g. Hazel"
              />
            </div>

            <div className="form-group modal-grid-full">
              <label htmlFor="edit-summary">Story / Details</label>
              <textarea
                id="edit-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Describe circumstances, clothing last seen, anyone to contact, etc."
                rows={4}
              />
            </div>

            <div className="form-group modal-grid-full">
              <label>Last Seen Location (click to move pin)</label>
              <div className="modal-map-wrapper">
                <MapContainer
                  center={position || DEFAULT_CENTER}
                  zoom={position ? 12 : 10}
                  scrollWheelZoom={false}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationPicker position={position} setPosition={setPosition} />
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
              {submitting ? uploadProgress || "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
