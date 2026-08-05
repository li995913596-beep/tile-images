/**
 * 前台：在途货物 — 按提单分组表格
 * 1A 柜号只在同柜首行显示
 * 2B 默认只展开第一个提单
 * 3A+B 数量加粗 + 浅绿底
 */
import { db } from "./firebase.js";
import {
  collection, getDocs, query, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

function fmtTime(v){
  if(!v) return "-";
  try {
    var d = v.toDate ? v.toDate() : new Date(v);
    if(isNaN(d.getTime())) return "-";
    function p(n){ return String(n).padStart(2, "0"); }
    return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  } catch(e){ return "-"; }
}

function esc(s){
  var t = String(s == null ? "" : s);
  var amp = String.fromCharCode(38);
  var lt = String.fromCharCode(60);
  var gt = String.fromCharCode(62);
  var quot = String.fromCharCode(34);
  t = t.split(amp).join(amp + "amp;");
  t = t.split(quot).join(amp + "quot;");
  t = t.split(lt).join(amp + "lt;");
  t = t.split(gt).join(amp + "gt;");
  return t;
}

function statusBadge(st){
  var cls = "badge-zt";
  if(st === "已到港") cls = "badge-dg";
  else if(st === "已入库") cls = "badge-rk";
  else if(st === "取消") cls = "badge-qx";
  return '<span class="badge ' + cls + '">' + esc(st || "在途") + "</span>";
}

async function loadAll(){
  var snap = await getDocs(query(collection(db, "in_transit"), limit(2000)));
  var list = [];
  snap.forEach(function(d){ list.push(Object.assign({ id: d.id }, d.data())); });
  return list;
}

function filterList(list){
  var status = ($("tStatus") && $("tStatus").value) || "active";
  var kw = (($("tSearch") && $("tSearch").value) || "").trim().toLowerCase();
  return list.filter(function(item){
    var st = item.status || "在途";
    if(status === "active" && st !== "在途" && st !== "已到港") return false;
    if(status === "history" && st !== "已入库" && st !== "取消") return false;
    if(status !== "active" && status !== "history" && status !== "all" && st !== status) return false;
    if(!kw) return true;
    var blob = [item.code, item.spec, item.color, item.containerNo, item.blNo]
      .map(function(x){ return String(x || "").toLowerCase(); }).join(" ");
    return blob.indexOf(kw) >= 0;
  });
}

function groupByBL(list){
  var order = [];
  var map = {};
  list.forEach(function(item){
    var bl = (item.blNo && String(item.blNo).trim()) ? String(item.blNo).trim() : "(无提单号)";
    if(!map[bl]){ map[bl] = []; order.push(bl); }
    map[bl].push(item);
  });
  order.forEach(function(bl){
    map[bl].sort(function(a, b){
      var ca = String(a.containerNo || "");
      var cb = String(b.containerNo || "");
      if(ca !== cb) return ca < cb ? -1 : 1;
      return String(a.code || "").localeCompare(String(b.code || ""));
    });
  });
  return order.map(function(bl){ return { blNo: bl, items: map[bl] }; });
}

function renderGroups(list){
  var box = $("tResult");
  if(!box) return;
  var filtered = filterList(list);
  var groups = groupByBL(filtered);

  if(!groups.length){
    box.innerHTML = '<div class="empty">暂无在途数据</div>';
    if($("tHint")) $("tHint").textContent = "";
    return;
  }

  if($("tHint")){
    $("tHint").textContent = "共 " + groups.length + " 个提单，" + filtered.length + " 行 · 数据更新时间见各提单";
  }

  box.innerHTML = "";
  groups.forEach(function(g, gi){
    var items = g.items;
    var containers = {};
    items.forEach(function(it){
      var c = it.containerNo || "-";
      containers[c] = true;
    });
    var eta = "";
    for(var i = 0; i < items.length; i++){
      if(items[i].eta){ eta = items[i].eta; break; }
    }
    var updated = "";
    for(var j = 0; j < items.length; j++){
      var u = fmtTime(items[j].updatedAt);
      if(u !== "-"){ updated = u; break; }
    }

    var sec = document.createElement("div");
    sec.className = "bl-section";
    var open = gi === 0;

    var head = document.createElement("div");
    head.className = "bl-head" + (open ? " open" : "");
    head.innerHTML =
      '<span class="bl-toggle">' + (open ? "▼" : "▶") + "</span>" +
      '<span class="bl-title">提单 ' + esc(g.blNo) + "</span>" +
      '<span class="bl-meta">' + Object.keys(containers).length + " 柜 · " + items.length + " 行" +
      (eta ? " · 预计到港 " + esc(eta) : "") +
      (updated ? " · 更新 " + esc(updated) : "") + "</span>";

    var body = document.createElement("div");
    body.className = "bl-body";
    body.style.display = open ? "block" : "none";

    var table = document.createElement("table");
    table.className = "bl-table";
    table.innerHTML =
      "<thead><tr>" +
      "<th>柜号</th><th>型号</th><th>色号</th><th>规格</th>" +
      '<th class="col-qty">数量</th><th>状态</th><th>备注</th><th>预定</th>' +
      "</tr></thead>";
    var tbody = document.createElement("tbody");

    var lastContainer = null;
    items.forEach(function(item){
      var cNo = item.containerNo || "";
      var showC = (cNo !== lastContainer);
      lastContainer = cNo;

      var reserves = Array.isArray(item.reservations) ? item.reservations : [];
      var resHtml = "";
      if(reserves.length){
        resHtml = reserves.map(function(r){
          return esc(r.customer) + " ×" + (r.qty || 0);
        }).join("；");
      }

      var tr = document.createElement("tr");
      if(showC && lastContainer !== null) tr.className = "row-new-container";
      tr.innerHTML =
        "<td class=\"td-cno\">" + (showC ? esc(cNo || "-") : "") + "</td>" +
        "<td class=\"td-code\">" + esc(item.code || "") + "</td>" +
        "<td>" + esc(item.color || "") + "</td>" +
        "<td>" + esc(item.spec || "") + "</td>" +
        '<td class="td-qty">' + (item.qty != null && item.qty !== "" ? item.qty : "-") + "</td>" +
        "<td>" + statusBadge(item.status) + "</td>" +
        "<td class=\"td-remark\">" + esc(item.remark || "") + "</td>" +
        "<td class=\"td-res\">" + (resHtml || "") + "</td>";
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    body.appendChild(table);
    sec.appendChild(head);
    sec.appendChild(body);
    box.appendChild(sec);

    head.onclick = function(){
      var isOpen = body.style.display !== "none";
      body.style.display = isOpen ? "none" : "block";
      head.classList.toggle("open", !isOpen);
      head.querySelector(".bl-toggle").textContent = isOpen ? "▶" : "▼";
    };
  });
}

var cache = [];

async function refresh(){
  var box = $("tResult");
  if(box) box.innerHTML = '<div class="empty">加载中…</div>';
  try {
    cache = await loadAll();
    renderGroups(cache);
  } catch(e){
    console.error(e);
    if(box) box.innerHTML = '<div class="empty" style="color:#b91c1c;">加载失败：' + ((e && e.message) || e) + "</div>";
  }
}

function boot(){
  if($("tBtnSearch")) $("tBtnSearch").onclick = function(){ renderGroups(cache); };
  if($("tBtnAll")) $("tBtnAll").onclick = function(){
    if($("tSearch")) $("tSearch").value = "";
    if($("tStatus")) $("tStatus").value = "active";
    renderGroups(cache);
  };
  if($("tSearch")){
    $("tSearch").addEventListener("keydown", function(e){
      if(e.key === "Enter") renderGroups(cache);
    });
  }
  if($("tStatus")) $("tStatus").onchange = function(){ renderGroups(cache); };
  refresh();
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
