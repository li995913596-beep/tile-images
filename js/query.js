import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/** 规格统一：600*1200*9.0 -> 600x1200（去掉厚度，* 改 x） */
function normalizeSpec(s){
  s = String(s == null ? "" : s).trim();
  if(!s) return "";
  s = s.replace(/[＊×✕✖*]/g, "x").replace(/X/g, "x").replace(/\s+/g, "");
  var parts = s.split("x").filter(function(p){ return p !== ""; });
  if(parts.length >= 2) return parts[0] + "x" + parts[1];
  return s;
}

/* 汇总留货数量 + 客户明细 */
function getReserveInfo(item){
  const list = Array.isArray(item.reservedList) ? item.reservedList : [];
  const total = list.reduce((s, r) => s + Number(r.qty || 0), 0);
  const detail = list
    .filter(r => r && (r.customer || r.qty))
    .map(r => {
      const name = (r.customer || "未填客户").toString();
      const qty = Number(r.qty || 0);
      return `${name}(${qty})`;
    })
    .join("、");
  return { total, detail };
}

function formatPackLine(item){
  var parts = [];
  if(item.piecesPerBox != null && item.piecesPerBox !== "" && Number(item.piecesPerBox) > 0){
    parts.push(Number(item.piecesPerBox) + "片/箱");
  }
  if(item.boxWeight != null && item.boxWeight !== "" && Number(item.boxWeight) > 0){
    parts.push(Number(item.boxWeight) + "kg");
  }
  var pack = (item.packaging || "").toString().trim();
  if(pack) parts.push(pack);
  return parts.length ? parts.join(" · ") : "";
}

/* ================= 本地缓存：少读 Firebase ================= */
/** 有效 8 小时；存在 localStorage，关页面还在。打开页不自动拉库，第一次搜索才读。 */
const CACHE_TTL_MS = 8 * 60 * 60 * 1000;
const CACHE_KEY = "tile_inv_cache_v1";
let invCache = null;
let invLoading = null;

function toIso(v){
  if(v == null || v === "") return null;
  try {
    if(v.toDate) return v.toDate().toISOString();
    if(typeof v === "string") return v;
    if(typeof v === "number") return new Date(v).toISOString();
    return null;
  } catch(e){ return null; }
}

function serializeItems(items){
  return (items || []).map(function(item){
    var o = {};
    Object.keys(item).forEach(function(k){
      if(k === "lastUpdate") return;
      o[k] = item[k];
    });
    if(Array.isArray(item.reservedList)){
      o.reservedList = item.reservedList.map(function(r){
        if(!r) return r;
        return {
          customer: r.customer || "",
          qty: Number(r.qty || 0),
          at: toIso(r.at) || r.at || null
        };
      });
    }
    return o;
  });
}

function loadLocalCache(){
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if(!raw) return null;
    var obj = JSON.parse(raw);
    if(!obj || !Array.isArray(obj.items) || !obj.loadedAt) return null;
    if((Date.now() - Number(obj.loadedAt)) >= CACHE_TTL_MS) return null;
    return { items: obj.items, loadedAt: Number(obj.loadedAt) };
  } catch(e){
    console.warn("读取本地库存缓存失败", e);
    return null;
  }
}

function saveLocalCache(items, loadedAt){
  try {
    var payload = JSON.stringify({
      loadedAt: loadedAt,
      items: serializeItems(items)
    });
    localStorage.setItem(CACHE_KEY, payload);
  } catch(e){
    console.warn("写入本地库存缓存失败（可能超容量）", e);
    try { localStorage.removeItem(CACHE_KEY); } catch(e2){}
  }
}

function ensureMemoryCache(){
  if(invCache && (Date.now() - invCache.loadedAt) < CACHE_TTL_MS) return invCache;
  var local = loadLocalCache();
  if(local){
    invCache = local;
    return invCache;
  }
  return null;
}

async function fetchAllInventory(){
  const pageSize = 500;
  const maxPages = 40;
  let lastDoc = null;
  const items = [];
  for (let pages = 0; pages < maxPages; pages++) {
    const qAll = lastDoc
      ? query(collection(db, "inventory"), limit(pageSize), startAfter(lastDoc))
      : query(collection(db, "inventory"), limit(pageSize));
    const snap = await getDocs(qAll);
    if (snap.empty) break;
    snap.forEach(docSnap => {
      const item = docSnap.data();
      if (item.hidden) return;
      const { total, detail } = getReserveInfo(item);
      items.push({
        ...item,
        _id: docSnap.id,
        reserved: total,
        reserveDetail: detail,
        _code: String(item.code || "").toLowerCase(),
        _spec: normalizeSpec(item.spec || "").toLowerCase(),
        _color: String(item.color || "").toLowerCase(),
        _warehouse: String(item.warehouse || "").toLowerCase(),
        _fullId: String(docSnap.id).toLowerCase()
      });
    });
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
  return items;
}

async function getInventory(force){
  if(!force){
    var hit = ensureMemoryCache();
    if(hit) return hit.items;
  } else {
    invCache = null;
    try { localStorage.removeItem(CACHE_KEY); } catch(e){}
  }
  if(invLoading) return invLoading;
  invLoading = (async () => {
    try {
      const items = await fetchAllInventory();
      const loadedAt = Date.now();
      invCache = { items, loadedAt };
      saveLocalCache(items, loadedAt);
      console.log("库存缓存已更新，共", items.length, "条，本地有效约", (CACHE_TTL_MS / 3600000), "小时");
      try { showReserveOverdueBanner(items); } catch(e){ console.warn(e); }
      return items;
    } finally {
      invLoading = null;
    }
  })();
  return invLoading;
}

window.clearInventoryCache = function(){
  invCache = null;
  try { localStorage.removeItem(CACHE_KEY); } catch(e){}
};

function parseReserveAt(at){
  if(at == null || at === "") return null;
  try {
    if(at.toDate) return at.toDate();
    var d = new Date(at);
    return isNaN(d.getTime()) ? null : d;
  } catch(e){ return null; }
}

function collectOverdueReserves(items){
  var overdue = [];
  (items || []).forEach(function(item){
    (item.reservedList || []).forEach(function(r){
      if(!r || !(Number(r.qty || 0) > 0)) return;
      var d = parseReserveAt(r.at);
      if(!d) return;
      var days = Math.floor((Date.now() - d.getTime()) / 86400000);
      if(days >= 30){
        overdue.push({
          code: item.code || "",
          customer: r.customer || "未填",
          qty: r.qty,
          days: days
        });
      }
    });
  });
  overdue.sort(function(a, b){ return b.days - a.days; });
  return overdue;
}

function showReserveOverdueBanner(items){
  var el = document.getElementById("reserveBanner");
  if(!el) return;
  var overdue = collectOverdueReserves(items);
  if(!overdue.length){
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  var lines = overdue.slice(0, 8).map(function(o){
    return "· " + o.code + " / " + o.customer + " ×" + o.qty + "（已留 " + o.days + " 天）";
  }).join("<br>");
  if(overdue.length > 8) lines += "<br>…还有 " + (overdue.length - 8) + " 笔";
  el.style.display = "block";
  el.innerHTML =
    '<div style="font-weight:700;margin-bottom:6px;">⚠ 有 ' + overdue.length +
    ' 笔留货已超过 30 天，请联系管理员处理</div>' +
    '<div style="font-size:13px;opacity:0.95;">' + lines + "</div>";
}

window.searchData = async function(){
  const searchInput = document.getElementById("searchInput");
  const resultDiv = document.getElementById("result");
  console.log("searchData 开始执行");
  const raw = searchInput.value.trim();
  const keyword = raw.toLowerCase();
  resultDiv.innerHTML = "";
  if (!raw) {
    resultDiv.innerHTML = "请输入编号或规格 / Please enter Code or Size";
    return;
  }
  const hasCache = !!ensureMemoryCache();
  resultDiv.innerHTML = hasCache
    ? "<div style='padding:8px 4px;color:#94a3b8;font-size:13px;'>搜索中…</div>"
    : "<div style='padding:8px 4px;color:#94a3b8;font-size:13px;'>首次加载库存数据，稍候…</div>";
  let list = [];
  try {
    const all = await getInventory(false);
    const kwSpec = normalizeSpec(raw).toLowerCase();
    list = all.filter(item =>
      item._fullId.includes(keyword) ||
      item._code.includes(keyword) ||
      item._spec.includes(keyword) ||
      (kwSpec && item._spec.includes(kwSpec)) ||
      item._color.includes(keyword) ||
      item._warehouse.includes(keyword)
    );
  } catch (e) {
    console.error("搜索失败:", e);
    resultDiv.innerHTML = "搜索失败，请稍后重试";
    return;
  }
  if (list.length === 0) {
    resultDiv.innerHTML = "未找到库存 / No Inventory Found";
    return;
  }
  list.sort((a, b) => {
    const ca = String(a.code || "").toLowerCase();
    const cb = String(b.code || "").toLowerCase();
    const exactA = ca === keyword ? 0 : (ca.startsWith(keyword) ? 1 : 2);
    const exactB = cb === keyword ? 0 : (cb.startsWith(keyword) ? 1 : 2);
    if (exactA !== exactB) return exactA - exactB;
    return ca.localeCompare(cb, "zh-CN");
  });

  const isDesktop = window.innerWidth >= 768;

  if (isDesktop) {
    let html = `
      <div class="result-table">
        <div class="result-header">
          <div>图片</div>
          <div>编号</div>
          <div>规格</div>
          <div>色号</div>
          <div>库存</div>
          <div>留货</div>
          <div>仓库</div>
        </div>
    `;
    list.forEach(item => {
      const imageUrl = window.location.origin + "/images/" + item.code + ".jpg";
      const stockColor = item.stock > 10 ? "#2ecc71" : item.stock > 0 ? "#f39c12" : "#e74c3c";
      const reserveHtml = item.reserved > 0
        ? `${item.reserved}${item.reserveDetail ? "<br><span style=\"font-size:12px;color:#c0392b;\">" + item.reserveDetail + "</span>" : ""}`
        : "0";
      html += `
        <div class="result-row">
          <div onclick="openModal('${imageUrl}')">
            <img src="${imageUrl}" style="width:50px;height:50px;border-radius:6px;object-fit:cover;" onerror="this.style.display='none'">
          </div>
          <div>${item.code}${formatPackLine(item) ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${formatPackLine(item)}</div>` : ""}</div>
          <div>${normalizeSpec(item.spec) || item.spec || "-"}</div>
          <div>${item.color||"-"}</div>
          <div style="font-weight:700;color:${stockColor}">${item.stock}</div>
          <div>${reserveHtml}</div>
          <div>${item.warehouse}</div>
        </div>
      `;
    });
    html += `</div>`;
    resultDiv.innerHTML = html;
    return;
  }

  // 手机：先清空「搜索中…」，再一次性写入结果，避免残留空位
  let mobileHtml = "";
  list.forEach(item => {
    const imageUrl = window.location.origin + "/images/" + item.code + ".jpg";
    const stockColor = item.stock > 10 ? "#2ecc71" : item.stock > 0 ? "#f39c12" : "#e74c3c";
    const warehouseBg = "#eef3f8";
    const warehouseColor = "#2c3e50";
    let reserveHtml = `<span style="font-size:11px;padding:3px 8px;border-radius:999px;background:#e5e7eb;color:#666;">留货 0</span>`;
    if (item.reserved > 0) {
      reserveHtml = `<div style="margin-top:2px;"><span style="font-size:11px;padding:3px 8px;border-radius:999px;background:#ef4444;color:#fff;">留货 ${item.reserved}</span>${item.reserveDetail ? `<div style="margin-top:4px;font-size:12px;color:#c0392b;line-height:1.4;">客户：${item.reserveDetail}</div>` : ""}</div>`;
    }
    mobileHtml += `
      <div class="card" style="display:flex;align-items:center;gap:12px;">
        <div onclick="openModal('${imageUrl}')">
          <img src="${imageUrl}" style="width:58px;height:58px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'">
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:15px;">${item.code}</div>
          <div style="font-size:13px;color:#555;margin-top:2px;">${normalizeSpec(item.spec) || item.spec || "-"} | 色号 ${item.color}</div>
          ${formatPackLine(item) ? `<div style="font-size:12px;color:#64748b;margin-top:3px;">${formatPackLine(item)}</div>` : ""}
          <div style="margin-top:6px;">${reserveHtml}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="display:inline-block;font-size:11px;padding:4px 10px;border-radius:999px;background:${warehouseBg};color:${warehouseColor};font-weight:500;margin-bottom:6px;">${item.warehouse}</div>
          <div style="font-size:16px;font-weight:700;padding:6px 12px;border-radius:10px;background:${stockColor};color:#fff;">${item.stock}</div>
        </div>
      </div>
    `;
  });
  resultDiv.innerHTML = mobileHtml;
};

document.addEventListener("DOMContentLoaded", () => {
  const btnSearch = document.getElementById("btnSearch");
  const btnRefresh = document.getElementById("btnRefresh");
  const searchInput = document.getElementById("searchInput");
  const resultDiv = document.getElementById("result");
  if (btnSearch) btnSearch.addEventListener("click", window.searchData);
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        window.searchData();
      }
    });
  }
  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      if (searchInput) searchInput.value = "";
      if (resultDiv) {
        resultDiv.innerHTML = "<div style='padding:16px;color:#666;font-size:14px;'>正在从服务器刷新库存…</div>";
      }
      try {
        window.clearInventoryCache();
        const items = await getInventory(true);
        if (resultDiv) {
          resultDiv.innerHTML = "<div style='padding:16px;color:#16a34a;font-size:14px;'>库存已刷新（共 " + items.length + " 条），本地缓存有效约 8 小时。请重新查询。</div>";
        }
      } catch (e) {
        console.error(e);
        if (resultDiv) {
          resultDiv.innerHTML = "<div style='padding:16px;color:#b91c1c;font-size:14px;'>刷新失败，请稍后重试</div>";
        }
      }
    });
  }
  // 打开页面不拉 Firebase：仅用本地未过期缓存显示留货提醒
  try {
    var localHit = ensureMemoryCache();
    if(localHit) showReserveOverdueBanner(localHit.items);
  } catch(e){ console.warn(e); }
  console.log("query.js ready v20260818b: local 8h cache, no preload");
});
