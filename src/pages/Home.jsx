import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Home() {
  const { currentUser, userProfile, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  const displayName =
    userProfile?.username || currentUser?.displayName || currentUser?.email;

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="home-logo">MyApp</div>
        <div className="home-user-section">
          <div className="home-avatar">
            {displayName?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <span className="home-username">{displayName}</span>
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
        <h1 className="home-title">Welcome to your homepage</h1>
        <p className="home-subtitle">You're signed in as <strong>{displayName}</strong></p>
      </main>
    </div>
  );
}
