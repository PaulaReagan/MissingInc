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
    if (!newUsername || newUsername.trim().length < 3) {
      throw new Error("Username must be at least 3 characters.");
    }
    const trimmed = newUsername.trim();

    // Collect every write we need to do so we can batch them
    const writes = [];

    // 1. Update the user's own profile doc
    writes.push([doc(db, "users", currentUser.uid), { username: trimmed }]);

    // 2. Update authorName on every comment history entry + its story thread copy
    const historySnap = await getDocs(
      collection(db, "users", currentUser.uid, "commentHistory")
    );
    historySnap.forEach((d) => {
      const data = d.data();
      // History entry
      writes.push([
        doc(db, "users", currentUser.uid, "commentHistory", d.id),
        { authorName: trimmed },
      ]);
      // Live story thread comment
      if (data.storyId && data.storyCommentId) {
        writes.push([
          doc(db, "stories", data.storyId, "comments", data.storyCommentId),
          { authorName: trimmed },
        ]);
      }
    });

    // 3. Update createdByName on every story this user created
    const storiesSnap = await getDocs(
      query(collection(db, "stories"), where("createdBy", "==", currentUser.uid))
    );
    storiesSnap.forEach((d) => {
      writes.push([doc(db, "stories", d.id), { createdByName: trimmed }]);
    });

    // 4. Update the username stored in each follower's "following" list
    //    so their Following tab shows the new name
    const followersSnap = await getDocs(
      collection(db, "users", currentUser.uid, "followers")
    );
    followersSnap.forEach((d) => {
      writes.push([
        doc(db, "users", d.id, "following", currentUser.uid),
        { username: trimmed },
      ]);
    });

    // Commit in batches of 500 (Firestore hard limit)
    for (let i = 0; i < writes.length; i += 500) {
      const batch = writeBatch(db);
      writes.slice(i, i + 500).forEach(([ref, data]) => batch.update(ref, data));
      await batch.commit();
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
