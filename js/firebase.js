import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5QmrAYVacp-HsPWh4n4mkXmruGATTZ8o",
  authDomain: "kucun-2cb51.firebaseapp.com",
  projectId: "kucun-2cb51",
  storageBucket: "kucun-2cb51.firebasestorage.app",
  messagingSenderId: "170723608901",
  appId: "1:170723608901:web:943af1d44f8c3fda52d62c",
  measurementId: "G-GVSBHL4V02"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);