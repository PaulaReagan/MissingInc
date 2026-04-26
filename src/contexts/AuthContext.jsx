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
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { uploadToCloudinary } from "../data/stories";
import { auth, googleProvider, db, storage } from "../firebase/config";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(email, password, username) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCredential.user.uid), {
      username,
      email,
      createdAt: new Date().toISOString(),
    });
    return userCredential;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    const userDoc = await getDoc(doc(db, "users", result.user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, "users", result.user.uid), {
        username: result.user.displayName || result.user.email.split("@")[0],
        email: result.user.email,
        createdAt: new Date().toISOString(),
      });
    }
    return result;
  }

  function logout() {
    return signOut(auth);
  }

async function updateUsername(newUsername) {
  if (!currentUser) throw new Error("Not authenticated");

  console.log("AUTH USER:", {
    uid: currentUser.uid,
    email: currentUser.email,
  });

  const trimmed = newUsername.trim();

  console.log("ABOUT TO UPDATE DOC:", `users/${currentUser.uid}`);

  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      username: trimmed,
    });
    console.log("UPDATE SUCCESS");
  } catch (err) {
    console.error("UPDATE USERNAME ERROR:", err);
    console.error("ERROR CODE:", err.code);
    console.error("ERROR MESSAGE:", err.message);
    throw err;
  }

  setUserProfile((prev) => ({ ...prev, username: trimmed }));
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

  async function followUser(targetUid, targetProfile) {
    if (!currentUser) throw new Error("Not authenticated");
    const now = new Date().toISOString();
    const myInfo = {
      username: userProfile?.username || currentUser.displayName || currentUser.email,
      profilePicture: userProfile?.profilePicture || null,
      followedAt: now,
    };
    const targetInfo = {
      username: targetProfile?.username || "Anonymous",
      profilePicture: targetProfile?.profilePicture || null,
      followedAt: now,
    };
    await setDoc(doc(db, "users", currentUser.uid, "following", targetUid), targetInfo);
    await setDoc(doc(db, "users", targetUid, "followers", currentUser.uid), myInfo);
  }

  async function unfollowUser(targetUid) {
    if (!currentUser) throw new Error("Not authenticated");
    await deleteDoc(doc(db, "users", currentUser.uid, "following", targetUid));
    await deleteDoc(doc(db, "users", targetUid, "followers", currentUser.uid));
  }

  async function fetchUserProfile(user) {
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      } else {
        setUserProfile({ username: user.displayName || user.email });
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

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
    loginWithGoogle,
    logout,
    updateUsername,
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
