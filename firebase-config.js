// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDO1S8MfP16d6U6XCp5zRVt-m1ETgn6KQ8",
  authDomain: "auth-8d8f9.firebaseapp.com",
  projectId: "auth-8d8f9",
  storageBucket: "auth-8d8f9.firebasestorage.app",
  messagingSenderId: "1034040388140",
  appId: "1:1034040388140:web:7397bb62834218d8ee7f89",
  measurementId: "G-YTSBB97GR4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
