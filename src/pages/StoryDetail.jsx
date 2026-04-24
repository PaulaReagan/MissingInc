import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { MOCK_STORIES } from "./Home";
import { getStoryById, deleteStory } from "../data/stories";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=500&fit=crop";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function StoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const mockStory = MOCK_STORIES.find((s) => s.id === id);
  const [story, setStory] = useState(mockStory || null);
  const [loadingStory, setLoadingStory] = useState(!mockStory);

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner =
    story && story.createdBy && currentUser && story.createdBy === currentUser.uid;

  async function handleDeleteStory() {
    if (!story || !isOwner) return;
    if (!confirm(`Delete this case for ${story.name}? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteStory(story.id, currentUser);
      navigate("/");
    } catch (err) {
      console.error("Failed to delete story:", err);
      alert("Could not delete the case. " + (err.message || ""));
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (mockStory) {
      setStory(mockStory);
      setLoadingStory(false);
      return;
    }
    let active = true;
    setLoadingStory(true);
    getStoryById(id)
      .then((fetched) => {
        if (active) {
          setStory(fetched);
          setLoadingStory(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load story:", err);
        if (active) {
          setStory(null);
          setLoadingStory(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, mockStory]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "stories", id, "comments"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setComments(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      },
      (err) => console.error("Failed to load comments:", err)
    );
    return unsubscribe;
  }, [id]);

  async function handlePostComment(e) {
    e.preventDefault();
    if (!newComment.trim() || posting) return;
    setPosting(true);
    try {
      const commentData = {
        text: newComment.trim(),
        authorId: currentUser.uid,
        authorName:
          userProfile?.username ||
          currentUser.displayName ||
          currentUser.email,
        authorPicture: userProfile?.profilePicture || null,
        createdAt: new Date().toISOString(),
        storyId: id,
        storyName: story?.name || "Unknown",
      };

      const storyCommentRef = await addDoc(
        collection(db, "stories", id, "comments"),
        commentData
      );

      await addDoc(
        collection(db, "users", currentUser.uid, "commentHistory"),
        {
          ...commentData,
          storyCommentId: storyCommentRef.id,
        }
      );

      setNewComment("");
    } catch (err) {
      console.error("Failed to post comment:", err);
    }
    setPosting(false);
  }

  async function handleDeleteComment(comment) {
    if (!confirm("Delete this comment?")) return;
    try {
      await deleteDoc(doc(db, "stories", id, "comments", comment.id));

      const historyQuery = query(
        collection(db, "users", comment.authorId, "commentHistory"),
        orderBy("createdAt", "desc")
      );
      const unsubOnce = onSnapshot(historyQuery, (snapshot) => {
        const match = snapshot.docs.find(
          (d) => d.data().storyCommentId === comment.id
        );
        if (match) {
          deleteDoc(
            doc(db, "users", comment.authorId, "commentHistory", match.id)
          );
        }
        unsubOnce();
      });
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

  if (loadingStory) {
    return (
      <div className="story-not-found">
        <h1>Loading…</h1>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="story-not-found">
        <h1>Story not found</h1>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="story-detail">
      <button className="story-back" onClick={() => navigate("/")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Stories
      </button>

      <div className="story-content">
        <div className="story-image-col">
          <img
            src={story.image || PLACEHOLDER_IMAGE}
            alt={story.name}
            className="story-hero-image"
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER_IMAGE;
            }}
          />

          {typeof story.lat === "number" && typeof story.lng === "number" && (
            <div className="story-map-card">
              <div className="story-map-header">
                <span className="story-map-label">Last Seen</span>
                <span className="story-map-location">{story.lastSeen}</span>
              </div>
              <div className="story-map-wrapper">
                <MapContainer
                  center={[story.lat, story.lng]}
                  zoom={12}
                  scrollWheelZoom={false}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[story.lat, story.lng]}>
                    <Popup>
                      <strong>{story.name}</strong>
                      <br />
                      Last seen: {story.lastSeen}
                      <br />
                      Date: {story.lastSeenDate}
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
              <button
                type="button"
                className="story-map-open"
                onClick={() => navigate("/map")}
              >
                Open full map →
              </button>
            </div>
          )}
        </div>

        <div className="story-info-col">
          <div
            className={
              "story-credit-row" +
              (story.createdBy ? " story-credit-user" : " story-credit-featured")
            }
          >
            <span className="story-credit-text">
              {story.createdBy
                ? `Case Created By: ${story.createdByName || "Anonymous"}`
                : "Featured Story"}
            </span>
            {isOwner && (
              <button
                type="button"
                className="story-delete-btn"
                onClick={handleDeleteStory}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete Case"}
              </button>
            )}
          </div>
          <h1 className="story-name">{story.name}</h1>
          <span className="story-status-badge">Missing</span>

          <div className="story-details-grid">
            <div className="story-detail-item">
              <span className="story-detail-label">Age</span>
              <span className="story-detail-value">{story.age}</span>
            </div>
            <div className="story-detail-item">
              <span className="story-detail-label">Last Seen</span>
              <span className="story-detail-value">{story.lastSeen}</span>
            </div>
            <div className="story-detail-item">
              <span className="story-detail-label">Date</span>
              <span className="story-detail-value">{story.lastSeenDate}</span>
            </div>
            <div className="story-detail-item">
              <span className="story-detail-label">Height</span>
              <span className="story-detail-value">{story.height}</span>
            </div>
            <div className="story-detail-item">
              <span className="story-detail-label">Weight</span>
              <span className="story-detail-value">{story.weight}</span>
            </div>
            <div className="story-detail-item">
              <span className="story-detail-label">Hair</span>
              <span className="story-detail-value">{story.hair}</span>
            </div>
            <div className="story-detail-item">
              <span className="story-detail-label">Eyes</span>
              <span className="story-detail-value">{story.eyes}</span>
            </div>
          </div>

          <div className="story-summary">
            <h2 className="story-summary-heading">Story</h2>
            <p className="story-summary-text">{story.summary}</p>
          </div>
        </div>
      </div>

      <div className="thread-section">
        <h2 className="thread-heading">
          Community Discussion
          <span className="thread-count">{comments.length}</span>
        </h2>

        <form className="thread-compose" onSubmit={handlePostComment}>
          <div className="thread-compose-avatar">
            {userProfile?.profilePicture ? (
              <img src={userProfile.profilePicture} alt="" />
            ) : (
              (userProfile?.username || currentUser?.email || "U")
                .charAt(0)
                .toUpperCase()
            )}
          </div>
          <div className="thread-compose-input-wrapper">
            <textarea
              className="thread-compose-input"
              placeholder="Share your thoughts, tips, or information..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />
            <button
              type="submit"
              className="btn btn-primary thread-compose-btn"
              disabled={posting || !newComment.trim()}
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </form>

        <div className="thread-comments">
          {comments.length === 0 && (
            <div className="thread-empty">
              No comments yet. Be the first to share your thoughts.
            </div>
          )}

          {comments.map((comment) => (
            <div className="thread-comment" key={comment.id}>
              <div className="thread-comment-avatar">
                {comment.authorPicture ? (
                  <img src={comment.authorPicture} alt="" />
                ) : (
                  (comment.authorName || "U").charAt(0).toUpperCase()
                )}
              </div>
              <div className="thread-comment-body">
                <div className="thread-comment-header">
                  <span className="thread-comment-author">
                    {comment.authorName}
                  </span>
                  <span className="thread-comment-time">
                    {timeAgo(comment.createdAt)}
                  </span>
                  {comment.authorId === currentUser?.uid && (
                    <button
                      className="thread-comment-delete"
                      onClick={() => handleDeleteComment(comment)}
                      title="Delete comment"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="thread-comment-text">{comment.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
