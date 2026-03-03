import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function Profile() {
  const { currentUser, userProfile, logout, uploadProfilePicture, updateUsername } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const displayName =
    userProfile?.username || currentUser?.displayName || currentUser?.email;
  const profilePicture = userProfile?.profilePicture;
  const initials = getInitials(displayName);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  function handleEditUsername() {
    setNewUsername(userProfile?.username || "");
    setUsernameError("");
    setEditingUsername(true);
  }

  async function handleSaveUsername() {
    setUsernameError("");
    if (newUsername.trim().length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      return;
    }
    setSavingUsername(true);
    try {
      await updateUsername(newUsername);
      setEditingUsername(false);
    } catch (err) {
      setUsernameError(err.message || "Failed to update username.");
    }
    setSavingUsername(false);
  }

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");

    const allowedTypes = ["image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Only PNG and JPEG images are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5 MB.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      await uploadProfilePicture(file);
    } catch (err) {
      console.error("Upload failed:", err);
      if (err.code === "storage/unauthorized" || err.code === "storage/retry-limit-exceeded") {
        setUploadError("Upload denied. Firebase Storage rules may need to be updated.");
      } else if (err.code === "storage/unknown") {
        setUploadError("Firebase Storage may not be enabled. Check the Firebase console.");
      } else {
        setUploadError("Upload failed: " + (err.message || "Unknown error"));
      }
    }
    setUploading(false);
    e.target.value = "";
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="home-logo" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          MyApp
        </div>
        <div className="home-user-section">
          <div
            className="home-avatar"
            onClick={() => navigate("/profile")}
            style={{ cursor: "pointer" }}
          >
            {profilePicture ? (
              <img src={profilePicture} alt="" className="home-avatar-img" />
            ) : (
              displayName?.charAt(0)?.toUpperCase() || "U"
            )}
          </div>
          <span
            className="home-username"
            onClick={() => navigate("/profile")}
            style={{ cursor: "pointer" }}
          >
            {displayName}
          </span>
          <button
            onClick={handleLogout}
            className="btn btn-logout"
            disabled={loggingOut}
          >
            {loggingOut ? "Logging out..." : "Sign Out"}
          </button>
        </div>
      </header>

      <main className="profile-main">
        <div className="profile-grid">
          {/* Left column — profile picture */}
          <div className="profile-col profile-col-picture">
            <div
              className={`profile-picture-wrapper ${uploading ? "uploading" : ""}`}
              onClick={handleAvatarClick}
              title="Click to change profile picture"
            >
              {profilePicture ? (
                <img src={profilePicture} alt="Profile" className="profile-picture" />
              ) : (
                <div className="profile-picture-initials">{initials}</div>
              )}
              <div className="profile-picture-overlay">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>{uploading ? "Uploading..." : "Update Photo"}</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg"
                onChange={handleFileChange}
                hidden
              />
            </div>
            {uploadError && <div className="profile-upload-error">{uploadError}</div>}
            <h2 className="profile-display-name">{displayName}</h2>
            <p className="profile-email">{currentUser?.email}</p>

            <div className="profile-actions">
              {editingUsername ? (
                <div className="profile-inline-edit">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="New username"
                    className="profile-inline-input"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveUsername();
                      if (e.key === "Escape") setEditingUsername(false);
                    }}
                    disabled={savingUsername}
                  />
                  {usernameError && <p className="profile-inline-error">{usernameError}</p>}
                  <div className="profile-inline-buttons">
                    <button
                      className="btn profile-action-btn profile-action-btn-save"
                      onClick={handleSaveUsername}
                      disabled={savingUsername}
                    >
                      {savingUsername ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="btn profile-action-btn"
                      onClick={() => setEditingUsername(false)}
                      disabled={savingUsername}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn profile-action-btn" onClick={handleEditUsername}>
                  Change Username
                </button>
              )}
              <button className="btn profile-action-btn">Change Password</button>
              <button className="btn profile-action-btn profile-action-btn-danger">Sign Out</button>
              <button className="btn profile-action-btn profile-action-btn-danger">Delete Account</button>
            </div>
          </div>

          {/* Middle column — Past Posts */}
          <div className="profile-col profile-col-middle">
            <h3 className="profile-col-heading">Past Posts</h3>
            <div className="profile-posts-empty">
              <p>No posts yet</p>
            </div>
          </div>

          {/* Right column — Followers & Following */}
          <div className="profile-col profile-col-right">
            <div className="profile-stat-box">
              <span className="profile-stat-label">Followers:</span>
              <span className="profile-stat-count">0</span>
            </div>
            <div className="profile-stat-box">
              <span className="profile-stat-label">Following:</span>
              <span className="profile-stat-count">0</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
