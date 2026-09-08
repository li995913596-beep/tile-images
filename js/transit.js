/**
 * 前台：在途货物 — 按提单分组表格
 * 预计到港中文；色号不被长日期刷屏；顶部常驻过期说明
 */
import { db } from "./firebase.js";
import {
  collection, getDocs, query, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }
function tt(key, vars){ return (window.I18N && window.I18N.t(key, vars)) || key; }
function stLabel(st){ return (window.I18N && window.I18N.statusLabel(st)) || st; }

function pad2(n){ return String(n).padStart(2, "0"); }

function fmtTime(v){
  if(!v) return "";
  try {
    var d = v.toDate ? v.toDate() : new Date(v);
    if(isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  } catch(e){ return ""; }
}

function fmtEtaCN(eta){
  if(eta == null || eta === "") return "";
  if(Object.prototype.toString.call(eta) === "[object Date]" && !isNaN(eta.getTime())){
    return eta.getFullYear() + "年" + (eta.getMonth()+1) + "月" + eta.getDate() + "日";
  }
  var s = String(eta).trim();
  if(!s) return "";
  var d = null;
  if(/^\d+(\.\d+)?$/.test(s)){
    var n = Number(s);
    if(n > 20000 && n < 80000){
      d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
    }
  }
  if(!d){
    var m = s.match(/^(\d{4})[-\/年.](\d{1,2})[-\/月.](\d{1,2})/);
    if(m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  if(!d){
    var t = Date.parse(s);
    if(!isNaN(t)) d = new Date(t);
  }
  if(!d || isNaN(d.getTime())){
    if(/年.*月.*日/.test(s)) return s;
    return s.length > 24 ? s.slice(0, 16) : s;
  }
  var lang = (window.I18N && window.I18N.getLang && window.I18N.getLang()) || "zh";
  if(lang === "zh") return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function fmtColor(c){
  if(c == null || c === "") return "";
  if(Object.prototype.toString.call(c) === "[object Date]" && !isNaN(c.getTime())){
    return c.getFullYear() + "-" + pad2(c.getMonth()+1) + "-" + pad2(c.getDate());
  }
  var s = String(c).trim();
  if(/GMT|UTC|标准时间|[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4}/.test(s)){
    var t = Date.parse(s);
    if(!isNaN(t)){
      var d = new Date(t);
      return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate());
    }
  }
  return s;
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

function qtyPill(qty){
  if(qty == null || qty === "") return "-";
  var n = Number(qty);
  var bg = "#22c55e";
  if(!isNaN(n)){
    if(n === 0) bg = "#ef4444";
    else if(n < 10) bg = "#f59e0b";
  }
  return '<span class="qty-pill" style="background:' + bg + ';">' + esc(String(qty)) + "</span>";
}

function statusLabel(st){
  return stLabel(st);
}

function statusBadge(st){
  var cls = "badge-zt";
  if(st === "已到港") cls = "badge-dg";
  else if(st === "已入库") cls = "badge-rk";
  else if(st === "取消") cls = "badge-qx";
  return '<span class="badge ' + cls + '">' + esc(statusLabel(st || "在途")) + "</span>";
}

function getUpdatedMs(v){
  if(!v) return 0;
  try {
    var d = v.toDate ? v.toDate() : new Date(v);
    var t = d.getTime();
    return isNaN(t) ? 0 : t;
  } catch(e){ return 0; }
}

async function loadAll(){
  var snap = await getDocs(query(collection(db, "in_transit"), limit(2000)));
  var list = [];
  snap.forEach(function(d){ list.push(Object.assign({ id: d.id }, d.data())); });
  return list;
}

function statusOk(item, status){
  var st = item.status || "在途";
  if(status === "active") return st === "在途" || st === "已到港";
  if(status === "history") return st === "已入库" || st === "取消";
  if(status === "all") return true;
  return st === status;
}
function itemBlob(item){
  return [item.code, item.spec, item.color, item.containerNo, item.blNo]
    .map(function(x){ return String(x || "").toLowerCase(); }).join(" ");
}
function filterList(list){
  var status = ($("tStatus") && $("tStatus").value) || "active";
  var kw = (($("tSearch") && $("tSearch").value) || "").trim().toLowerCase();
  var byStatus = list.filter(function(item){ return statusOk(item, status); });
  if(!kw) return byStatus;
  var hit = byStatus.filter(function(item){ return itemBlob(item).indexOf(kw) >= 0; });
  var containers = {};
  hit.forEach(function(item){
    var cn = String(item.containerNo || "").trim();
    if(cn) containers[cn] = true;
  });
  if(!Object.keys(containers).length) return hit;
  return byStatus.filter(function(item){
    var cn = String(item.containerNo || "").trim();
    if(cn && containers[cn]) return true;
    return itemBlob(item).indexOf(kw) >= 0;
  });
}

function groupByBL(list){
  var order = [];
  var map = {};
  list.forEach(function(item){
    var bl = (item.blNo && String(item.blNo).trim()) ? String(item.blNo).trim() : tt("transit.noBl");
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

function renderStaleBanner(list){
  var tip = $("tTip");
  var warn = $("tStale");
  if(tip) tip.style.display = "block";
  if(!warn) return;
  var week = 7 * 24 * 60 * 60 * 1000;
  var now = Date.now();
  var oldest = 0;
  var hasActive = false;
  list.forEach(function(item){
    var st = item.status || "在途";
    if(st !== "在途" && st !== "已到港") return;
    hasActive = true;
    var t = getUpdatedMs(item.updatedAt);
    if(t && (!oldest || t < oldest)) oldest = t;
  });
  if(!hasActive || !oldest){
    warn.style.display = "none";
    warn.innerHTML = "";
    return;
  }
  if(now - oldest > week){
    var days = Math.floor((now - oldest) / (24 * 60 * 60 * 1000));
    warn.style.display = "block";
    warn.innerHTML = tt("transit.stale", { days: days });
  } else {
    warn.style.display = "none";
    warn.innerHTML = "";
  }
}

function renderGroups(list){
  var box = $("tResult");
  if(!box) return;
  var filtered = filterList(list);
  renderStaleBanner(filtered);
  var groups = groupByBL(filtered);
  var etaByBL = {};
  var updatedByBL = {};
  list.forEach(function(item){
    var bl = (item.blNo && String(item.blNo).trim()) ? String(item.blNo).trim() : tt("transit.noBl");
    if(item.eta && !etaByBL[bl]) etaByBL[bl] = item.eta;
    var u = fmtTime(item.updatedAt);
    if(u && (!updatedByBL[bl] || u > updatedByBL[bl])) updatedByBL[bl] = u;
  });
  if(!groups.length){
    box.innerHTML = '<div class="empty">' + tt("msg.noTransit") + '</div>';
    if($("tHint")) $("tHint").textContent = "";
    return;
  }
  if($("tHint")) $("tHint").textContent = tt("transit.hint", { g: groups.length, n: filtered.length });
  box.innerHTML = "";
  groups.forEach(function(g, gi){
    var items = g.items;
    var containers = {};
    items.forEach(function(it){ containers[it.containerNo || "-"] = true; });
    var eta = etaByBL[g.blNo] || "";
    if(!eta){
      for(var i = 0; i < items.length; i++){
        if(items[i].eta){ eta = items[i].eta; break; }
      }
    }
    var updated = updatedByBL[g.blNo] || "";
    if(!updated){
      for(var j = 0; j < items.length; j++){
        var u2 = fmtTime(items[j].updatedAt);
        if(u2 && (!updated || u2 > updated)) updated = u2;
      }
    }
    var etaCN = fmtEtaCN(eta);
    var sec = document.createElement("div");
    sec.className = "bl-section";
    var open = gi === 0;
    var head = document.createElement("div");
    head.className = "bl-head" + (open ? " open" : "");
    head.innerHTML =
      '<span class="bl-toggle">' + (open ? "▼" : "▶") + "</span>" +
      '<span class="bl-title">' + tt("transit.bl") + " " + esc(g.blNo) + "</span>" +
      '<span class="bl-meta">' + tt("transit.meta", { c: Object.keys(containers).length, n: items.length }) + "</span>" +
      (etaCN ? '<span class="bl-eta">' + tt("transit.eta") + esc(etaCN) + "</span>" : "") +
      (updated ? '<span class="bl-updated">' + tt("transit.updated") + esc(updated) + "</span>" : "");
    var body = document.createElement("div");
    body.className = "bl-body";
    body.style.display = open ? "block" : "none";
    var table = document.createElement("table");
    table.className = "bl-table";
    table.innerHTML =
      "<thead><tr>" +
      "<th>" + tt("col.container") + "</th><th>" + tt("col.model") + "</th><th>" + tt("col.color") + "</th><th>" + tt("col.spec") + "</th>" +
      '<th class="col-qty">' + tt("col.qty") + "</th><th>" + tt("col.status") + "</th><th>" + tt("col.remark") + "</th><th>" + tt("col.booked") + "</th>" +
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
        resHtml = reserves.map(function(r){ return esc(r.customer) + " ×" + (r.qty || 0); }).join("；");
      }
      var tr = document.createElement("tr");
      if(showC) tr.className = "row-new-container";
      tr.innerHTML =
        '<td class="td-cno">' + (showC ? esc(cNo || "-") : "") + "</td>" +
        '<td class="td-code">' + esc(item.code || "") + "</td>" +
        "<td>" + esc(fmtColor(item.color)) + "</td>" +
        "<td>" + esc(item.spec || "") + "</td>" +
        '<td class="td-qty">' + qtyPill(item.qty) + "</td>" +
        "<td>" + statusBadge(item.status) + "</td>" +
        '<td class="td-remark">' + esc(item.remark || "") + "</td>" +
        '<td class="td-res">' + (resHtml || "") + "</td>";
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
  if(box) box.innerHTML = '<div class="empty">' + tt("msg.loading") + '</div>';
  try {
    cache = await loadAll();
    renderGroups(cache);
  } catch(e){
    console.error(e);
    if(box) box.innerHTML = '<div class="empty" style="color:#b91c1c;">' + tt("msg.loadFail") + '：' + ((e && e.message) || e) + "</div>";
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
window.addEventListener("tile-lang-change", function(){ if(cache && cache.length) renderGroups(cache); });
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
