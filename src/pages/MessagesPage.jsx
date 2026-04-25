import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import {
  getConversationId,
  sendMessage,
  subscribeToConversations,
  subscribeToMessages,
} from "../data/messages";

function ChatBubbleIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SendIcon() {
  return (
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
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function Avatar({ user, size = 36 }) {
  const initial = (user?.username || user?.displayName || "?")
    .charAt(0)
    .toUpperCase();
  return user?.profilePicture ? (
    <img
      src={user.profilePicture}
      alt=""
      className="dm-avatar-img"
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
    />
  ) : (
    <div
      className="dm-avatar-initials"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

function formatTime(sentAt) {
  if (!sentAt) return "";
  const date =
    typeof sentAt.toDate === "function"
      ? sentAt.toDate()
      : new Date(sentAt);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function MessagesPage() {
  const { currentUser: cu, userProfile: up } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedUid, setSelectedUid] = useState(searchParams.get("uid") || null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Subscribe to followers
  useEffect(() => {
    if (!cu) return;
    const q = collection(db, "users", cu.uid, "followers");
    return onSnapshot(q, (snap) => {
      setFollowers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    });
  }, [cu]);

  // Subscribe to following
  useEffect(() => {
    if (!cu) return;
    const q = collection(db, "users", cu.uid, "following");
    return onSnapshot(q, (snap) => {
      setFollowing(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    });
  }, [cu]);

  // Subscribe to conversations
  useEffect(() => {
    if (!cu) return;
    return subscribeToConversations(cu.uid, setConversations);
  }, [cu]);

  // Merge followers + following into unique contact list, enriched with last message
  const contacts = useMemo(() => {
    if (!cu) return [];
    const map = new Map();
    followers.forEach((f) => map.set(f.uid, f));
    following.forEach((f) => map.set(f.uid, f));

    return Array.from(map.values())
      .map((contact) => {
        const convId = getConversationId(cu.uid, contact.uid);
        const conv = conversations.find((c) => c.id === convId);
        const updatedAt = conv?.updatedAt;
        return {
          ...contact,
          lastMessage: conv?.lastMessage || null,
          updatedAtMs: updatedAt
            ? typeof updatedAt.toMillis === "function"
              ? updatedAt.toMillis()
              : new Date(updatedAt).getTime()
            : 0,
        };
      })
      .sort((a, b) => {
        if (a.updatedAtMs !== b.updatedAtMs) return b.updatedAtMs - a.updatedAtMs;
        return (a.username || "").localeCompare(b.username || "");
      });
  }, [followers, following, conversations, cu]);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c) => (c.username || "").toLowerCase().includes(q));
  }, [contacts, search]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.uid === selectedUid) || null,
    [contacts, selectedUid]
  );

  // Subscribe to messages for selected conversation
  useEffect(() => {
    if (!selectedUid || !cu) {
      setMessages([]);
      return;
    }
    const convId = getConversationId(cu.uid, selectedUid);
    return subscribeToMessages(convId, setMessages);
  }, [selectedUid, cu]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when contact changes
  useEffect(() => {
    if (selectedUid) inputRef.current?.focus();
  }, [selectedUid]);

  async function handleSend(e) {
    e.preventDefault();
    if (!messageText.trim() || !selectedUid || !cu || sending) return;
    setSending(true);

    const convId = getConversationId(cu.uid, selectedUid);
    const senderInfo = {
      username: up?.username || cu.displayName || cu.email || "Anonymous",
      profilePicture: up?.profilePicture || null,
    };
    const recipientInfo = {
      username: selectedContact?.username || "Unknown",
      profilePicture: selectedContact?.profilePicture || null,
    };

    try {
      await sendMessage(convId, messageText, cu.uid, senderInfo, selectedUid, recipientInfo);
      setMessageText("");
    } catch (err) {
      console.error("Failed to send:", err);
    }
    setSending(false);
  }

  const myDisplayName = up?.username || cu?.displayName || cu?.email;
  const myProfilePicture = up?.profilePicture;

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
            className="nav-msg-btn nav-msg-btn-active"
            onClick={() => navigate("/messages")}
            title="Direct Messages"
            aria-label="Direct Messages"
          >
            <ChatBubbleIcon size={18} />
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

      <main className={`dm-page${selectedUid ? " dm-conversation-open" : ""}`}>
        {/* ── Left sidebar: contact list ── */}
        <aside className="dm-sidebar">
          <div className="dm-sidebar-header">
            <h2 className="dm-sidebar-title">Messages</h2>
          </div>

          <div className="dm-search-wrap">
            <input
              className="dm-search"
              type="search"
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="dm-contact-list">
            {filteredContacts.length === 0 && (
              <div className="dm-no-contacts">
                {contacts.length === 0
                  ? "Follow someone to start a conversation."
                  : "No contacts match your search."}
              </div>
            )}

            {filteredContacts.map((contact) => {
              const isSelected = contact.uid === selectedUid;
              const preview = contact.lastMessage?.text;
              const previewIsMe = contact.lastMessage?.senderId === cu?.uid;
              return (
                <button
                  key={contact.uid}
                  className={`dm-contact${isSelected ? " dm-contact-selected" : ""}`}
                  onClick={() => {
                    setSelectedUid(contact.uid);
                    setMessages([]);
                  }}
                >
                  <Avatar user={contact} size={40} />
                  <div className="dm-contact-info">
                    <span className="dm-contact-name">{contact.username || "Unknown"}</span>
                    {preview && (
                      <span className="dm-contact-preview">
                        {previewIsMe ? "You: " : ""}
                        {preview.length > 40 ? preview.slice(0, 40) + "…" : preview}
                      </span>
                    )}
                  </div>
                  {contact.lastMessage?.sentAt && (
                    <span className="dm-contact-time">
                      {formatTime(contact.lastMessage.sentAt)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Right panel: conversation ── */}
        <section className="dm-main">
          {!selectedContact ? (
            <div className="dm-empty-state">
              <ChatBubbleIcon size={48} />
              <p>Select a contact to start messaging</p>
              <span>You can message anyone you follow or who follows you</span>
            </div>
          ) : (
            <>
              <div className="dm-conv-header">
                <button
                  className="dm-back-btn"
                  onClick={() => setSelectedUid(null)}
                  title="Back to contacts"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <div
                  className="dm-conv-header-identity"
                  onClick={() => navigate(`/user/${selectedContact.uid}`)}
                  title={`View ${selectedContact.username}'s profile`}
                >
                  <Avatar user={selectedContact} size={36} />
                  <div className="dm-conv-header-info">
                    <span className="dm-conv-header-name">{selectedContact.username}</span>
                  </div>
                </div>
              </div>

              <div className="dm-messages">
                {messages.length === 0 && (
                  <div className="dm-messages-empty">
                    No messages yet — say hello!
                  </div>
                )}
                {messages.map((msg) => {
                  const isMe = msg.senderId === cu?.uid;
                  return (
                    <div
                      key={msg.id}
                      className={`dm-message${isMe ? " dm-message-me" : " dm-message-them"}`}
                    >
                      {!isMe && (
                        <div className="dm-message-avatar">
                          <Avatar user={selectedContact} size={28} />
                        </div>
                      )}
                      <div className="dm-message-bubble-wrap">
                        <div className="dm-message-bubble">{msg.text}</div>
                        <span className="dm-message-time">{formatTime(msg.sentAt)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form className="dm-compose" onSubmit={handleSend}>
                <input
                  ref={inputRef}
                  className="dm-compose-input"
                  type="text"
                  placeholder={`Message ${selectedContact.username}…`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={sending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) handleSend(e);
                  }}
                />
                <button
                  type="submit"
                  className="dm-send-btn"
                  disabled={sending || !messageText.trim()}
                  aria-label="Send message"
                >
                  <SendIcon />
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
