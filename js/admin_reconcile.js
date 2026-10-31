/**
 * 按编号对账。只在点击时查询该编号，不扫全库。
 * v20261031a
 */
import { db } from "./firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s == null ? "" : s).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}
function familyCode(code){
  var c = String(code || "").trim().toUpperCase();
  if(/PS$/i.test(c)) return c;
  return c.replace(/(\d)(?:FL|F|L)$/i, "$1");
}
function msOf(l){
  try { return l.timestamp && l.timestamp.toDate ? l.timestamp.toDate().getTime() : 0; } catch(e){ return 0; }
}
function fmt(ms){
  if(!ms) return "";
  var d = new Date(ms);
  function p(n){ return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

function ensureTab(){
  if(!$("tab_audit")){
    var div = document.createElement("div");
    div.id = "tab_audit";
    div.className = "tab card";
    div.style.display = "none";
    div.style.padding = "16px 18px";
    var host = $("tab_log") || document.body;
    host.parentNode.insertBefore(div, host);
  }
  var nav = document.querySelector(".nav-card");
  if(nav && !nav.querySelector("[data-audit-btn]")){
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-audit-btn", "1");
    btn.textContent = "对账";
    btn.onclick = function(){ if(window.showTab) window.showTab("audit"); };
    var logBtn = Array.from(nav.querySelectorAll("button")).filter(function(b){ return b.textContent === "日志"; })[0];
    if(logBtn && logBtn.nextSibling) nav.insertBefore(btn, logBtn.nextSibling);
    else nav.appendChild(btn);
  }
  var box = $("tab_audit");
  if(box && !box.dataset.ready){
    box.dataset.ready = "1";
    box.innerHTML =
      "<h3 style='margin:0 0 6px;'>库存对账</h3>" +
      "<p style='font-size:13px;color:#64748b;margin:0 0 12px;'>只查你填的这一个编号。不下载全部日志，不后台刷新。</p>" +
      "<div style='display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;'>" +
        "<input id='audit_code' placeholder='编号，如 NB6007' style='padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;width:180px;'>" +
        "<label style='font-size:13px;color:#334155;'><input id='audit_family' type='checkbox'> 含 F/L 后缀</label>" +
        "<button type='button' id='audit_btn' style='padding:8px 16px;border:none;border-radius:8px;background:#0f766e;color:#fff;cursor:pointer;font-weight:700;'>对账</button>" +
      "</div>" +
      "<div id='audit_summary' style='margin-bottom:12px;'></div>" +
      "<div id='audit_table' style='overflow-x:auto;'></div>" +
      "<div style='margin-top:16px;padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;'>" +
        "<div style='font-weight:600;margin-bottom:6px;'>微信群补漏（可选）</div>" +
        "<div style='font-size:12px;color:#64748b;margin-bottom:8px;'>把群里搜到的几条粘进来。只和上面已经查出的出库对，不再查数据库。</div>" +
        "<textarea id='audit_wx' rows='4' placeholder='粘贴微信里这款的出货记录' style='width:100%;box-sizing:border-box;padding:8px;border:1px solid #d1d5db;border-radius:8px;'></textarea>" +
        "<button type='button' id='audit_wx_btn' style='margin-top:8px;padding:7px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;cursor:pointer;'>和系统出库对一下</button>" +
        "<div id='audit_wx_out' style='margin-top:8px;font-size:13px;'></div>" +
      "</div>";
    $("audit_btn").onclick = runAudit;
    $("audit_code").addEventListener("keydown", function(e){ if(e.key === "Enter") runAudit(); });
    $("audit_wx_btn").onclick = compareWechat;
  }
}

var lastAudit = null;

async function fetchByCode(collName, codes){
  var out = [];
  for(var i = 0; i < codes.length; i++){
    var snap = await getDocs(query(collection(db, collName), where("code", "==", codes[i])));
    snap.forEach(function(d){ out.push({ id: d.id, data: d.data() || {} }); });
  }
  return out;
}

function codesToQuery(raw, withFamily){
  var code = String(raw || "").trim();
  if(!code) return [];
  var list = [code];
  if(withFamily){
    var base = familyCode(code);
    ["", "F", "L", "FL"].forEach(function(suf){
      var c = base + suf;
      if(list.indexOf(c) < 0) list.push(c);
    });
  }
  return list.slice(0, 4);
}

async function runAudit(){
  var raw = ($("audit_code") && $("audit_code").value || "").trim();
  if(!raw) return alert("请填写编号");
  var withFamily = !!($("audit_family") && $("audit_family").checked);
  var codes = codesToQuery(raw, withFamily);
  var btn = $("audit_btn");
  if(btn){ btn.disabled = true; btn.textContent = "查询中…"; }
  try {
    var inv = await fetchByCode("inventory", codes);
    var logs = await fetchByCode("logs", codes);
    lastAudit = { codes: codes, inv: inv, logs: logs };
    renderAudit();
  } catch(e){
    console.error(e);
    alert("对账失败：" + (e.message || e));
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "对账"; }
  }
}

function renderAudit(){
  if(!lastAudit) return;
  var inv = lastAudit.inv;
  var logs = lastAudit.logs.slice();
  var stockMap = {};
  var stockHtml = inv.map(function(row){
    var i = row.data;
    var key = String(i.code||"") + "|" + String(i.color||"") + "|" + String(i.warehouse||"").toLowerCase();
    stockMap[key] = Number(i.stock || 0);
    var reserved = Array.isArray(i.reservedList) ? i.reservedList.reduce(function(s, r){ return s + Number((r && r.qty) || 0); }, 0) : 0;
    return "<div style='padding:8px 10px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;'>" +
      esc(i.code) + " · 色" + esc(i.color || "无") + " · " + esc(i.warehouse || "-") +
      " · 可售 <b>" + Number(i.stock || 0) + "</b> · 留货 " + reserved + "</div>";
  }).join("");
  if(!stockHtml) stockHtml = "<div style='color:#b91c1c;'>库存里没有这个编号</div>";

  var groups = {};
  logs.forEach(function(row){
    var l = row.data;
    var key = String(l.code||"") + "|" + String(l.color||"") + "|" + String(l.warehouse||"").toLowerCase();
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

  var sumIn = 0, sumOut = 0, sumRes = 0, sumCancel = 0;
  logs.forEach(function(row){
    var q = Number(row.data.qty || 0);
    var t = row.data.type || "";
    if(t === "入库") sumIn += q;
    else if(t === "出库") sumOut += q;
    else if(t === "留货") sumRes += q;
    else if(t === "取消留货") sumCancel += q;
  });
  var current = Object.keys(stockMap).reduce(function(s, k){ return s + stockMap[k]; }, 0);
  var expect = Number((sumIn - sumOut - sumRes + sumCancel).toFixed(4));
  var gap = Number((current - expect).toFixed(4));
  var gapColor = Math.abs(gap) < 0.01 ? "#15803d" : "#b91c1c";
  $("audit_summary").innerHTML =
    "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;'>" + stockHtml + "</div>" +
    "<div style='font-size:14px;line-height:1.7;'>读取：库存 " + inv.length + " 条，日志 " + logs.length + " 条（只含这个编号）<br>" +
    "入库 " + sumIn + " · 出库 " + sumOut + " · 留货 " + sumRes + " · 取消留货 " + sumCancel + "<br>" +
    "日志反推可售 " + expect + " · 现在可售 " + current +
    " · <b style='color:" + gapColor + ";'>差额 " + gap + "</b>" +
    (Math.abs(gap) < 0.01 ? "（对得上）" : "（对不上，看下面哪一笔开始岔）") + "</div>";

  logs.sort(function(a, b){ return msOf(a.data) - msOf(b.data); });
  var html = "<table style='width:100%;border-collapse:collapse;min-width:760px;font-size:13px;'><thead><tr style='background:#f1f5f9;'>" +
    "<th style='padding:8px;text-align:left;'>时间</th><th style='padding:8px;text-align:left;'>类型</th><th style='padding:8px;text-align:left;'>编号</th><th style='padding:8px;text-align:left;'>色号</th><th style='padding:8px;text-align:right;'>数量</th><th style='padding:8px;text-align:right;'>这笔之后剩余</th><th style='padding:8px;text-align:left;'>仓库</th><th style='padding:8px;text-align:left;'>客户</th></tr></thead><tbody>";
  logs.forEach(function(row){
    var l = row.data;
    var t = l.type || "";
    var color = t === "出库" ? "#c2410c" : (t === "入库" ? "#15803d" : "#334155");
    html += "<tr style='border-bottom:1px solid #f1f5f9;'>" +
      "<td style='padding:8px;'>" + esc(fmt(msOf(l))) + "</td>" +
      "<td style='padding:8px;color:" + color + ";font-weight:700;'>" + esc(t) + "</td>" +
      "<td style='padding:8px;'>" + esc(l.code || "") + "</td>" +
      "<td style='padding:8px;'>" + esc(l.color || "") + "</td>" +
      "<td style='padding:8px;text-align:right;'>" + esc(l.qty == null ? "" : l.qty) + "</td>" +
      "<td style='padding:8px;text-align:right;font-weight:700;'>" + (row.after == null ? "" : row.after) + "</td>" +
      "<td style='padding:8px;'>" + esc(l.warehouse || "") + "</td>" +
      "<td style='padding:8px;'>" + esc(l.customer || "") + "</td></tr>";
  });
  if(!logs.length) html += "<tr><td colspan='8' style='padding:12px;color:#94a3b8;'>没有这款的日志</td></tr>";
  html += "</tbody></table>";
  $("audit_table").innerHTML = html;
  if($("audit_wx_out")) $("audit_wx_out").innerHTML = "";
}

function compareWechat(){
  if(!lastAudit) return alert("先点对账");
  var text = ($("audit_wx") && $("audit_wx").value || "").trim();
  if(!text) return alert("先粘贴微信内容");
  var codes = lastAudit.codes.map(function(c){ return c.toUpperCase(); });
  var lines = text.split(/\n+/);
  var hits = [];
  lines.forEach(function(line){
    var up = line.toUpperCase();
    if(!codes.some(function(c){ return up.indexOf(c) >= 0; })) return;
    var nums = line.match(/\d+(?:\.\d+)?/g) || [];
    var qty = nums.length ? Number(nums[nums.length - 1]) : 0;
    hits.push({ line: line.trim(), qty: qty });
  });
  var wxQty = hits.reduce(function(s, h){ return s + (h.qty || 0); }, 0);
  var sysOut = lastAudit.logs.reduce(function(s, row){
    return s + (row.data.type === "出库" ? Number(row.data.qty || 0) : 0);
  }, 0);
  var diff = Number((wxQty - sysOut).toFixed(4));
  var html = "<div>群里提到 " + hits.length + " 行，数量合计 <b>" + wxQty + "</b> · 系统已出库 <b>" + sysOut + "</b> · 差 <b style='color:" + (Math.abs(diff) < 0.01 ? "#15803d" : "#b91c1c") + ";'>" + diff + "</b></div>";
  if(hits.length){
    html += "<div style='margin-top:6px;color:#475569;'>" + hits.map(function(h){ return esc(h.line); }).join("<br>") + "</div>";
  } else {
    html += "<div style='margin-top:6px;color:#b91c1c;'>粘贴内容里没找到这个编号</div>";
  }
  $("audit_wx_out").innerHTML = html;
}

function boot(){
  ensureTab();
  setInterval(ensureTab, 1500);
  console.log("admin_reconcile.js ready v20261031a");
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
