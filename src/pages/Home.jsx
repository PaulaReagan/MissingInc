import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToStories } from "../data/stories";
import CreateCaseModal from "../components/CreateCaseModal";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=500&fit=crop";

const MOCK_STORIES = [
  {
    id: "1",
    name: "Person 1",
    age: "-",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop&crop=face",
    lastSeen: "Santa Rosa, CA",
    lastSeenDate: "2026-04-10",
    lat: 38.4405,
    lng: -122.7144,
    height: "-",
    weight: "-",
    hair: "-",
    eyes: "-",
    summary: "-",
  },
  {
    id: "2",
    name: "Person 2",
    age: "-",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop&crop=face",
    lastSeen: "Petaluma, CA",
    lastSeenDate: "2026-04-12",
    lat: 38.2919,
    lng: -122.458,
    height: "-",
    weight: "-",
    hair: "-",
    eyes: "-",
    summary: "-",
  },
  {
    id: "3",
    name: "Person 3",
    age: "-",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&crop=face",
    lastSeen: "Rohnert Park, CA",
    lastSeenDate: "2026-04-08",
    lat: 38.2324,
    lng: -122.6367,
    height: "-",
    weight: "-",
    hair: "-",
    eyes: "-",
    summary: "-",
  },
];

export default function Home() {
  const { currentUser, userProfile, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [firestoreStories, setFirestoreStories] = useState([]);
  const sliderRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToStories(setFirestoreStories);
    return unsubscribe;
  }, []);

  const allStories = [...firestoreStories, ...MOCK_STORIES];

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  function scrollSlider(direction) {
    if (!sliderRef.current) return;
    const cardWidth =
      sliderRef.current.querySelector(".slider-card")?.offsetWidth || 260;
    const gap = 20;
    const scrollAmount = (cardWidth + gap) * 2;
    sliderRef.current.scrollBy({
      left: direction === "right" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  }

  const displayName =
    userProfile?.username || currentUser?.displayName || currentUser?.email;
  const profilePicture = userProfile?.profilePicture;

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="home-logo">Missing: Sonoma County</div>
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

          <Link to="/map">
            <button className="btn">Map</button>
          </Link>

          <button
            onClick={handleLogout}
            className="btn btn-logout"
            disabled={loggingOut}
          >
            {loggingOut ? "Logging out..." : "Sign Out"}
          </button>
        </div>
      </header>

      <main className="home-main">
        <h1 className="home-title">Featured Stories</h1>
        <p className="home-subtitle">Help bring the missing home</p>

        <div className="home-cta-row">
          <button
            className="btn btn-primary home-create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create New Case
          </button>
        </div>

        <div className="slider-wrapper">
          <button
            className="slider-arrow slider-arrow-left"
            onClick={() => scrollSlider("left")}
            aria-label="Scroll left"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="slider-track" ref={sliderRef}>
            {allStories.map((story) => (
              <div
                className="slider-card"
                key={story.id}
                onClick={() => navigate(`/story/${story.id}`)}
              >
                <div
                  className={
                    "slider-card-credit" +
                    (story.createdBy ? " slider-card-credit-user" : "")
                  }
                >
                  {story.createdBy
                    ? `Case Created By: ${story.createdByName || "Anonymous"}`
                    : "Featured Story"}
                </div>
                <div className="slider-card-image">
                  <img
                    src={story.image || PLACEHOLDER_IMAGE}
                    alt={story.name}
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                </div>
                <div className="slider-card-info">
                  <span className="slider-card-name">{story.name}</span>
                  <span className="slider-card-age">Age {story.age}</span>
                  <span className="slider-card-location">
                    Last seen: {story.lastSeen}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            className="slider-arrow slider-arrow-right"
            onClick={() => scrollSlider("right")}
            aria-label="Scroll right"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </main>

      {showCreateModal && (
        <CreateCaseModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

export { MOCK_STORIES };
