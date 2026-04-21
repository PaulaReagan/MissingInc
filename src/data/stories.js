import {
  collection,
  addDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB

export async function uploadStoryPhoto(file, user) {
  if (!user) throw new Error("You must be logged in to upload a photo.");
  if (!file) throw new Error("No file provided.");
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Image is too large (max 8 MB).");
  }

  const safeName = (file.name || "photo").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `storyPhotos/${user.uid}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return await getDownloadURL(storageRef);
}

const STORIES_COLLECTION = "stories";

export function subscribeToStories(onData, onError) {
  const q = query(
    collection(db, STORIES_COLLECTION),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const stories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(stories);
    },
    (err) => {
      console.error("Failed to subscribe to stories:", err);
      if (onError) onError(err);
    }
  );
}

export async function createStory(data, user) {
  if (!user) throw new Error("You must be logged in to create a case.");
  if (!data.name || !data.name.trim()) {
    throw new Error("Name is required.");
  }

  const payload = {
    name: data.name.trim(),
    age: data.age?.toString().trim() || "-",
    image: data.image?.trim() || "",
    lastSeen: data.lastSeen?.trim() || "-",
    lastSeenDate: data.lastSeenDate?.trim() || "-",
    height: data.height?.trim() || "-",
    weight: data.weight?.trim() || "-",
    hair: data.hair?.trim() || "-",
    eyes: data.eyes?.trim() || "-",
    summary: data.summary?.trim() || "-",
    lat: typeof data.lat === "number" ? data.lat : null,
    lng: typeof data.lng === "number" ? data.lng : null,
    createdBy: user.uid,
    createdByName:
      data.createdByName || user.displayName || user.email || "Anonymous",
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, STORIES_COLLECTION), payload);
  return docRef.id;
}

export async function getStoryById(id) {
  const snapshot = await getDoc(doc(db, STORIES_COLLECTION, id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}
