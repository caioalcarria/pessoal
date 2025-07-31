import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyA1wPd6sw7QpwmBNuXmzyGHssQ6g-VePB8",
  authDomain: "month-tasks.firebaseapp.com",
  projectId: "month-tasks",
  storageBucket: "month-tasks.firebasestorage.app",
  messagingSenderId: "648814413267",
  appId: "1:648814413267:web:1acbf8590e56bde2895b26",
  measurementId: "G-T9M6F7YBZL",
};

export const appId = "month-tasks";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
