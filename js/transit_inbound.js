/**
 * 整柜一键入库（在途 → 库存）
 */
import { auth, db } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc,
  query, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

/** 规格统一：600*1200*9.0 -> 600x1200（去掉厚度，* 改 x） */
function normalizeSpec(s){
  s = String(s == null ? "" : s).trim();
  if(!s) return "";
  s = s.replace(/[＊×✕✖*]/g, "x").replace(/X/g, "x").replace(/\s+/g, "");
  var parts = s.split("x").filter(function(p){ return p !== ""; });
  if(parts.length >= 2) return parts[0] + "x" + parts[1];
  return s;
}

function esc(s){
  return String(s == null ? "" : s);
}

function lineKey(code, color){
  return String(code || "").trim().toUpperCase() + "|" + String(color || "").trim().toUpperCase();
}

function isClosedTransit(item){
  if(!item) return false;
  var st = String(item.status || "").trim();
  if(/已入库|已入庫|已入仓|已入倉|入库完成|入庫完成|已取消|^取消$/.test(st)) return true;
  var n = st.toLowerCase().replace(/\s+/g, "");
  if(n === "inbound" || n === "received" || n === "done" || n === "cancelled" || n === "canceled") return true;
  if(String(item.inboundWarehouse || "").trim()) return true;
  if(item.inboundQty != null && item.inboundQty !== "" && Number(item.inboundQty) > 0 && st !== "在途" && st !== "已到港") return true;
  return false;
}
