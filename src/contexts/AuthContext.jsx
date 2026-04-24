import { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
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
    if (!newUsername || newUsername.trim().length < 3) {
      throw new Error("Username must be at least 3 characters.");
    }
    const trimmed = newUsername.trim();
    await updateDoc(doc(db, "users", currentUser.uid), {
      username: trimmed,
    });
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
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
