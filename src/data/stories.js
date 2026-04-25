import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../firebase/config";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
const COMPRESSION_SKIP_BELOW_BYTES = 500 * 1024; // don't bother for tiny files
const MAX_IMAGE_DIMENSION = 1600; // px — plenty for a case photo
const JPEG_QUALITY = 0.85;

async function compressImageIfNeeded(file) {
  if (file.size <= COMPRESSION_SKIP_BELOW_BYTES) return file;
  // GIFs/animated images: skip compression (canvas would kill animation)
  if (file.type === "image/gif") return file;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;
      const longest = Math.max(width, height);
      const scale = longest > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longest : 1;
      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const resized = new File(
            [blob],
            (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg",
            { type: "image/jpeg" }
          );
          // Only swap to the resized version if it's actually smaller
          resolve(resized.size < file.size ? resized : file);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

export async function uploadStoryPhoto(file, user, onProgress) {
  if (!user) throw new Error("You must be logged in to upload a photo.");
  if (!file) throw new Error("No file provided.");
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Image is too large (max 8 MB).");
  }

  const prepared = await compressImageIfNeeded(file);

  const safeName = (prepared.name || "photo").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `storyPhotos/${user.uid}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, prepared, {
    contentType: prepared.type,
  });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(pct);
        }
      },
      (err) => reject(err),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

const STORIES_COLLECTION = "stories";

export function subscribeToStories(onData, onError) {
  // No orderBy on the server — avoids Firestore silently dropping documents
  // whose createdAt is null/pending. We sort client-side instead.
  return onSnapshot(
    collection(db, STORIES_COLLECTION),
    (snapshot) => {
      const stories = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aMs =
            typeof a.createdAt?.toMillis === "function"
              ? a.createdAt.toMillis()
              : a.createdAt
              ? new Date(a.createdAt).getTime()
              : 0;
          const bMs =
            typeof b.createdAt?.toMillis === "function"
              ? b.createdAt.toMillis()
              : b.createdAt
              ? new Date(b.createdAt).getTime()
              : 0;
          return bMs - aMs;
        });
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

export async function updateStory(storyId, data, user) {
  if (!user) throw new Error("You must be logged in to edit a case.");
  if (!data.name || !data.name.trim()) throw new Error("Name is required.");

  const fields = {
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
    updatedAt: serverTimestamp(),
  };

  const docRef = doc(db, STORIES_COLLECTION, storyId);
  const existing = await getDoc(docRef);

  if (existing.exists()) {
    // Real Firestore story — update content fields, preserve original creator info
    await updateDoc(docRef, fields);
  } else {
    // Featured/mock story being edited for the first time — promote it to a
    // real Firestore document so it appears in the feed
    await setDoc(docRef, {
      ...fields,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      createdByName: data.createdByName || user.displayName || user.email || "Admin",
    });
  }
}

export async function deleteStory(storyId, user) {
  if (!user) throw new Error("You must be logged in.");
  await deleteDoc(doc(db, STORIES_COLLECTION, storyId));
}

export async function uploadToCloudinary(file) {
  const cloudName = "dmij1sxor";
  const uploadPreset = "missingsonoma_unsigned";

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Cloudinary upload failed");
  }

  const data = await res.json();
  return data.secure_url;
}
