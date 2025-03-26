import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyABt0tpywqGv_o1eESnPF-KFWbZqGEI6rk",
  authDomain: "timey-cb25d.firebaseapp.com",
  projectId: "timey-cb25d",
  storageBucket: "timey-cb25d.firebasestorage.app",
  messagingSenderId: "645381009437",
  appId: "1:645381009437:web:b8b74f9f675e689a80d6f4",
  measurementId: "G-BJZ21NMYBY",
};

// Initialize Firebase if it hasn't been initialized yet
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
