import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../firebase/config";
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
  const [commentHistory, setCommentHistory] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [casesCreated, setCasesCreated] = useState([]);
  const [socialTab, setSocialTab] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "users", currentUser.uid, "commentHistory"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCommentHistory(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      },
      (err) => console.error("Failed to load comment history:", err)
    );
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(
      collection(db, "users", currentUser.uid, "followers"),
      (snap) => setFollowers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
    );
    return unsub;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(
      collection(db, "users", currentUser.uid, "following"),
      (snap) => setFollowing(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
    );
    return unsub;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "stories"),
      where("createdBy", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setCasesCreated(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Failed to load cases:", err));
    return unsub;
  }, [currentUser]);

  async function handleDeleteHistoryComment(item) {
    if (!confirm("Delete this comment? It will also be removed from the story thread.")) return;
    try {
      await deleteDoc(
        doc(db, "stories", item.storyId, "comments", item.storyCommentId)
      );
      await deleteDoc(
        doc(db, "users", currentUser.uid, "commentHistory", item.id)
      );
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  }

  function timeAgo(dateString) {
    const seconds = Math.floor(
      (Date.now() - new Date(dateString).getTime()) / 1000
    );
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

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
	} 	catch (err) {
  	console.error("Upload failed:", err);
  	if (err.code === "storage/unauthorized" || err.code === "storage/retry-limit-exceeded") {
    	setUploadError("Upload denied. Firebase Storage rules may need to be updated.");
  	} else if (err.code === "storage/unknown") {
    	setUploadError("Firebase Storage may not be enabled. Check the Firebase console.");
  	} else {
    	setUploadError("Upload failed: " + (err.message || "Unknown error"));
  	}
	} finally {
  	setUploading(false);
	}
    e.target.value = "";
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="home-logo" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          Missing: Sonoma County
        </div>
        <div className="home-user-section">
          <button
            className="nav-msg-btn"
            onClick={() => navigate("/messages")}
            title="Direct Messages"
            aria-label="Direct Messages"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
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
        <div className="profile-welcome">
          <h1>Hey Detective, {displayName}</h1>
        </div>
        <div className="profile-grid">
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

          <div className="profile-col profile-col-middle">
            <h3 className="profile-col-heading">
              Comment History
              <span className="profile-comment-count">{commentHistory.length}</span>
            </h3>

            {commentHistory.length === 0 ? (
              <div className="profile-posts-empty">
                <p>No comments yet</p>
              </div>
            ) : (
              <div className="profile-comment-list">
                {commentHistory.map((item) => (
                  <div className="profile-comment-item" key={item.id}>
                    <div className="profile-comment-item-header">
                      <span
                        className="profile-comment-story-link"
                        onClick={() => navigate(`/story/${item.storyId}`)}
                      >
                        {item.storyName}
                      </span>
                      <span className="profile-comment-item-time">
                        {timeAgo(item.createdAt)}
                      </span>
                      <button
                        className="thread-comment-delete"
                        onClick={() => handleDeleteHistoryComment(item)}
                        title="Delete comment"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                    <p className="profile-comment-item-text">{item.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="profile-col profile-col-right">
            <button
              className="profile-stat-box"
              onClick={() => setSocialTab(socialTab === "followers" ? null : "followers")}
            >
              <span className="profile-stat-label">Followers</span>
              <span className="profile-stat-count">{followers.length}</span>
            </button>
            <button
              className="profile-stat-box"
              onClick={() => setSocialTab(socialTab === "following" ? null : "following")}
            >
              <span className="profile-stat-label">Following</span>
              <span className="profile-stat-count">{following.length}</span>
            </button>

            {socialTab === "followers" && (
              <div className="profile-social-list">
                <p className="profile-social-list-title">Followers</p>
                {followers.length === 0 ? (
                  <p className="profile-social-empty">No followers yet.</p>
                ) : (
                  followers.map((f) => (
                    <div
                      key={f.uid}
                      className="profile-social-row"
                      onClick={() => navigate(`/user/${f.uid}`)}
                    >
                      <div className="profile-social-avatar">
                        {f.profilePicture ? (
                          <img src={f.profilePicture} alt="" />
                        ) : (
                          (f.username || "?").charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="profile-social-name">
                        {f.username || "Anonymous"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {socialTab === "following" && (
              <div className="profile-social-list">
                <p className="profile-social-list-title">Following</p>
                {following.length === 0 ? (
                  <p className="profile-social-empty">Not following anyone yet.</p>
                ) : (
                  following.map((f) => (
                    <div
                      key={f.uid}
                      className="profile-social-row"
                      onClick={() => navigate(`/user/${f.uid}`)}
                    >
                      <div className="profile-social-avatar">
                        {f.profilePicture ? (
                          <img src={f.profilePicture} alt="" />
                        ) : (
                          (f.username || "?").charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="profile-social-name">
                        {f.username || "Anonymous"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            <button
              className="profile-stat-box"
              onClick={() => setSocialTab(socialTab === "cases" ? null : "cases")}
            >
              <span className="profile-stat-label">Cases Created</span>
              <span className="profile-stat-count">{casesCreated.length}</span>
            </button>

            {socialTab === "cases" && (
              <div className="profile-social-list">
                <p className="profile-social-list-title">Cases Created</p>
                {casesCreated.length === 0 ? (
                  <p className="profile-social-empty">No cases created yet.</p>
                ) : (
                  casesCreated.map((c) => (
                    <div
                      key={c.id}
                      className="profile-social-row"
                      onClick={() => navigate(`/story/${c.id}`)}
                    >
                      <div className="profile-case-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                      </div>
                      <span className="profile-social-name">{c.name}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
