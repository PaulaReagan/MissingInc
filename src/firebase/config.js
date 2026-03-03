import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCv3sqXEDjyZMTIYC_RQtcW5KfrDaUB9Kw",
  authDomain: "website-9bfb4.firebaseapp.com",
  projectId: "website-9bfb4",
  storageBucket: "website-9bfb4.firebasestorage.app",
  messagingSenderId: "147260538451",
  appId: "1:147260538451:web:5b7b6fde27dcf392ffd0a6",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
