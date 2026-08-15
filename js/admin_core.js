console.log("admin.js 开始执行");
import { db, auth } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, query, orderBy, where, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

function $(id){ return document.getElementById(id); }

async function log(type,data,qty,customer="",extra={}){
  const payload={timestamp:serverTimestamp(),type,code:data.code,spec:data.spec||"",color:data.color||"",warehouse:data.warehouse||"",qty,customer:customer||""};
  if(extra && typeof extra==="object"){
    if(extra.source) payload.source=extra.source;
    if(extra.fromReserve!=null) payload.fromReserve=Number(extra.fromReserve)||0;
    if(extra.fromFree!=null) payload.fromFree=Number(extra.fromFree)||0;
    if(extra.plan) payload.plan=true;
  }
  await addDoc(collection(db,"logs"),payload);
}

console.log("admin_core minimal stub - use CDN for full UI");
