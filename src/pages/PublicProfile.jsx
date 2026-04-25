import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
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

export default function PublicProfile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile, followUser, unfollowUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [commentHistory, setCommentHistory] = useState([]);
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [casesCreated, setCasesCreated] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("comments");

  useEffect(() => {
    if (currentUser && uid === currentUser.uid) {
      navigate("/profile", { replace: true });
    }
  }, [uid, currentUser, navigate]);

  useEffect(() => {
    if (!uid) return;
    setLoadingProfile(true);
    getDoc(doc(db, "users", uid))
      .then((snap) => {
        setProfile(snap.exists() ? snap.data() : null);
        setLoadingProfile(false);
      })
      .catch(() => {
        setProfile(null);
        setLoadingProfile(false);
      });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "users", uid, "commentHistory"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setCommentHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, "users", uid, "following"), (snap) => {
      setFollowing(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, "users", uid, "followers"), (snap) => {
      setFollowers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "stories"),
      where("createdBy", "==", uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setCasesCreated(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [uid]);

  useEffect(() => {
    if (!currentUser || !uid) return;
    return onSnapshot(
      doc(db, "users", currentUser.uid, "following", uid),
      (snap) => setIsFollowing(snap.exists())
    );
  }, [currentUser, uid]);

  async function handleFollowToggle() {
    if (!currentUser || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(uid);
      } else {
        await followUser(uid, profile);
      }
    } catch (err) {
      console.error(err);
    }
    setFollowLoading(false);
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
    return `${Math.floor(hours / 24)}d ago`;
  }

  const myDisplayName =
    userProfile?.username || currentUser?.displayName || currentUser?.email;
  const myProfilePicture = userProfile?.profilePicture;

  if (loadingProfile) {
    return (
      <div className="story-not-found">
        <h1>Loading…</h1>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="story-not-found">
        <h1>Detective not found</h1>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>
    );
  }

  const displayName = profile.username || "Anonymous Detective";
  const profilePicture = profile.profilePicture;
  const initials = getInitials(displayName);

  return (
    <div className="home-container">
      <header className="home-header">
        <div
          className="home-logo"
          onClick={() => navigate("/")}
          style={{ cursor: "pointer" }}
        >
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
            {myProfilePicture ? (
              <img src={myProfilePicture} alt="" className="home-avatar-img" />
            ) : (
              myDisplayName?.charAt(0)?.toUpperCase() || "U"
            )}
          </div>
          <span
            className="home-username"
            onClick={() => navigate("/profile")}
            style={{ cursor: "pointer" }}
          >
            {myDisplayName}
          </span>
        </div>
      </header>

      <main className="pubprofile-main">
        <button className="story-back" onClick={() => navigate(-1)}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <div className="pubprofile-header-card">
          <div className="pubprofile-avatar-wrap">
            {profilePicture ? (
              <img
                src={profilePicture}
                alt=""
                className="pubprofile-avatar-img"
              />
            ) : (
              <div className="pubprofile-avatar-initials">{initials}</div>
            )}
          </div>
          <div className="pubprofile-identity">
            <h1 className="pubprofile-name">{displayName}</h1>
            <p className="pubprofile-role">Detective</p>
          </div>
          <button
            className={`btn pubprofile-follow-btn ${
              isFollowing
                ? "pubprofile-follow-btn-following"
                : "btn-primary"
            }`}
            onClick={handleFollowToggle}
            disabled={followLoading}
          >
            {followLoading ? "…" : isFollowing ? "Following" : "Follow"}
          </button>
        </div>

        <div className="pubprofile-tabs">
          <button
            className={`pubprofile-tab ${activeTab === "comments" ? "active" : ""}`}
            onClick={() => setActiveTab("comments")}
          >
            Comments
            <span className="pubprofile-tab-count">{commentHistory.length}</span>
          </button>
          <button
            className={`pubprofile-tab ${activeTab === "followers" ? "active" : ""}`}
            onClick={() => setActiveTab("followers")}
          >
            Followers
            <span className="pubprofile-tab-count">{followers.length}</span>
          </button>
          <button
            className={`pubprofile-tab ${activeTab === "following" ? "active" : ""}`}
            onClick={() => setActiveTab("following")}
          >
            Following
            <span className="pubprofile-tab-count">{following.length}</span>
          </button>
          <button
            className={`pubprofile-tab ${activeTab === "cases" ? "active" : ""}`}
            onClick={() => setActiveTab("cases")}
          >
            Cases
            <span className="pubprofile-tab-count">{casesCreated.length}</span>
          </button>
        </div>

        <div className="pubprofile-content">
          {activeTab === "comments" && (
            <div className="pubprofile-section">
              {commentHistory.length === 0 ? (
                <div className="pubprofile-empty">No comments yet.</div>
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
                      </div>
                      <p className="profile-comment-item-text">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "followers" && (
            <div className="pubprofile-section">
              {followers.length === 0 ? (
                <div className="pubprofile-empty">No followers yet.</div>
              ) : (
                <div className="pubprofile-user-list">
                  {followers.map((f) => (
                    <div
                      className="pubprofile-user-row"
                      key={f.uid}
                      onClick={() => navigate(`/user/${f.uid}`)}
                    >
                      <div className="pubprofile-user-avatar">
                        {f.profilePicture ? (
                          <img src={f.profilePicture} alt="" />
                        ) : (
                          (f.username || "?").charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="pubprofile-user-name">
                        {f.username || "Anonymous"}
                      </span>
                      <svg
                        className="pubprofile-user-arrow"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "following" && (
            <div className="pubprofile-section">
              {following.length === 0 ? (
                <div className="pubprofile-empty">
                  Not following anyone yet.
                </div>
              ) : (
                <div className="pubprofile-user-list">
                  {following.map((f) => (
                    <div
                      className="pubprofile-user-row"
                      key={f.uid}
                      onClick={() => navigate(`/user/${f.uid}`)}
                    >
                      <div className="pubprofile-user-avatar">
                        {f.profilePicture ? (
                          <img src={f.profilePicture} alt="" />
                        ) : (
                          (f.username || "?").charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="pubprofile-user-name">
                        {f.username || "Anonymous"}
                      </span>
                      <svg
                        className="pubprofile-user-arrow"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "cases" && (
            <div className="pubprofile-section">
              {casesCreated.length === 0 ? (
                <div className="pubprofile-empty">No cases created yet.</div>
              ) : (
                <div className="pubprofile-user-list">
                  {casesCreated.map((c) => (
                    <div
                      className="pubprofile-user-row"
                      key={c.id}
                      onClick={() => navigate(`/story/${c.id}`)}
                    >
                      <div className="pubprofile-case-icon">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      <span className="pubprofile-user-name">{c.name}</span>
                      <svg
                        className="pubprofile-user-arrow"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
