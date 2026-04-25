import {
  collection,
  doc,
  addDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";

export function getConversationId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

export async function sendMessage(
  convId,
  text,
  senderUid,
  senderInfo,
  recipientUid,
  recipientInfo
) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const lastMsg = {
    text: trimmed,
    senderId: senderUid,
    sentAt: new Date().toISOString(),
  };

  await setDoc(
    doc(db, "conversations", convId),
    {
      participants: [senderUid, recipientUid].sort(),
      participantInfo: {
        [senderUid]: senderInfo,
        [recipientUid]: recipientInfo,
      },
      lastMessage: lastMsg,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await addDoc(collection(db, "conversations", convId, "messages"), {
    text: trimmed,
    senderId: senderUid,
    sentAt: serverTimestamp(),
  });
}

export function subscribeToConversations(uid, onData) {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", uid)
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("conversations snapshot error:", err)
  );
}

export function subscribeToMessages(convId, onData) {
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("sentAt", "asc")
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("messages snapshot error:", err)
  );
}
