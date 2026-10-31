/**
 * 日志：翻页 + 撤销；留货列表翻页
 * v20260821b reserve list: edit qty/time/customer + page
 */
import { db, auth } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, updateDoc, deleteDoc, addDoc, setDoc,
  serverTimestamp, query, orderBy, where, limit, startAfter
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

var LOG_PAGE = 50;
var RES_PAGE = 50;
var logCache = [];
var logPage = 1;
var resCache = [];
var resPage = 1;

function esc(s){
  var t = String(s == null ? "" : s);
  var amp = String.fromCharCode(38);
  t = t.split(amp).join(amp + "amp;");
  t = t.split('"').join(amp + "quot;");
  t = t.split("<").join(amp + "lt;");
  t = t.split(">").join(amp + "gt;");
  return t;
}


function parseReserveAt(at){
  if(at == null || at === "") return null;
  try {
    if(at.toDate) return at.toDate();
    var d = new Date(at);
    return isNaN(d.getTime()) ? null : d;
  } catch(e){ return null; }
}
function reserveDays(at){
  var d = parseReserveAt(at);
  if(!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
function fmtReserveAt(at){
  var d = parseReserveAt(at);
  if(!d) return "无时间";
  function p(n){ return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

function invId(code, color, warehouse){
  return String(code || "") + "_" + String(color || "") + "_" + String(warehouse || "").toLowerCase();
}

async function writeUndoLog(orig, note){
  await addDoc(collection(db, "logs"), {
    timestamp: serverTimestamp(),
    type: "撤销",
    code: orig.code || "",
    spec: orig.spec || "",
    color: orig.color || "",
    warehouse: orig.warehouse || "",
    qty: Number(orig.qty || 0),
    customer: (orig.customer || "") + (note ? " | " + note : "")
  });
}

window.undoLogEntry = async function(logId){
  if(!auth.currentUser) return alert("请先登录");
  var snap = await getDoc(doc(db, "logs", logId));
  if(!snap.exists()) return alert("日志不存在");
  var L = snap.data();
  if(L.type === "撤销") return alert("撤销记录本身不能再撤销");
  if(L.undone) return alert("该记录已撤销过");

  var type = L.type || "";
  var qty = Number(L.qty || 0);
  var code = L.code || "";
  var color = L.color || "";
  var warehouse = String(L.warehouse || "").toLowerCase();
  var id = invId(code, color, warehouse);

  if(!confirm("确认撤销？\n类型：" + type + "\n编号：" + code + " 色号：" + (color || "-") + "\n仓库：" + warehouse + "\n数量：" + qty + "\n客户：" + (L.customer || "-") + "\n\n将尽量恢复库存/留货数量")) return;

  try {
    var ref = doc(db, "inventory", id);
    var invSnap = await getDoc(ref);
    var data = invSnap.exists() ? invSnap.data() : null;

    if(type === "出库"){
      if(!data){
        await setDoc(ref, {
          code: code, spec: L.spec || "", color: color, warehouse: warehouse,
          stock: qty, reservedList: [], lastUpdate: serverTimestamp()
        });
      } else {
        var newStock = Number((Number(data.stock || 0) + qty).toFixed(4));
        await updateDoc(ref, { stock: newStock, lastUpdate: serverTimestamp() });
      }
      await writeUndoLog(L, "撤销出库，可售+" + qty);
    } else if(type === "入库"){
      if(!data) return alert("库存记录不存在，无法撤销入库");
      var st = Number(data.stock || 0);
      var useQty = qty;
      if(useQty > st){
        if(!confirm("当前可售仅 " + st + "，小于入库量 " + qty + "。将可售扣到 0，是否继续？")) return;
        useQty = st;
      }
      var ns = Number((st - useQty).toFixed(4));
      var list = Array.isArray(data.reservedList) ? data.reservedList : [];
      var hasR = list.some(function(r){ return r && Number(r.qty || 0) > 0; });
      if(ns <= 0 && !hasR) await deleteDoc(ref);
      else await updateDoc(ref, { stock: Math.max(0, ns), lastUpdate: serverTimestamp() });
      await writeUndoLog(L, "撤销入库，可售-" + useQty);
    } else if(type === "留货"){
      if(!data) return alert("库存记录不存在，无法撤销留货");
      var list2 = Array.isArray(data.reservedList) ? data.reservedList.map(function(x){
        return { customer: (x && x.customer) || "", qty: Number((x && x.qty) || 0), time: x && x.time ? x.time : null };
      }) : [];
      var need = qty;
      var cust = String(L.customer || "").trim();
      for(var i = 0; i < list2.length && need > 0; i++){
        var okCust = !cust || String(list2[i].customer || "").indexOf(cust) >= 0 || cust.indexOf(String(list2[i].customer || "")) >= 0;
        if(!okCust && cust) continue;
        var q = Number(list2[i].qty || 0);
        if(q <= 0) continue;
        var take = Math.min(q, need);
        list2[i].qty = Number((q - take).toFixed(4));
        need = Number((need - take).toFixed(4));
      }
      list2 = list2.filter(function(x){ return Number(x.qty || 0) > 0; });
      var back = Number((qty - need).toFixed(4));
      if(back <= 0) return alert("找不到对应留货记录，无法撤销");
      var ns2 = Number((Number(data.stock || 0) + back).toFixed(4));
      await updateDoc(ref, { stock: ns2, reservedList: list2, lastUpdate: serverTimestamp() });
      await writeUndoLog(L, "撤销留货，可售+" + back);
    } else if(type === "取消留货"){
      if(!data) return alert("库存记录不存在");
      var st3 = Number(data.stock || 0);
      var use3 = qty;
      if(use3 > st3){
        if(!confirm("可售不足，无法完整恢复留货。是否按可售 " + st3 + " 恢复？")) return;
        use3 = st3;
      }
      if(use3 <= 0) return alert("可售为 0，无法恢复留货");
      var list3 = Array.isArray(data.reservedList) ? data.reservedList.slice() : [];
      list3.push({ customer: L.customer || "", qty: use3 });
      await updateDoc(ref, {
        stock: Number((st3 - use3).toFixed(4)),
        reservedList: list3,
        lastUpdate: serverTimestamp()
      });
      await writeUndoLog(L, "撤销取消留货，重新留货 " + use3);
    } else {
      return alert("暂不支持撤销类型：" + type);
    }

    try {
      await updateDoc(doc(db, "logs", logId), { undone: true, undoneAt: serverTimestamp() });
    } catch(e){ console.warn(e); }

    alert("撤销成功");
    if(typeof window.reloadLogsPaged === "function") window.reloadLogsPaged();
  } catch(e){
    console.error(e);
    alert("撤销失败：" + (e.message || e));
  }
};

function renderLogPage(){
  var tbody = $("logTable");
  if(!tbody) return;
  var total = logCache.length;
  var pages = Math.max(1, Math.ceil(total / LOG_PAGE));
  if(logPage > pages) logPage = pages;
  if(logPage < 1) logPage = 1;
  var start = (logPage - 1) * LOG_PAGE;
  var slice = logCache.slice(start, start + LOG_PAGE);
  tbody.innerHTML = "";
  if(!slice.length){
    tbody.innerHTML = "<tr><td colspan='9' style='padding:16px;text-align:center;color:#888;'>暂无日志</td></tr>";
  } else {
    slice.forEach(function(row){
      var l = row.data;
      var time = l.timestamp && l.timestamp.toDate ? l.timestamp.toDate().toLocaleString() : "";
      var undone = l.undone ? "（已撤销）" : "";
      var canUndo = !l.undone && l.type !== "撤销" && /^(出库|入库|留货|取消留货)$/.test(l.type || "");
      var btn = canUndo
        ? "<button type='button' data-undo='" + esc(row.id) + "' style='padding:4px 10px;border:1px solid #fca5a5;background:#fef2f2;color:#b91c1c;border-radius:6px;cursor:pointer;font-size:12px;'>撤销</button>"
        : "<span style='font-size:12px;color:#94a3b8;'>" + (undone || "-") + "</span>";
      tbody.innerHTML += "<tr style='border-bottom:1px solid #eef2f6;" + (l.undone ? "opacity:0.55;" : "") + "'>" +
        "<td style='padding:8px 10px;font-size:12px;'>" + esc(time) + "</td>" +
        "<td style='padding:8px 10px;'>" + esc(l.type || "") + "</td>" +
        "<td style='padding:8px 10px;'>" + esc(l.code || "") + "</td>" +
        "<td style='padding:8px 10px;'>" + esc(l.spec || "") + "</td>" +
        "<td style='padding:8px 10px;'>" + esc(l.color || "") + "</td>" +
        "<td style='padding:8px 10px;'>" + esc(l.qty) + "</td>" +
        "<td style='padding:8px 10px;'>" + esc(l.warehouse || "") + "</td>" +
        "<td style='padding:8px 10px;'>" + esc(l.customer || "") + "</td>" +
        "<td style='padding:8px 10px;'>" + btn + "</td></tr>";
    });
  }
  tbody.querySelectorAll("[data-undo]").forEach(function(b){
    b.onclick = function(){ window.undoLogEntry(b.getAttribute("data-undo")); };
  });
  var info = $("logPageInfo");
  if(info) info.textContent = "第 " + logPage + " / " + pages + " 页，共 " + total + " 条";
  var prev = $("logPrev");
  var next = $("logNext");
  if(prev) prev.disabled = logPage <= 1;
  if(next) next.disabled = logPage >= pages;
}

var logAll = [];
function applyLogFilter(){
  var kw = (($("logSearch") && $("logSearch").value) || "").trim().toLowerCase();
  var typ = (($("logType") && $("logType").value) || "").trim();
  logCache = logAll.filter(function(row){
    var l = row.data || {};
    if(typ && String(l.type || "") !== typ) return false;
    if(!kw) return true;
    var blob = [l.type, l.code, l.spec, l.color, l.warehouse, l.customer, l.source]
      .map(function(x){ return String(x || "").toLowerCase(); }).join(" ");
    return blob.indexOf(kw) >= 0;
  });
  logPage = 1;
  renderLogPage();
}

async function loadLogsPaged(){
  var tbody = $("logTable");
  if(tbody) tbody.innerHTML = "<tr><td colspan='9' style='padding:12px;color:#666;'>加载中…</td></tr>";
  try {
    var snap = await getDocs(query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(2000)));
    logAll = [];
    snap.forEach(function(d){ logAll.push({ id: d.id, data: d.data() }); });
    applyLogFilter();
  } catch(e){
    console.error(e);
    if(tbody) tbody.innerHTML = "<tr><td colspan='9' style='padding:12px;color:#b91c1c;'>加载失败</td></tr>";
  }
}
window.reloadLogsPaged = loadLogsPaged;

function enhanceLogPage(){
  var tab = $("tab_log");
  if(!tab) return;
  if(tab.dataset.logTools === "1" && $("logPageInfo")) return;
  tab.innerHTML =
    "<h3 style='margin:0 0 12px;'>日志</h3>" +
    "<div style='display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;'>" +
    "<button type='button' onclick='downloadLogs()' style='padding:7px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;cursor:pointer;'>下载CSV</button>" +
    "<button type='button' id='logReload' style='padding:7px 14px;border:none;border-radius:8px;background:#2f7dd1;color:#fff;cursor:pointer;'>刷新</button>" +
    "<input id='logSearch' placeholder='搜索编号/客户/仓库' style='flex:1;min-width:140px;padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;'>" +
    "<select id='logType' style='padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;'><option value=''>全部类型</option><option value='入库'>入库</option><option value='出库'>出库</option><option value='留货'>留货</option><option value='取消留货'>取消留货</option><option value='撤销'>撤销</option></select>" +
    "<span style='font-size:12px;color:#64748b;'>最近 2000 条。可撤销出库/入库/留货。每页 " + LOG_PAGE + " 条。</span></div>" +
    "<div style='overflow-x:auto;'><table style='width:100%;border-collapse:collapse;min-width:720px;'>" +
    "<thead><tr style='background:#f1f5f9;text-align:left;'>" +
    "<th style='padding:8px 10px;'>时间</th><th style='padding:8px 10px;'>类型</th><th style='padding:8px 10px;'>编号</th>" +
    "<th style='padding:8px 10px;'>规格</th><th style='padding:8px 10px;'>色号</th><th style='padding:8px 10px;'>数量</th>" +
    "<th style='padding:8px 10px;'>仓库</th><th style='padding:8px 10px;'>客户</th><th style='padding:8px 10px;'>操作</th>" +
    "</tr></thead><tbody id='logTable'></tbody></table></div>" +
    "<div style='display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px;'>" +
    "<button type='button' id='logPrev' style='padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;cursor:pointer;'>上一页</button>" +
    "<span id='logPageInfo' style='font-size:13px;color:#475569;'></span>" +
    "<button type='button' id='logNext' style='padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;cursor:pointer;'>下一页</button></div>";
  tab.dataset.logTools = "1";
  $("logReload").onclick = function(){ loadLogsPaged(); };
  $("logPrev").onclick = function(){ logPage--; renderLogPage(); };
  $("logNext").onclick = function(){ logPage++; renderLogPage(); };
  if($("logSearch")){
    $("logSearch").addEventListener("keydown", function(e){ if(e.key === "Enter") applyLogFilter(); });
    $("logSearch").addEventListener("input", function(){ applyLogFilter(); });
  }
  if($("logType")) $("logType").onchange = function(){ applyLogFilter(); };
  loadLogsPaged();
}

function renderResPage(){
  var tbody = $("reserveList");
  if(!tbody) return;
  var total = resCache.length;
  var pages = Math.max(1, Math.ceil(total / RES_PAGE));
  if(resPage > pages) resPage = pages;
  if(resPage < 1) resPage = 1;
  var start = (resPage - 1) * RES_PAGE;
  var slice = resCache.slice(start, start + RES_PAGE);
  tbody.innerHTML = "";
  if(!slice.length){
    tbody.innerHTML = "<tr><td colspan='8' style='padding:16px;text-align:center;color:#888;'>暂无留货记录</td></tr>";
  } else {
    slice.forEach(function(row){
      var days = reserveDays(row.at);
      var isOver = days != null && days >= 30;
      var rowStyle = isOver
        ? "border-bottom:1px solid #fecaca;background:#fef2f2;"
        : "border-bottom:1px solid #eef2f6;";
      var daysHtml = days == null
        ? "<span style='color:#888;'>—</span>"
        : (isOver
          ? "<span style='color:#b91c1c;font-weight:700;'>" + days + " 天 ⚠</span>"
          : "<span>" + days + " 天</span>");
      tbody.innerHTML += "<tr style='" + rowStyle + "'>" +
        "<td style='padding:10px 12px;'>" + esc(row.code) + "</td>" +
        "<td style='padding:10px 12px;'>" + esc(row.spec || "-") + "</td>" +
        "<td style='padding:10px 12px;'>" + esc(row.color || "-") + "</td>" +
        "<td style='padding:10px 12px;font-weight:600;'>" + esc(row.qty) + "</td>" +
        "<td style='padding:10px 12px;'>" + esc(row.customer || "") + "</td>" +
        "<td style='padding:10px 12px;font-size:12px;color:#475569;'>" + esc(fmtReserveAt(row.at)) + "</td>" +
        "<td style='padding:10px 12px;'>" + daysHtml + "</td>" +
        "<td style='padding:10px 12px;white-space:nowrap;'>" +
          "<button type='button' onclick=\"editReserve('" + row.id + "'," + row.index + ")\" style='padding:5px 10px;margin-right:6px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:8px;cursor:pointer;font-size:12px;'>修改</button>" +
          "<button type='button' onclick=\"deleteReserve('" + row.id + "'," + row.index + ")\" style='padding:5px 10px;background:#fdecea;color:#e74c3c;border:none;border-radius:8px;cursor:pointer;font-size:12px;'>取消</button>" +
        "</td></tr>";
    });
  }
  var info = $("resPageInfo");
  if(info) info.textContent = "第 " + resPage + " / " + pages + " 页，共 " + total + " 条";
  var prev = $("resPrev");
  var next = $("resNext");
  if(prev) prev.disabled = resPage <= 1;
  if(next) next.disabled = resPage >= pages;
}

async function loadReservePaged(){
  var tbody = $("reserveList");
  try {
    var snap = await getDocs(query(collection(db, "inventory"), where("reservedList", "!=", [])));
    resCache = [];
    snap.forEach(function(d){
      var i = d.data();
      (i.reservedList || []).forEach(function(r, index){
        if(!r || Number(r.qty || 0) <= 0) return;
        resCache.push({
          id: d.id, index: index,
          code: i.code || "", spec: i.spec || "", color: i.color || "",
          qty: r.qty, customer: r.customer || "", at: r.at || null
        });
      });
    });
    resPage = 1;
    renderResPage();
  } catch(e){
    console.error(e);
    if(tbody) tbody.innerHTML = "<tr><td colspan='8' style='padding:12px;color:#b91c1c;'>加载失败</td></tr>";
  }
}

function enhanceReservePage(){
  var tab = $("tab_reserve");
  if(!tab) return;
  var listWrap = tab.querySelector("#reserveList");
  if(!listWrap) return;
  if(tab.dataset.resTools === "1" && $("resPageInfo")) {
    loadReservePaged();
    return;
  }
  if(!$("resPageInfo")){
    var pager = document.createElement("div");
    pager.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px;";
    pager.innerHTML =
      "<button type='button' id='resPrev' style='padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;cursor:pointer;'>上一页</button>" +
      "<span id='resPageInfo' style='font-size:13px;color:#475569;'></span>" +
      "<button type='button' id='resNext' style='padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;cursor:pointer;'>下一页</button>";
    if(listWrap.parentElement) listWrap.parentElement.appendChild(pager);
    else tab.appendChild(pager);
    $("resPrev").onclick = function(){ resPage--; renderResPage(); };
    $("resNext").onclick = function(){ resPage++; renderResPage(); };
  }
  var thead = tab.querySelector("thead tr");
  if(thead){
    thead.innerHTML =
      "<th style='padding:10px 12px;text-align:left;'>编号</th>" +
      "<th style='padding:10px 12px;text-align:left;'>规格</th>" +
      "<th style='padding:10px 12px;text-align:left;'>色号</th>" +
      "<th style='padding:10px 12px;text-align:left;'>留货数量</th>" +
      "<th style='padding:10px 12px;text-align:left;'>客户名</th>" +
      "<th style='padding:10px 12px;text-align:left;'>留货时间</th>" +
      "<th style='padding:10px 12px;text-align:left;'>已留天数</th>" +
      "<th style='padding:10px 12px;text-align:left;'>操作</th>";
    thead.dataset.timeCol = "1";
  }
  tab.dataset.resTools = "1";
  window.loadReserve = loadReservePaged;
  loadReservePaged();
}

function hookShowTab(){
  if(typeof window.showTab !== "function") return false;
  if(window.showTab.__logToolsHooked) return true;
  var orig = window.showTab;
  window.showTab = function(name){
    orig.apply(this, arguments);
    if(name === "log") setTimeout(enhanceLogPage, 50);
    if(name === "reserve") setTimeout(enhanceReservePage, 80);
  };
  window.showTab.__logToolsHooked = true;
  return true;
}

function boot(){
  hookShowTab();
  setInterval(hookShowTab, 1000);
  window.downloadLogs = async function(){
    try {
      alert("正在导出全部日志，并计算出库后剩余…");
      var logs = [];
      var last = null;
      while(logs.length < 20000){
        var q = last
          ? query(collection(db, "logs"), orderBy("timestamp", "desc"), startAfter(last), limit(500))
          : query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(500));
        var snap = await getDocs(q);
        if(snap.empty) break;
        snap.forEach(function(d){ logs.push({ id: d.id, data: d.data() || {} }); });
        last = snap.docs[snap.docs.length - 1];
        if(snap.size < 500) break;
      }
      var stockMap = {};
      var invSnap = await getDocs(collection(db, "inventory"));
      invSnap.forEach(function(d){
        var i = d.data() || {};
        var key = String(i.code || "") + "|" + String(i.color || "") + "|" + String(i.warehouse || "").toLowerCase();
        stockMap[key] = Number(i.stock || 0);
      });
      var transitSnap = await getDocs(collection(db, "in_transit"));
      var seenIn = {};
      logs.forEach(function(row){
        var l = row.data;
        if(l.type !== "入库") return;
        var k = [l.code, l.color, l.containerNo || "", l.qty].join("|");
        seenIn[k] = true;
      });
      transitSnap.forEach(function(d){
        var it = d.data() || {};
        if(!/已入库|已入庫|已入仓/.test(String(it.status || ""))) return;
        var qty = Number(it.inboundQty != null ? it.inboundQty : it.qty || 0);
        if(!qty) return;
        var k = [it.code || "", it.color || "", it.containerNo || "", qty].join("|");
        if(seenIn[k]) return;
        var ts = it.updatedAt && it.updatedAt.toDate ? it.updatedAt.toDate() : null;
        logs.push({
          id: "transit-" + d.id,
          data: {
            timestamp: it.updatedAt || null,
            type: "入库",
            code: it.code || "",
            spec: it.spec || "",
            color: it.color || "",
            qty: qty,
            warehouse: it.inboundWarehouse || "",
            customer: "柜号" + (it.containerNo || "") + " 在途已入库补记",
            source: "整柜入库",
            containerNo: it.containerNo || "",
            _ms: ts ? ts.getTime() : 0
          }
        });
      });
      function msOf(l){
        if(l._ms) return l._ms;
        try { return l.timestamp && l.timestamp.toDate ? l.timestamp.toDate().getTime() : 0; } catch(e){ return 0; }
      }
      var groups = {};
      logs.forEach(function(row){
        var l = row.data;
        var key = String(l.code || "") + "|" + String(l.color || "") + "|" + String(l.warehouse || "").toLowerCase();
        if(!groups[key]) groups[key] = [];
        groups[key].push(row);
      });
      Object.keys(groups).forEach(function(key){
        var arr = groups[key].slice().sort(function(a, b){ return msOf(b.data) - msOf(a.data); });
        var running = stockMap.hasOwnProperty(key) ? stockMap[key] : 0;
        arr.forEach(function(row){
          var l = row.data;
          var qty = Number(l.qty || 0);
          row.after = running;
          var type = l.type || "";
          if(type === "出库" || type === "留货") running = Number((running + qty).toFixed(4));
          else if(type === "入库" || type === "取消留货") running = Number((running - qty).toFixed(4));
        });
      });
      var rows = [["时间","类型","编号","规格","色号","数量","操作后剩余","仓库","客户","来源","柜号"]];
      logs.sort(function(a, b){ return msOf(b.data) - msOf(a.data); });
      logs.forEach(function(row){
        var l = row.data;
        var time = "";
        try { time = l.timestamp && l.timestamp.toDate ? l.timestamp.toDate().toLocaleString() : ""; } catch(e){}
        rows.push([
          time, l.type || "", l.code || "", l.spec || "", l.color || "",
          l.qty == null ? "" : l.qty,
          row.after == null ? "" : row.after,
          l.warehouse || "", l.customer || "", l.source || "", l.containerNo || ""
        ]);
      });
      var csv = rows.map(function(r){
        return r.map(function(c){
          var s = String(c == null ? "" : c);
          if(/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
          return s;
        }).join(",");
      }).join("\n");
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
      a.download = "logs.csv";
      a.click();
      alert("已导出 " + (rows.length - 1) + " 行。操作后剩余 = 这笔出/入库之后，该编号在该仓库的可售剩余。");
    } catch(e){
      console.error(e);
      alert("导出失败：" + (e.message || e));
    }
  };
  var origAddNew = window.addNewStock;
  if(origAddNew && !origAddNew.__logged){
    window.addNewStock = async function(){
      var code = (($("new_code") && $("new_code").value) || "").trim();
      var color = (($("new_color") && $("new_color").value) || "").trim();
      var spec = (($("new_spec") && $("new_spec").value) || "").trim();
      var warehouse = (($("new_warehouse") && $("new_warehouse").value) || "").toString().trim().toLowerCase();
      var qty = Number(($("new_qty") && $("new_qty").value) || 0);
      await origAddNew.apply(this, arguments);
      if(code && warehouse && qty){
        try {
          await addDoc(collection(db, "logs"), {
            timestamp: serverTimestamp(), type: "入库",
            code: code, spec: spec, color: color, warehouse: warehouse, qty: qty,
            customer: "新增库存", source: "新增"
          });
        } catch(e){ console.error(e); }
      }
    };
    window.addNewStock.__logged = true;
  }
  console.log("admin_log_tools.js ready v20261031a: full log csv + after-qty + transit inbound");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
