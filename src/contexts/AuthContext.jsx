import { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { auth, googleProvider, db } from "../firebase/config";
import { uploadToCloudinary } from "../data/stories";

const AuthContext = createContext();

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function validateUsername(value) {
  const normalized = normalizeUsername(value);
  if (!USERNAME_REGEX.test(normalized)) {
    throw new Error(
      "Username must be 3-20 characters and can only contain lowercase letters, numbers, and underscores."
    );
  }
  return normalized;
}

function validateDisplayName(value) {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 40) {
    throw new Error("Name must be between 2 and 40 characters.");
  }
  return trimmed;
}

async function findAvailableUsername(seed) {
  let base = normalizeUsername(seed || "user")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);

  if (base.length < 3) base = "user";

  let candidate = base;
  let counter = 1;

  while (true) {
    const snap = await getDoc(doc(db, "usernames", candidate));
    if (!snap.exists()) return candidate;

    const suffix = `_${counter}`;
    const trimmedBase = base.slice(0, 20 - suffix.length);
    candidate = `${trimmedBase}${suffix}`;
    counter += 1;
  }
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(email, password, username, displayName = "") {
    const cleanUsername = validateUsername(username);
    const cleanDisplayName = validateDisplayName(displayName || username);

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", uid);
      const usernameRef = doc(db, "usernames", cleanUsername);

      const usernameSnap = await transaction.get(usernameRef);
      if (usernameSnap.exists()) {
        throw new Error("Username is already taken.");
      }

      transaction.set(userRef, {
        username: cleanUsername,
        displayName: cleanDisplayName,
        email,
        createdAt: serverTimestamp(),
      });

      transaction.set(usernameRef, {
        uid,
        createdAt: serverTimestamp(),
      });
    });

    return userCredential;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    const uid = result.user.uid;
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      const seed =
        result.user.email?.split("@")[0] ||
        result.user.displayName ||
        "user";

      const availableUsername = await findAvailableUsername(seed);
      const cleanDisplayName = validateDisplayName(
        result.user.displayName || availableUsername
      );

      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", availableUsername);
        const usernameSnap = await transaction.get(usernameRef);

        if (usernameSnap.exists()) {
          throw new Error("Generated username is already taken. Please try again.");
        }

        transaction.set(userRef, {
          username: availableUsername,
          displayName: cleanDisplayName,
          email: result.user.email,
          createdAt: serverTimestamp(),
        });

        transaction.set(usernameRef, {
          uid,
          createdAt: serverTimestamp(),
        });
      });
    }

    return result;
  }

  function logout() {
    return signOut(auth);
  }

  async function updateUsername(newUsername) {
    if (!currentUser) throw new Error("Not authenticated");

    const cleanUsername = validateUsername(newUsername);
    const userRef = doc(db, "users", currentUser.uid);

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("User profile not found.");

      const currentData = userSnap.data();
      const oldUsername = currentData.username;

      if (oldUsername === cleanUsername) return;

      const newUsernameRef = doc(db, "usernames", cleanUsername);
      const newUsernameSnap = await transaction.get(newUsernameRef);

      if (newUsernameSnap.exists() && newUsernameSnap.data().uid !== currentUser.uid) {
        throw new Error("Username is already taken.");
      }

      transaction.set(newUsernameRef, {
        uid: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      transaction.update(userRef, {
        username: cleanUsername,
      });

      if (oldUsername) {
        const oldUsernameRef = doc(db, "usernames", oldUsername);
        transaction.delete(oldUsernameRef);
      }
    });

    setUserProfile((prev) => ({ ...prev, username: cleanUsername }));
  }

  async function updateDisplayName(newDisplayName) {
    if (!currentUser) throw new Error("Not authenticated");

    const cleanDisplayName = validateDisplayName(newDisplayName);

    await updateDoc(doc(db, "users", currentUser.uid), {
      displayName: cleanDisplayName,
    });

    setUserProfile((prev) => ({ ...prev, displayName: cleanDisplayName }));
  }

  async function uploadProfilePicture(file) {
    if (!currentUser) throw new Error("Not authenticated");

    const downloadURL = await uploadToCloudinary(file);

    await updateDoc(doc(db, "users", currentUser.uid), {
      profilePicture: downloadURL,
    });

    setUserProfile((prev) => ({ ...prev, profilePicture: downloadURL }));
    return downloadURL;
  }

  async function fetchUserProfile(user) {
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      } else {
        setUserProfile({
          username: user.displayName || user.email,
          displayName: user.displayName || user.email,
        });
      }
    } else {
      setUserProfile(null);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      try {
        await fetchUserProfile(user);
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

async function followUser(targetUid, targetProfile) {
  if (!currentUser) throw new Error("Not authenticated");
  if (!targetUid) throw new Error("No user selected");
  if (targetUid === currentUser.uid) throw new Error("You cannot follow yourself");

  const myFollowingRef = doc(db, "users", currentUser.uid, "following", targetUid);
  const theirFollowerRef = doc(db, "users", targetUid, "followers", currentUser.uid);

  await setDoc(myFollowingRef, {
    uid: targetUid,
    username: targetProfile?.username || "Anonymous",
    displayName: targetProfile?.displayName || targetProfile?.username || "Anonymous",
    profilePicture: targetProfile?.profilePicture || "",
    createdAt: serverTimestamp(),
  });

  await setDoc(theirFollowerRef, {
    uid: currentUser.uid,
    username: userProfile?.username || currentUser.email?.split("@")[0] || "Anonymous",
    displayName:
      userProfile?.displayName ||
      userProfile?.username ||
      currentUser.displayName ||
      currentUser.email ||
      "Anonymous",
    profilePicture: userProfile?.profilePicture || "",
    createdAt: serverTimestamp(),
  });
}

async function unfollowUser(targetUid) {
  if (!currentUser) throw new Error("Not authenticated");
  if (!targetUid) throw new Error("No user selected");

  const myFollowingRef = doc(db, "users", currentUser.uid, "following", targetUid);
  const theirFollowerRef = doc(db, "users", targetUid, "followers", currentUser.uid);

  await deleteDoc(myFollowingRef);
  await deleteDoc(theirFollowerRef);
}

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
    loginWithGoogle,
    logout,
    updateUsername,
    updateDisplayName,
    uploadProfilePicture,
    followUser,
    unfollowUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
