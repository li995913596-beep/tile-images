/**
 * 整柜一键入库（在途 → 库存）
 * v20260910d：对照入库日志 + 规范化柜号/编号/色号，隐藏已入库和重复导入行
 */
import { auth, db } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc,
  query, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

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

function normCn(s){
  return String(s == null ? "" : s).trim().toUpperCase().replace(/[\s\-_.]/g, "");
}

function normCode(s){
  return String(s == null ? "" : s).trim().toUpperCase().replace(/\s+/g, "");
}

function normColor(s){
  var c = String(s == null ? "" : s).trim().toUpperCase();
  if(!c || c === "-" || c === "/" || c === "无" || c === "無" || c === "默认" || c === "默認" || c === "NONE" || c === "NULL" || c === "N/A") return "";
  return c;
}

function lineKey(code, color){
  return normCode(code) + "|" + normColor(color);
}

function isClosedTransit(item){
  if(!item) return false;
  var st = String(item.status || "").trim();
  if(/待入库|未入库|未入庫|未入仓/.test(st)) return false;
  if(/已入库|已入庫|已入仓|已入倉|入库完成|入庫完成|已取消|^取消$/.test(st)) return true;
  if(/入库|入庫|入仓|入倉/.test(st)) return true;
  var n = st.toLowerCase().replace(/\s+/g, "");
  if(n === "inbound" || n === "received" || n === "done" || n === "cancelled" || n === "canceled" || n === "closed") return true;
  if(String(item.inboundWarehouse || "").trim()) return true;
  if(String(item.inboundNote || "").trim()) return true;
  if(item.inboundQty != null && item.inboundQty !== "" && Number(item.inboundQty) > 0 && st !== "在途" && st !== "已到港") return true;
  return false;
}
