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

async function updateSalesSnapshot(){
  if(!confirm("用现在的库存更新业务员查询页？")) return;
  var btn = document.getElementById("btnSalesSnapshot");
  if(btn){ btn.disabled = true; btn.textContent = "更新中…"; }
  try {
    var rows = await loadInventory();
    var items = rows.map(function(i){
      var stock = Number(i.stock || 0);
      var reserved = reservedQty(i.reservedList);
      return {
        code: i.code || "",
        spec: i.spec || "",
        color: i.color || "",
        warehouse: i.warehouse || "",
        stock: stock,
        reserved: reserved
      };
    }).filter(function(i){ return i.code && (i.stock > 0 || i.reserved > 0); });
    items.sort(function(a, b){ return String(a.code).localeCompare(String(b.code), "zh-CN"); });
    var updatedAt = nowText();
    await setDoc(doc(db, "salesSnapshot", "current"), { updatedAt: updatedAt, count: items.length, items: items });
    var link = location.origin + "/sales.html";
    try { await navigator.clipboard.writeText(link); } catch(e){}
    alert("已更新 " + items.length + " 条。链接已复制，发到微信即可：\n" + link);
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
