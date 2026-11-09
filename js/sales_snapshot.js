/**
 * 后台一键更新业务员查询页。只写一份快照，不改库存。
 */
import { db } from "./firebase.js";
import { collection, doc, getDocs, limit, query, setDoc, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function pad(n){ return String(n).padStart(2, "0"); }
function nowText(){
  var d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}
function reservedQty(list){
  if(!Array.isArray(list)) return 0;
  return list.reduce(function(s, r){ return s + Number((r && r.qty) || 0); }, 0);
}

async function loadInventory(){
  var out = [];
  var last = null;
  for(var i = 0; i < 30; i++){
    var q = last
      ? query(collection(db, "inventory"), limit(300), startAfter(last))
      : query(collection(db, "inventory"), limit(300));
    var snap = await getDocs(q);
    if(snap.empty) break;
    snap.forEach(function(d){ out.push(d.data() || {}); });
    last = snap.docs[snap.docs.length - 1];
    if(snap.size < 300) break;
  }
  return out;
}

var TOKEN_KEY = "tile_gh_token";
function getToken(){
  try { return (localStorage.getItem(TOKEN_KEY) || "").trim(); } catch(e){ return ""; }
}
function b64(text){
  return btoa(unescape(encodeURIComponent(text)));
}
async function ghGet(path, token){
  var res = await fetch("https://api.github.com/repos/li995913596-beep/tile-images/contents/" + path + "?ref=main", {
    headers: { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + token }
  });
  if(!res.ok) throw new Error("读取网页失败 " + res.status);
  return await res.json();
}
async function ghPut(path, content, token, sha, message){
  var res = await fetch("https://api.github.com/repos/li995913596-beep/tile-images/contents/" + path, {
    method: "PUT",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: message, content: b64(content), branch: "main", sha: sha })
  });
  if(!res.ok){
    var t = await res.text();
    throw new Error("写入失败 " + res.status + " " + t.slice(0, 180));
  }
}
async function publishSalesPage(items, updatedAt, token){
  var js = "window.SALES_UPDATED_AT=" + JSON.stringify(updatedAt) + ";\nvar DATA=" + JSON.stringify(items) + ";\n";
  var dataFile = await ghGet("js/sales_data.js", token);
  await ghPut("js/sales_data.js", js, token, dataFile.sha, "更新业务员查询 " + updatedAt);
  var page = await ghGet("sales.html", token);
  var html = decodeURIComponent(escape(atob(page.content.replace(/\n/g, ""))));
  var stamp = updatedAt.replace(/[-: ]/g, "");
  html = html.replace(/js\/sales_data\.js\?v=\d+/, "js/sales_data.js?v=" + stamp);
  await ghPut("sales.html", html, token, page.sha, "更新业务员查询页时间 " + updatedAt);
}

async function updateSalesSnapshot(){
  if(!confirm("用现在的库存更新业务员查询页？")) return;
  var btn = document.getElementById("btnSalesSnapshot");
  if(btn){ btn.disabled = true; btn.textContent = "更新中…"; }
  try {
    var rows = await loadInventory();
    var items = rows.map(function(i){
      var stock = Number(i.stock || 0);
      var list = Array.isArray(i.reservedList) ? i.reservedList : [];
      var reserved = reservedQty(list);
      var detail = list.filter(function(r){ return r && (r.customer || r.qty); }).map(function(r){
        return (r.customer || "未填客户") + "(" + Number(r.qty || 0) + ")";
      }).join("、");
      return {
        code: i.code || "",
        spec: i.spec || "",
        color: i.color || "",
        warehouse: i.warehouse || "",
        stock: stock,
        reserved: reserved,
        reserveDetail: detail,
        piecesPerBox: Number(i.piecesPerBox || 0),
        boxWeight: Number(i.boxWeight || 0),
        packaging: i.packaging || ""
      };
    }).filter(function(i){ return i.code && (i.stock > 0 || i.reserved > 0); });
    items.sort(function(a, b){ return String(a.code).localeCompare(String(b.code), "zh-CN"); });
    var updatedAt = nowText();
    await setDoc(doc(db, "salesSnapshot", "current"), { updatedAt: updatedAt, count: items.length, items: items });
    var token = getToken();
    if(!token){
      alert("库存已记下，但网页没更新。请先在后台保存 GitHub Token，再点一次。");
      return;
    }
    if(btn) btn.textContent = "正在更新网页…";
    await publishSalesPage(items, updatedAt, token);
    var link = location.origin + "/sales.html";
    try { await navigator.clipboard.writeText(link); } catch(e){}
    alert("已更新 " + items.length + " 条。一两分钟后让业务员关掉旧页面再打开：\n" + link);
  } catch(e){
    console.error(e);
    alert("更新失败：" + (e.message || e));
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "更新业务员查询"; }
  }
}

function boot(){
  var nav = document.querySelector(".nav-card");
  if(!nav || nav.querySelector("#btnSalesSnapshot")) return;
  var btn = document.createElement("button");
  btn.type = "button";
  btn.id = "btnSalesSnapshot";
  btn.textContent = "更新业务员查询";
  btn.onclick = updateSalesSnapshot;
  var logout = nav.querySelector("#btnLogout");
  if(logout) nav.insertBefore(btn, logout);
  else nav.appendChild(btn);
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
setInterval(boot, 1500);
console.log("sales_snapshot.js ready v20261105a");
