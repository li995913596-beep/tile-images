import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDuhQD3bhkFmvZ2OIfJldYwtznX_2PVtIk",
  authDomain: "kucunguanli-13d73.firebaseapp.com",
  projectId: "kucunguanli-13d73",
};

// 避免 CDN admin 与本地模块重复 initializeApp 报错
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
