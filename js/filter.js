import { db } from "./firebase.js";
import { collection, getDocs, limit, query, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

var CACHE_KEY = "tile_inv_cache_v1";
var CACHE_TTL_MS = 8 * 60 * 60 * 1000;

function normalizeSpec(s){
  s = String(s == null ? "" : s).trim();
  if(!s) return "";
  s = s.replace(/[＊×✕✖*]/g, "x").replace(/X/g, "x").replace(/\s+/g, "");
  var parts = s.split("x").filter(function(p){ return p !== ""; });
  return parts.length >= 2 ? parts[0] + "x" + parts[1] : s;
}
function esc(s){ return String(s==null?"":s).replace(/[&<>]/g, function(c){ return {"&":"&","<":"<",">":">"}[c]; }); }
function packLine(item){
  var parts = [];
  if(Number(item.piecesPerBox) > 0) parts.push(Number(item.piecesPerBox) + "片/箱");
  if(Number(item.boxWeight) > 0) parts.push(Number(item.boxWeight) + "kg");
  if(item.packaging) parts.push(item.packaging);
  return parts.join(" · ");
}
function loadCache(){
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if(!raw) return null;
    var obj = JSON.parse(raw);
    if(!obj || !Array.isArray(obj.items) || !obj.loadedAt) return null;
    if(Date.now() - Number(obj.loadedAt) >= CACHE_TTL_MS) return null;
    return obj.items;
  } catch(e){ return null; }
}
function saveCache(items){
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ loadedAt: Date.now(), items: items }));
  } catch(e){}
}
async function fetchAll(){
  var items = [];
  var last = null;
  for(var i = 0; i < 40; i++){
    var q = last ? query(collection(db, "inventory"), limit(500), startAfter(last)) : query(collection(db, "inventory"), limit(500));
    var snap = await getDocs(q);
    if(snap.empty) break;
    snap.forEach(function(d){
      var item = d.data() || {};
      if(item.hidden) return;
      var list = Array.isArray(item.reservedList) ? item.reservedList : [];
      var reserved = list.reduce(function(s, r){ return s + Number((r && r.qty) || 0); }, 0);
      var detail = list.filter(function(r){ return r && (r.customer || r.qty); }).map(function(r){
        return (r.customer || "未填客户") + "(" + Number(r.qty || 0) + ")";
      }).join("、");
      items.push(Object.assign({}, item, {
        reserved: reserved,
        reserveDetail: detail,
        _code: String(item.code || "").toLowerCase(),
        _spec: normalizeSpec(item.spec || "").toLowerCase(),
        _warehouse: String(item.warehouse || "").toLowerCase()
      }));
    });
    last = snap.docs[snap.docs.length - 1];
    if(snap.size < 500) break;
  }
  saveCache(items);
  return items;
}
function render(list){
  var box = document.getElementById("result");
  if(!list.length){ box.innerHTML = "<div style='padding:16px;color:#94a3b8;'>没有符合的库存</div>"; return; }
  var html = "";
  list.forEach(function(item){
    var imageUrl = location.origin + "/images/" + encodeURIComponent(item.code || "") + ".jpg";
    var stock = Number(item.stock || 0);
    var stockColor = stock > 10 ? "#2ecc71" : stock > 0 ? "#f39c12" : "#e74c3c";
    var pack = packLine(item);
    var reserveHtml = '<span style="font-size:11px;padding:3px 8px;border-radius:999px;background:#e5e7eb;color:#666;">留货 0</span>';
    if(Number(item.reserved || 0) > 0){
      reserveHtml = '<div style="margin-top:2px;"><span style="font-size:11px;padding:3px 8px;border-radius:999px;background:#ef4444;color:#fff;">留货 ' + esc(item.reserved) + '</span>' +
        (item.reserveDetail ? '<div style="margin-top:4px;font-size:12px;color:#c0392b;line-height:1.4;">客户：' + esc(item.reserveDetail) + '</div>' : '') + '</div>';
    }
    html += '<div class="card" style="display:flex;align-items:center;gap:12px;">' +
      '<div onclick="openModal(\'' + imageUrl + '\')"><img src="' + imageUrl + '" style="width:58px;height:58px;border-radius:8px;object-fit:cover;" onerror="this.style.display=\'none\'"></div>' +
      '<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:15px;">' + esc(item.code) + '</div>' +
      '<div style="font-size:13px;color:#555;margin-top:2px;">' + esc(normalizeSpec(item.spec) || item.spec || "-") + ' | 色号 ' + esc(item.color || "-") + '</div>' +
      (pack ? '<div style="font-size:12px;color:#64748b;margin-top:3px;">' + esc(pack) + '</div>' : '') +
      '<div style="margin-top:6px;">' + reserveHtml + '</div></div>' +
      '<div style="text-align:right;flex-shrink:0;"><div style="display:inline-block;font-size:11px;padding:4px 10px;border-radius:999px;background:#eef3f8;color:#2c3e50;font-weight:500;margin-bottom:6px;">' + esc(item.warehouse || "-") + '</div>' +
      '<div style="font-size:16px;font-weight:700;padding:6px 12px;border-radius:10px;background:' + stockColor + ';color:#fff;">' + esc(stock) + '</div></div></div>';
  });
  box.innerHTML = html;
}
async function run(){
  var sub = document.getElementById("f_sub");
  var cached = loadCache();
  if(!cached){
    sub.textContent = "首次读取库存，只读一次…";
    cached = await fetchAll();
  }
  var kw = (document.getElementById("f_kw").value || "").trim().toLowerCase();
  var spec = (document.getElementById("f_spec").value || "").toLowerCase();
  var wh = (document.getElementById("f_wh").value || "").toLowerCase();
  var sort = document.getElementById("f_sort").value;
  var list = cached.filter(function(item){
    if(spec && normalizeSpec(item.spec || "").toLowerCase() !== spec) return false;
    if(wh && String(item.warehouse || "").toLowerCase() !== wh) return false;
    if(kw && String(item.code || "").toLowerCase().indexOf(kw) < 0 && String(item.color || "").toLowerCase().indexOf(kw) < 0) return false;
    return true;
  });
  list.sort(function(a, b){
    if(sort === "stock_asc") return Number(a.stock || 0) - Number(b.stock || 0);
    if(sort === "code") return String(a.code || "").localeCompare(String(b.code || ""), "zh-CN");
    return Number(b.stock || 0) - Number(a.stock || 0);
  });
  sub.textContent = "共 " + list.length + " 条";
  render(list.slice(0, 200));
  if(list.length > 200) sub.textContent = "共 " + list.length + " 条，先显示 200 条";
}
document.getElementById("f_btn").onclick = function(){ run().catch(function(e){ alert("筛选失败：" + (e.message || e)); }); };
document.getElementById("f_kw").addEventListener("keydown", function(e){ if(e.key === "Enter") run(); });
["f_spec","f_wh","f_sort"].forEach(function(id){ document.getElementById(id).onchange = function(){ run(); }; });
run().catch(function(e){ document.getElementById("f_sub").textContent = "读取失败"; });
