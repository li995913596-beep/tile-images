/**
 * 出库页增强：常规出库 + 计划识别出库
 * 本系统 stock=可售；留货在 reservedList（留货时已从 stock 扣除）
 * 可出 = 可售 + 留货；动用留货时二次确认
 */
import { db, auth } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, query, where, limit, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

function esc(s){
  var t = String(s == null ? "" : s);
  var amp = String.fromCharCode(38);
  t = t.split(amp).join(amp + "amp;");
  t = t.split('"').join(amp + "quot;");
  t = t.split("<").join(amp + "lt;");
  t = t.split(">").join(amp + "gt;");
  return t;
}

function reservedTotal(item){
  var list = Array.isArray(item.reservedList) ? item.reservedList : [];
  var t = 0;
  for(var i = 0; i < list.length; i++) t += Number((list[i] && list[i].qty) || 0);
  return t;
}

function freeQty(item){
  return Math.max(0, Number(item.stock || 0));
}

function maxShipQty(item){
  return Math.max(0, Number(item.stock || 0) + reservedTotal(item));
}

function hasActiveReserve(reservedList){
  if(!reservedList) return false;
  if(Array.isArray(reservedList)) return reservedList.some(function(r){ return r && Number(r.qty || 0) > 0; });
  return false;
}

function deductReserveFifo(list, need, preferCustomer){
  var remain = Number(need) || 0;
  if(remain <= 0) return list || [];
  var src = (list || []).map(function(r){
    return { customer: (r && r.customer) || "", qty: Number((r && r.qty) || 0), time: r && r.time ? r.time : null, at: r && r.at ? r.at : null };
  });
  var prefer = String(preferCustomer || "").trim().toLowerCase();
  var order = [];
  if(prefer){
    for(var i = 0; i < src.length; i++){
      if(String(src[i].customer || "").trim().toLowerCase() === prefer) order.push(i);
    }
  }
  for(var j = 0; j < src.length; j++){
    if(order.indexOf(j) < 0) order.push(j);
  }
  for(var k = 0; k < order.length && remain > 0; k++){
    var idx = order[k];
    var q = src[idx].qty;
    if(q <= 0) continue;
    var take = Math.min(q, remain);
    src[idx].qty = Number((q - take).toFixed(4));
    remain = Number((remain - take).toFixed(4));
  }
  return src.filter(function(r){ return Number(r.qty || 0) > 0; }).map(function(r){
    return { customer: r.customer || "", qty: r.qty, time: r.time || null, at: r.at || null };
  });
}

function splitShip(qty, free, reserved, useReserve, reserveFirst){
  qty = Number(qty) || 0;
  free = Math.max(0, Number(free) || 0);
  reserved = Math.max(0, Number(reserved) || 0);
  if(!useReserve){
    var onlyFree = Math.min(qty, free);
    return { fromRes: 0, fromFree: Number(onlyFree.toFixed(4)) };
  }
  if(reserveFirst){
    var fromRes = Math.min(qty, reserved);
    var fromFree = Math.min(Math.max(0, qty - fromRes), free);
    return { fromRes: Number(fromRes.toFixed(4)), fromFree: Number(fromFree.toFixed(4)) };
  }
  var freeFirst = Math.min(qty, free);
  var resNext = Math.min(Math.max(0, qty - freeFirst), reserved);
  return { fromRes: Number(resNext.toFixed(4)), fromFree: Number(freeFirst.toFixed(4)) };
}

function syncPreviewInputs(){
  var box = $("opf_preview");
  if(!box) return;
  box.querySelectorAll("[data-opf-qty]").forEach(function(inp){
    var i = Number(inp.getAttribute("data-opf-qty"));
    if(previewRows[i]) previewRows[i].qty = Number(inp.value) || 0;
  });
  box.querySelectorAll("[data-opf-reserve]").forEach(function(btn){
    var i = Number(btn.getAttribute("data-opf-reserve"));
    if(previewRows[i] && btn.tagName === "INPUT") previewRows[i].useReserve = !!btn.checked;
  });
  box.querySelectorAll("[data-opf-resfirst]").forEach(function(btn){
    var i = Number(btn.getAttribute("data-opf-resfirst"));
    if(previewRows[i] && btn.tagName === "INPUT") previewRows[i].reserveFirst = !!btn.checked;
  });
}

function reserveCustomersText(item){
  var list = Array.isArray(item.reservedList) ? item.reservedList : [];
  var names = [];
  for(var i = 0; i < list.length; i++){
    var r = list[i];
    if(!r || Number(r.qty || 0) <= 0) continue;
    var n = String(r.customer || "未填").trim() || "未填";
    names.push(n + "(" + r.qty + ")");
  }
  return names.join("、");
}

function normCode(s){
  return String(s == null ? "" : s).trim().toUpperCase().replace(/[\s\-_.]/g, "");
}
function codeCore(s){
  var n = normCode(s);
  if(/PS$/.test(n)) return n;
  var stripped = n.replace(/[A-Z]+$/, "");
  return stripped || n;
}
function codesLooseEqual(a, b){
  var A = normCode(a), B = normCode(b);
  if(!A || !B) return false;
  if(A === B) return true;
  if(/PS$/.test(A) || /PS$/.test(B)) return false;
  var ca = codeCore(a), cb = codeCore(b);
  if(ca && cb && ca === cb) return true;
  if(A.indexOf(B) === 0 || B.indexOf(A) === 0){
    var longer = A.length >= B.length ? A : B;
    var shorter = A.length >= B.length ? B : A;
    var rest = longer.slice(shorter.length);
    if(/^[A-Z]{1,3}$/.test(rest)) return true;
  }
  return false;
}
function codeMatchScore(planCode, invCode){
  var A = normCode(planCode), B = normCode(invCode);
  if(!A || !B) return 0;
  if(A === B) return 100;
  if(codesLooseEqual(planCode, invCode)) return 80;
  if(B.indexOf(A) === 0 || A.indexOf(B) === 0) return 60;
  if(B.indexOf(A) >= 0 || A.indexOf(B) >= 0) return 40;
  return 0;
}

function cleanTok(s){
  return String(s || "").replace(/[。．.、，,\s]+$/g, "").replace(/^[。．.、，,\s]+/g, "").trim();
}
function classifyPayAccount(tok){
  var t = cleanTok(tok);
  if(!t) return null;
  if(/已付款|已经付款|已付完|付清/.test(t)) return { pay: "已付款" };
  if(/未付款|没付款|尚未付款/.test(t)) return { pay: "未付款" };
  if(/部分付款|已付定金|定金/.test(t)) return { pay: "部分付款" };
  if(/货到付款|到付/.test(t)) return { pay: "货到付款" };
  if(/^(已付|付了)$/.test(t)) return { pay: "已付款" };
  if(/^(未付|没付)$/.test(t)) return { pay: "未付款" };
  if(/未开票|不开票|不要票|不开发票|未开发票/.test(t)) return { account: "私账" };
  if(/开票|发票|要票|对公|公账|公司账/.test(t)) return { account: "公账" };
  if(/对私|私账|个人账|现金$/.test(t)) return { account: "私账" };
  return null;
}
function parseCustomerBlob(raw){
  var s = String(raw || "").replace(/^(客户名称|客户名|客户)\s*[:：]?\s*/, "");
  var parts = s.split(/[，,、；;\/|]/).map(cleanTok).filter(Boolean);
  var customer = "", pay = "", account = "";
  var nameParts = [];
  for(var i = 0; i < parts.length; i++){
    var tagged = classifyPayAccount(parts[i]);
    if(tagged && tagged.pay){ pay = tagged.pay; continue; }
    if(tagged && tagged.account){ account = tagged.account; continue; }
    nameParts.push(parts[i]);
  }
  customer = nameParts.join("").trim() ? nameParts.join(" ") : "";
  return { customer: customer, pay: pay, account: account };
}

function afterLabel(line, labels){
  var s = String(line || "");
  for(var i = 0; i < labels.length; i++){
    var idx = s.indexOf(labels[i]);
    if(idx < 0) continue;
    return s.slice(idx + labels[i].length).replace(/^[\s]*[:：︰﹕\-–—／/]?\s*/, "").trim();
  }
  return "";
}
function cleanColorVal(s){
  s = String(s == null ? "" : s).trim();
  s = s.replace(/^(色号|色碼|色码|အရောင်ကုဒ်|အရောင်)\s*[:：]?\s*/, "");
  s = s.replace(/\s+(规格|数量|仓库|编号).*$/, "");
  if(!s || s === "-" || s === "—" || s === "/" || s === "无" || s === "無" || s === "默认" || s === "默認") return "";
  return s;
}
function applyInlineFields(current, line){
  if(!current || !line) return;
  if(!current.color){
    var c = cleanColorVal(afterLabel(line, ["色号", "色碼", "色码", "အရောင်ကုဒ်"]));
    if(c) current.color = c;
  }
  if(!current.spec){
    var spec = afterLabel(line, ["规格", "အလျားအနံ"]);
    if(spec) current.spec = spec;
  }
  if(!current.qty){
    var qRaw = afterLabel(line, ["数量", "အရေအတွက်"]);
    var q = Number(String(qRaw).match(/[\d.]+/));
    if(q > 0) current.qty = q;
  }
  if(!current.warehouse){
    var wh = afterLabel(line, ["仓库", "倉庫", "ဂိုဒေါင်"]);
    if(wh) current.warehouse = wh.replace(/\s+/g, "");
  }
}

function parseShipPlanText(text){
  var lines = String(text || "").split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
  var customer = "", pay = "", account = "";
  var items = [];
  var current = null;
  function pushCurrent(){
    if(current && current.code){
      current.color = cleanColorVal(current.color);
      items.push(current);
    }
    current = null;
  }
  for(var i = 0; i < lines.length; i++){
    var line = lines[i];
    var isCustLine = /^(客户名称|客户名|客户)\s*[:：]/.test(line) || (/已付款|未付款|公账|私账|开票|未开票|发票/.test(line) && !/编号|规格|色号|数量|仓库/.test(line));
    if(isCustLine && !customer){
      var parsedC = parseCustomerBlob(line);
      if(parsedC.customer) customer = parsedC.customer;
      if(parsedC.pay) pay = parsedC.pay;
      if(parsedC.account) account = parsedC.account;
      if(customer || pay || account) continue;
    }
    if(/编号\s*[:：]/.test(line) || /ကုဒ်နိပတ်/.test(line)){
      var codeM = line.match(/编号\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9\-_]*)/);
      if(!codeM) codeM = line.match(/[:：]\s*([A-Za-z0-9][A-Za-z0-9\-_]*)/);
      if(codeM){
        pushCurrent();
        current = { code: codeM[1].trim(), spec: "", color: "", qty: 0, warehouse: "" };
        applyInlineFields(current, line);
      }
      continue;
    }
    if(!current) continue;
    if(/规格\s*[:：]/.test(line) || /အလျားအနံ/.test(line)){
      var sm = afterLabel(line, ["规格", "အလျားအနံ"]);
      if(sm) current.spec = sm;
      applyInlineFields(current, line);
      continue;
    }
    if(/色号/.test(line) || /色碼/.test(line) || /အရောင်/.test(line)){
      var col = cleanColorVal(afterLabel(line, ["色号", "色碼", "色码", "အရောင်ကုဒ်", "အရောင်"]));
      if(!col){
        var colM = line.match(/色号\s*[:：]?\s*(.*)$/);
        if(colM) col = cleanColorVal(colM[1]);
      }
      if(col) current.color = col;
      applyInlineFields(current, line);
      continue;
    }
    if(/数量\s*[:：]/.test(line) || /အရေအတွက်/.test(line)){
      var qm = line.match(/数量\s*[:：]\s*([\d.]+)/);
      if(!qm) qm = line.match(/([\d.]+)\s*$/);
      if(qm) current.qty = Number(qm[1]) || 0;
      applyInlineFields(current, line);
      continue;
    }
    if(/仓库/.test(line) || /ဂိုဒေါင်/.test(line)){
      var wh = afterLabel(line, ["仓库", "倉庫", "ဂိုဒေါင်"]);
      if(wh) current.warehouse = wh.replace(/\s+/g, "");
      continue;
    }
    applyInlineFields(current, line);
  }
  pushCurrent();
  return { customer: customer, pay: pay, account: account, items: items };
}

var invScanCache = { at: 0, list: null };
async function scanAllInventory(){
  if(invScanCache.list && Date.now() - invScanCache.at < 90 * 1000) return invScanCache.list;
  var list = [];
  try {
    var snap = await getDocs(query(collection(db, "inventory"), limit(4000)));
    snap.forEach(function(d){
      var data = d.data();
      if(data.hidden) return;
      list.push({ id: d.id, data: data });
    });
  } catch(e){ console.error(e); }
  invScanCache = { at: Date.now(), list: list };
  return list;
}

async function findCandidates(code, color){
  var list = [], seen = {};
  var variants = [code, String(code).toUpperCase(), String(code).toLowerCase(), codeCore(code)];
  var uniq = [];
  variants.forEach(function(v){ if(v && uniq.indexOf(v) < 0) uniq.push(v); });
  for(var i = 0; i < uniq.length; i++){
    try {
      var snap = await getDocs(query(collection(db, "inventory"), where("code", "==", uniq[i])));
      snap.forEach(function(d){
        if(seen[d.id]) return;
        seen[d.id] = true;
        var data = d.data();
        if(data.hidden) return;
        list.push({ id: d.id, data: data, score: codeMatchScore(code, data.code) });
      });
    } catch(e){ console.error(e); }
  }
  var all = await scanAllInventory();
  for(var j = 0; j < all.length; j++){
    var row = all[j];
    if(seen[row.id]) continue;
    var sc = codeMatchScore(code, row.data.code);
    if(sc <= 0) continue;
    seen[row.id] = true;
    list.push({ id: row.id, data: row.data, score: sc });
  }
  list.sort(function(a, b){
    return (b.score || 0) - (a.score || 0) || freeQty(b.data) - freeQty(a.data);
  });
  return list;
}

function colorKeyOf(v){
  return String(v == null ? "" : v).trim().toLowerCase();
}
function pickCandidate(candidates, plan){
  if(!candidates || !candidates.length) return "";
  var wantColor = colorKeyOf(plan && plan.color);
  var wantWh = String((plan && plan.warehouse) || "").trim().toLowerCase();
  function score(row){
    var d = row.data || {};
    var s = 0;
    var c = colorKeyOf(d.color);
    var w = String(d.warehouse || "").trim().toLowerCase();
    if(wantColor && c === wantColor) s += 80;
    if(wantWh && w === wantWh) s += 40;
    s += Math.min(20, freeQty(d));
    s += (row.score || 0) / 10;
    return s;
  }
  var ranked = candidates.slice().sort(function(a, b){ return score(b) - score(a); });
  return ranked[0].id;
}
function colorsOf(candidates){
  var seen = {};
  var out = [];
  (candidates || []).forEach(function(c){
    var color = String((c.data && c.data.color) || "").trim();
    var key = colorKeyOf(color) || "(empty)";
    if(seen[key]) return;
    seen[key] = true;
    out.push(color);
  });
  return out;
}

var previewRows = [];

function switchOutMode(mode){
  var single = $("outPanelSingle");
  var plan = $("outPanelPlan");
  var b1 = $("outModeSingle");
  var b2 = $("outModePlan");
  if(!single || !plan) return;
  if(mode === "plan"){
    single.style.display = "none";
    plan.style.display = "block";
    if(b1){ b1.style.background = "#eef3f8"; b1.style.color = "#2c3e50"; }
    if(b2){ b2.style.background = "#0f766e"; b2.style.color = "#fff"; }
  } else {
    single.style.display = "block";
    plan.style.display = "none";
    if(b1){ b1.style.background = "#2f7dd1"; b1.style.color = "#fff"; }
    if(b2){ b2.style.background = "#eef3f8"; b2.style.color = "#2c3e50"; }
  }
}

function renderPreview(){
  var box = $("opf_preview");
  if(!box) return;
  if(!previewRows.length){
    box.innerHTML = "<div style='padding:12px;color:#888;font-size:13px;'>请先粘贴出货计划并点「识别预览」</div>";
    return;
  }
  var html = "<div style='overflow-x:auto;'><table style='width:100%;border-collapse:collapse;font-size:13px;min-width:760px;'>";
  html += "<thead><tr style='background:#f1f5f9;text-align:left;'>";
  html += "<th style='padding:8px;'>#</th><th style='padding:8px;'>编号</th><th style='padding:8px;'>色号</th><th style='padding:8px;'>计划数</th>";
  html += "<th style='padding:8px;'>仓库（可选）</th><th style='padding:8px;'>可售/留货</th><th style='padding:8px;'>动用留货</th><th style='padding:8px;'>留货客户</th><th style='padding:8px;'>出库数</th><th style='padding:8px;'>怎么扣</th><th style='padding:8px;'></th></tr></thead><tbody>";
  previewRows.forEach(function(row, idx){
    var bg = row.ok ? "#fff" : "#fef2f2";
    var stockInfo = "-";
    var statusExtra = row.error || "可出";
    var free = 0, rs = 0;
    var hit = null;
    if(row.invId && row.candidates){
      hit = row.candidates.filter(function(c){ return c.id === row.invId; })[0];
      if(hit){
        free = freeQty(hit.data);
        rs = reservedTotal(hit.data);
        stockInfo = "可售" + free + " / 留" + rs;
        if(row.ok){
          var parts = splitShip(row.qty, free, rs, row.useReserve, row.reserveFirst);
          if(parts.fromRes > 0 && parts.fromFree > 0){
            statusExtra = (row.reserveFirst ? "留货客户：" : "非留货客户：") + "先扣" + (row.reserveFirst ? "留货" : "可售") + "，可售" + parts.fromFree + " + 留货" + parts.fromRes;
          } else if(parts.fromRes > 0){
            statusExtra = "只扣留货 " + parts.fromRes;
          } else if(row.useReserve){
            statusExtra = "可售够用，不动留货";
          }
        } else if(!row.ok && free <= 0 && rs > 0 && !row.useReserve){
          statusExtra = "仅有留货，勾选「动用留货」";
        }
      }
    }
    var showColor = (hit && hit.data && hit.data.color) || row.plan.color || "";
    var colorList = colorsOf(row.candidates);
    var colorCell = "";
    if(colorList.length > 1){
      colorCell = "<select data-opf-color='" + idx + "' style='padding:6px 8px;border:2px solid #0f766e;border-radius:6px;font-weight:700;font-size:14px;min-width:90px;background:#ecfdf5;'>";
      colorList.forEach(function(c){
        var sel = colorKeyOf(c) === colorKeyOf(showColor) ? " selected" : "";
        colorCell += "<option value='" + esc(c) + "'" + sel + ">" + esc(c || "无色号") + "</option>";
      });
      colorCell += "</select>";
    } else {
      colorCell = "<span style='display:inline-block;min-width:64px;padding:4px 8px;border-radius:6px;background:#ecfdf5;color:#115e59;font-weight:800;font-size:15px;'>" + esc(showColor || "无色号") + "</span>";
    }
    if(row.plan.color && showColor && colorKeyOf(row.plan.color) !== colorKeyOf(showColor)){
      colorCell += "<div style='font-size:11px;color:#94a3b8;margin-top:2px;'>计划:" + esc(row.plan.color) + "</div>";
    }
    var filtered = (row.candidates || []).filter(function(c){
      if(!showColor) return true;
      return colorKeyOf(c.data.color) === colorKeyOf(showColor) || (!c.data.color && !showColor);
    });
    if(!filtered.length) filtered = row.candidates || [];
    var opts = filtered.map(function(c){
      var d = c.data;
      var avail = maxShipQty(d);
      var rsv = reservedTotal(d);
      var selected = c.id === row.invId ? " selected" : "";
      var label = esc(d.warehouse || "-") + " · 色" + esc(d.color || "无") + "（可出" + avail + (rsv > 0 ? "，留" + rsv : "") + "）";
      return "<option value='" + esc(c.id) + "'" + selected + ">" + label + "</option>";
    }).join("");
    var reserveChk = rs > 0
      ? ("<button type='button' data-opf-reserve='" + idx + "' style='min-width:64px;padding:8px 10px;border-radius:8px;border:1px solid " + (row.useReserve ? "#0f766e" : "#cbd5e1") + ";background:" + (row.useReserve ? "#0f766e" : "#fff") + ";color:" + (row.useReserve ? "#fff" : "#334155") + ";cursor:pointer;font-weight:700;'>" + (row.useReserve ? "已允许" : "允许") + "</button>")
      : "<span style='color:#94a3b8;font-size:12px;'>—</span>";
    var firstChk = rs > 0
      ? ("<button type='button' data-opf-resfirst='" + idx + "' style='min-width:72px;padding:8px 10px;border-radius:8px;border:1px solid " + (row.reserveFirst ? "#b45309" : "#cbd5e1") + ";background:" + (row.reserveFirst ? "#b45309" : "#fff") + ";color:" + (row.reserveFirst ? "#fff" : "#334155") + ";cursor:pointer;font-weight:700;'>" + (row.reserveFirst ? "是留货客户" : "不是") + "</button>")
      : "<span style='color:#94a3b8;font-size:12px;'>—</span>";
    html += "<tr style='background:" + bg + ";border-bottom:1px solid #f1f5f9;'>";
    html += "<td style='padding:8px;color:#64748b;'>" + (idx + 1) + "</td>";
    html += "<td style='padding:8px;font-weight:600;'>" + esc((hit && hit.data.code) || row.plan.code) + "</td>";
    html += "<td style='padding:8px;white-space:nowrap;'>" + colorCell + "</td>";
    html += "<td style='padding:8px;'>" + esc(row.plan.qty) + "</td>";
    if(row.candidates && row.candidates.length){
      html += "<td style='padding:8px;'><select data-opf-wh='" + idx + "' style='padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;max-width:280px;'>" + opts + "</select></td>";
    } else {
      html += "<td style='padding:8px;'><span style='color:#b91c1c;'>无匹配库存</span></td>";
    }
    html += "<td style='padding:8px;font-size:12px;'>" + stockInfo + "</td>";
    html += "<td style='padding:8px;text-align:center;'>" + reserveChk + "</td>";
    html += "<td style='padding:8px;text-align:center;'>" + firstChk + "</td>";
    html += "<td style='padding:8px;'><input data-opf-qty='" + idx + "' type='number' step='0.01' min='0' value='" + esc(row.qty) + "' style='width:80px;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;'></td>";
    html += "<td style='padding:8px;font-size:12px;color:" + (row.ok ? (String(statusExtra).indexOf("留货") >= 0 ? "#d97706" : "#16a34a") : "#b91c1c") + ";'>" + esc(statusExtra) + "</td>";
    html += "<td style='padding:8px;'><button type='button' data-opf-del='" + idx + "' style='padding:4px 10px;border:1px solid #fecaca;background:#fee2e2;color:#b91c1c;border-radius:6px;cursor:pointer;font-size:12px;'>删</button></td></tr>";
  });
  html += "</tbody></table></div>";
  box.innerHTML = html;
  function refreshRowOk(row){
    if(!row) return;
    var hit = (row.candidates || []).filter(function(c){ return c.id === row.invId; })[0];
    if(!hit){
      row.ok = false; row.error = "库存无此编号/色号"; return;
    }
    var av = rowMaxShip(row, hit.data);
    var free = freeQty(hit.data);
    var rs = reservedTotal(hit.data);
    if(row.qty > av) row.qty = av;
    if(av <= 0){
      row.ok = false;
      row.error = (rs > 0 && !row.useReserve) ? "仅有留货，请勾选「从留货出」" : "无可出数量";
    } else if(row.qty <= 0){
      row.ok = false; row.error = "数量需大于 0";
    } else {
      row.ok = true; row.error = "";
    }
  }
  box.querySelectorAll("[data-opf-color]").forEach(function(sel){
    sel.onchange = function(){
      var i = Number(sel.getAttribute("data-opf-color"));
      var row = previewRows[i]; if(!row) return;
      var want = colorKeyOf(sel.value);
      var hits = (row.candidates || []).filter(function(c){ return colorKeyOf(c.data.color) === want; });
      if(!hits.length) hits = row.candidates || [];
      row.plan = Object.assign({}, row.plan, { color: sel.value });
      row.invId = pickCandidate(hits, row.plan);
      refreshRowOk(row);
      renderPreview();
    };
  });
  box.querySelectorAll("[data-opf-wh]").forEach(function(sel){
    sel.onchange = function(){
      var i = Number(sel.getAttribute("data-opf-wh"));
      var row = previewRows[i]; if(!row) return;
      row.invId = sel.value;
      var hit = (row.candidates || []).filter(function(c){ return c.id === row.invId; })[0];
      if(hit && hit.data) row.plan = Object.assign({}, row.plan, { color: hit.data.color || row.plan.color, warehouse: hit.data.warehouse || row.plan.warehouse });
      refreshRowOk(row);
      renderPreview();
    };
  });
  box.querySelectorAll("[data-opf-reserve]").forEach(function(btn){
    btn.onclick = function(e){
      if(e){ e.preventDefault(); e.stopPropagation(); }
      var i = Number(btn.getAttribute("data-opf-reserve"));
      var row = previewRows[i]; if(!row) return;
      row.useReserve = !row.useReserve;
      if(!row.useReserve) row.reserveFirst = false;
      refreshRowOk(row);
      renderPreview();
    };
  });
  box.querySelectorAll("[data-opf-resfirst]").forEach(function(btn){
    btn.onclick = function(e){
      if(e){ e.preventDefault(); e.stopPropagation(); }
      var i = Number(btn.getAttribute("data-opf-resfirst"));
      var row = previewRows[i]; if(!row) return;
      row.reserveFirst = !row.reserveFirst;
      if(row.reserveFirst) row.useReserve = true;
      refreshRowOk(row);
      renderPreview();
    };
  });
  box.querySelectorAll("[data-opf-qty]").forEach(function(inp){
    inp.onchange = inp.onblur = function(){
      var i = Number(inp.getAttribute("data-opf-qty"));
      var row = previewRows[i]; if(!row) return;
      var hit = (row.candidates || []).filter(function(c){ return c.id === row.invId; })[0];
      if(!hit) return;
      var av = rowMaxShip(row, hit.data);
      var q = Number(inp.value) || 0;
      if(q > av){ alert("不能超过可出 " + av + (row.useReserve ? "" : "（未勾选从留货出）")); q = av; }
      if(q < 0) q = 0;
      row.qty = q;
      refreshRowOk(row);
      renderPreview();
    };
  });
  box.querySelectorAll("[data-opf-del]").forEach(function(btn){
    btn.onclick = function(){
      previewRows.splice(Number(btn.getAttribute("data-opf-del")), 1);
      renderPreview();
    };
  });
}

window.opfParsePreview = async function(){
  if(!auth.currentUser) return alert("请先登录");
  var text = (($("opf_text") && $("opf_text").value) || "").trim();
  if(!text) return alert("请先粘贴出货计划文本");
  var parsed = parseShipPlanText(text);
  if(!parsed.items.length) return alert("没有识别到瓷砖明细，请确认粘贴的是完整出货计划");
  if($("opf_customer")) $("opf_customer").value = parsed.customer || "";
  if($("opf_pay")) $("opf_pay").value = parsed.pay || "";
  if($("opf_account")) $("opf_account").value = parsed.account || "";
  var box = $("opf_preview");
  if(box) box.innerHTML = "<div style='padding:12px;color:#666;'>识别中，匹配库存…</div>";
  previewRows = [];
  for(var i = 0; i < parsed.items.length; i++){
    var it = parsed.items[i];
    var candidates = await findCandidates(it.code, it.color);
    var row = { plan: it, candidates: candidates, invId: "", qty: Number(it.qty) || 0, ok: false, error: "", useReserve: false, reserveFirst: false };
    if(!candidates.length){
      row.error = "库存无此编号/色号"; row.ok = false;
    } else {
      candidates.sort(function(a, b){ return (b.score || 0) - (a.score || 0) || freeQty(b.data) - freeQty(a.data) || maxShipQty(b.data) - maxShipQty(a.data); });
      row.candidates = candidates;
      row.invId = pickCandidate(candidates, it);
      var picked = candidates.filter(function(c){ return c.id === row.invId; })[0] || candidates[0];
      var free = freeQty(picked.data);
      var rs = reservedTotal(picked.data);
      var av = free;
      if(av <= 0){
        row.ok = false;
        row.error = rs > 0 ? "仅有留货，请勾选「从留货出」" : "无可出数量";
        if(rs <= 0) row.qty = 0;
      } else {
        if(row.qty > av) row.qty = av;
        row.ok = row.qty > 0;
        row.error = row.ok ? "" : "数量无效";
      }
    }
    previewRows.push(row);
  }
  renderPreview();
  var okN = previewRows.filter(function(r){ return r.ok; }).length;
  alert("识别完成：共 " + previewRows.length + " 行，可出 " + okN + " 行" + (previewRows.length - okN ? "，异常 " + (previewRows.length - okN) + " 行" : "") + "\n动用留货：不勾「留货客户」=先用可售、不够再动留货；勾上=优先扣留货");
};

window.opfConfirmOut = async function(){
  try {
  if(!auth.currentUser) return alert("请先登录");
  var customer = (($("opf_customer") && $("opf_customer").value) || "").trim();
  var pay = (($("opf_pay") && $("opf_pay").value) || "").trim();
  var account = (($("opf_account") && $("opf_account").value) || "").trim();
  var logCustomer = [customer, pay, account].filter(Boolean).join("，");
  syncPreviewInputs();
  var lines = previewRows.filter(function(r){ return r.ok && r.invId && r.qty > 0; });
  if(!lines.length) return alert("没有可出库的行。请先识别，异常行要勾选动用留货或删掉。");
  var summary = [];
  var reserveWarnings = [];
  for(var i = 0; i < lines.length; i++){
    var r = lines[i];
    var hit = (r.candidates || []).filter(function(c){ return c.id === r.invId; })[0];
    var data = (hit && hit.data) || {};
    var parts = splitShip(r.qty, freeQty(data), reservedTotal(data), r.useReserve, r.reserveFirst);
    summary.push((i + 1) + ". " + (data.code || r.plan.code) + " 色" + (data.color || r.plan.color || "-") + " @" + (data.warehouse || "-") + " × " + r.qty + (parts.fromRes > 0 ? "（扣可售" + parts.fromFree + "，扣留货" + parts.fromRes + (r.reserveFirst ? "，留货客户优先" : "，先用可售") + "）" : ""));
    if(parts.fromRes > 0){
      reserveWarnings.push((data.code || r.plan.code) + " 将扣留货 " + parts.fromRes);
    }
  }
  if(!confirm("确认按计划出库？\n客户：" + (logCustomer || "未填") + "\n共 " + lines.length + " 行\n\n" + summary.join("\n"))) return;
  if(reserveWarnings.length){
    if(!confirm("以下行会从留货扣库存：\n\n" + reserveWarnings.join("\n") + "\n\n确认继续出库？")) return;
  }
  var btn = $("opf_btn_confirm");
  if(btn){ btn.disabled = true; btn.textContent = "出库中…"; }
  var ok = 0, fail = [];
  var doneNotes = [];
  try {
    for(var j = 0; j < lines.length; j++){
      var L = lines[j];
      try {
        var ref = doc(db, "inventory", L.invId);
        var wrote = await runTransaction(db, async function(tx){
          var s2 = await tx.get(ref);
          if(!s2.exists()) throw new Error("已不存在");
          var data = s2.data();
          var qty = Number(L.qty) || 0;
          var stock = Number(data.stock || 0);
          var reserved = reservedTotal(data);
          var maxQ = rowMaxShip(L, data);
          if(qty <= 0 || qty > maxQ) throw new Error("可出不足");
          var parts = splitShip(qty, stock, reserved, L.useReserve, L.reserveFirst);
          if(parts.fromFree + parts.fromRes < qty) throw new Error("可出不足");
          var list = Array.isArray(data.reservedList) ? data.reservedList.map(function(x){
            return { customer: (x && x.customer) || "", qty: Number((x && x.qty) || 0), time: x && x.time ? x.time : null, at: x && x.at ? x.at : null };
          }) : [];
          var beforeRes = reservedTotal({ reservedList: list });
          if(parts.fromRes > 0) list = deductReserveFifo(list, parts.fromRes, logCustomer);
          var afterRes = reservedTotal({ reservedList: list });
          if(parts.fromRes > 0 && afterRes > beforeRes - parts.fromRes + 0.001) throw new Error("留货扣减失败");
          var newStock = Number((stock - parts.fromFree).toFixed(4));
          if(newStock < 0) newStock = 0;
          if(newStock <= 0 && !hasActiveReserve(list)){
            tx.delete(ref);
          } else {
            tx.update(ref, { stock: newStock, reservedList: list, lastUpdate: serverTimestamp() });
          }
          return { code: data.code, spec: data.spec || "", color: data.color || "", warehouse: data.warehouse || "", qty: qty, fromRes: parts.fromRes, fromFree: parts.fromFree, beforeRes: beforeRes, afterRes: afterRes, newStock: newStock };
        });
        await addDoc(collection(db, "logs"), {
          timestamp: serverTimestamp(),
          type: "出库",
          code: wrote.code,
          spec: wrote.spec,
          color: wrote.color,
          warehouse: wrote.warehouse,
          qty: wrote.qty,
          customer: logCustomer || "",
          source: wrote.fromRes > 0 ? "计划留货出库" : "计划出库",
          fromReserve: wrote.fromRes,
          fromFree: wrote.fromFree
        });
        doneNotes.push(wrote.code + " 扣可售" + wrote.fromFree + "，扣留货" + wrote.fromRes + "（留货 " + wrote.beforeRes + "→" + wrote.afterRes + "）");
        ok++;
      } catch(err){
        console.error(err);
        fail.push(L.plan.code + ": " + ((err && err.message) || err));
      }
    }
    alert("出库完成：成功 " + ok + " 行" + (doneNotes.length ? "\n" + doneNotes.join("\n") : "") + (fail.length ? "\n失败：\n" + fail.join("\n") : ""));
    if(ok){ previewRows = []; renderPreview(); if($("opf_text")) $("opf_text").value = ""; }
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "确认出库"; }
  }
  } catch(err){
    console.error(err);
    alert("确认出库失败：" + ((err && err.message) || err));
  }
};

function buildPlanPanelHtml(){
  return "<div style='padding:14px;border-radius:12px;background:#f0fdfa;border:1px solid #99f6e4;margin-bottom:12px;'>" +
    "<div style='font-size:13px;color:#0f766e;margin-bottom:10px;line-height:1.5;'>粘贴出货计划。默认只出可售。「动用留货」允许不够时动留货；「留货客户」勾上才优先扣留货，不勾则先用可售、不够再动留货。</div>" +
    "<textarea id='opf_text' rows='10' placeholder='在此粘贴出货计划全文' style='width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:13px;line-height:1.45;font-family:ui-monospace,monospace;resize:vertical;'></textarea>" +
    "<div style='margin-top:10px;'><button type='button' id='opf_btn_parse' style='padding:8px 16px;border:none;border-radius:8px;background:#0f766e;color:#fff;cursor:pointer;font-weight:600;'>识别预览</button></div></div>" +
    "<div style='padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:12px;'>" +
    "<div style='font-weight:600;margin-bottom:10px;color:#1f2937;font-size:14px;'>出库信息（可改）</div>" +
    "<div style='display:flex;flex-wrap:wrap;gap:10px;align-items:center;'>" +
    "<label style='font-size:13px;'>客户 <input id='opf_customer' style='padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;min-width:140px;'></label>" +
    "<label style='font-size:13px;'>付款 <input id='opf_pay' placeholder='已付款/未付款' style='padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;width:110px;'></label>" +
    "<label style='font-size:13px;'>账户 <input id='opf_account' placeholder='公账/私账' style='padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;width:100px;'></label></div></div>" +
    "<div style='padding:14px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;margin-bottom:12px;'>" +
    "<div style='font-weight:600;margin-bottom:8px;color:#1f2937;font-size:14px;'>明细预览</div>" +
    "<div id='opf_preview'><div style='padding:8px;color:#888;font-size:13px;'>识别后显示</div></div></div>" +
    "<button type='button' id='opf_btn_confirm' onclick='window.opfConfirmOut()' style='padding:10px 20px;border:none;border-radius:8px;background:#e67e22;color:#fff;cursor:pointer;font-weight:600;'>确认出库</button>";
}

function needsOutEnhance(){
  return !!$("tab_out") && !$("outModePlan");
}

function enhanceOutTab(){
  var tab = $("tab_out");
  if(!tab) return false;
  if(!needsOutEnhance() && $("outPanelSingle") && $("out_search")) return true;
  tab.innerHTML =
    "<h3 style='margin:0 0 12px;font-size:16px;color:#1f2937;'>出库</h3>" +
    "<div style='display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;'>" +
    "<button type='button' id='outModeSingle' style='padding:8px 16px;border:none;border-radius:8px;background:#2f7dd1;color:#fff;cursor:pointer;font-weight:600;'>常规出库</button>" +
    "<button type='button' id='outModePlan' style='padding:8px 16px;border:none;border-radius:8px;background:#eef3f8;color:#2c3e50;cursor:pointer;font-weight:600;'>计划出库</button></div>" +
    "<div id='outPanelSingle'>" +
    "<div style='font-size:13px;color:#666;margin-bottom:10px;'>搜索编号，逐条出库；支持从留货出库。</div>" +
    "<div style='display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center;'>" +
    "<input id='out_search' placeholder='搜索编号 / 规格' style='flex:1;min-width:160px;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;'>" +
    "<button type='button' onclick='searchOut()' style='padding:8px 16px;border:none;border-radius:8px;background:#e67e22;color:#fff;cursor:pointer;font-weight:600;'>搜索</button></div>" +
    "<div id='out_result'></div></div>" +
    "<div id='outPanelPlan' style='display:none;'>" + buildPlanPanelHtml() + "</div>";
  tab.dataset.opfEnhanced = "1";
  var b1 = $("outModeSingle"), b2 = $("outModePlan");
  if(b1) b1.onclick = function(){ switchOutMode("single"); };
  if(b2) b2.onclick = function(){ switchOutMode("plan"); };
  var bp = $("opf_btn_parse"); if(bp) bp.onclick = function(){ window.opfParsePreview(); };
  var bc = $("opf_btn_confirm"); if(bc) bc.onclick = function(){ window.opfConfirmOut(); };
  var searchInput = $("out_search");
  if(searchInput && !searchInput.__opfEnter){
    searchInput.__opfEnter = true;
    searchInput.addEventListener("keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); if(typeof window.searchOut === "function") window.searchOut(); }
    });
  }
  return true;
}

function hookShowTab(){
  if(typeof window.showTab !== "function") return false;
  if(window.showTab.__opfHooked) return true;
  var orig = window.showTab;
  window.showTab = function(name){
    orig.apply(this, arguments);
    if(name === "out"){
      setTimeout(enhanceOutTab, 0);
      setTimeout(enhanceOutTab, 150);
      setTimeout(enhanceOutTab, 400);
    }
  };
  window.showTab.__opfHooked = true;
  return true;
}

function boot(){
  hookShowTab();
  setInterval(function(){
    hookShowTab();
    if(needsOutEnhance()) enhanceOutTab();
  }, 500);
  document.addEventListener("click", function(e){
    var t = e.target;
    if(!t) return;
    var btn = t.closest ? t.closest("button") : null;
    if(btn && /出库/.test(btn.textContent || "") && !/计划|确认|常规/.test(btn.textContent || "")){
      setTimeout(enhanceOutTab, 50);
      setTimeout(enhanceOutTab, 300);
    }
  }, true);
  patchRegularReserveOut();
  console.log("out_from_plan.js ready v20261002c (reserve toggle buttons)");
}

function patchRegularReserveOut(){
  if(window.__opfReservePatched) return;
  window.__opfReservePatched = true;
  var origSearch = window.searchOut;
  window.searchOut = async function(){
    if(typeof origSearch === "function") await origSearch();
    enhanceReserveCustomerInputs();
  };
  var origShip = window.shipReserve;
  window.shipReserve = async function(id, index){
    var inp = $("ship_c_" + id + "_" + index);
    var overrideName = inp ? String(inp.value || "").trim() : "";
    var ref = doc(db, "inventory", id);
    var snap = await getDoc(ref);
    if(!snap.exists()) return alert("记录不存在");
    var data = snap.data();
    var list = Array.isArray(data.reservedList) ? data.reservedList.slice() : [];
    var item = list[index];
    if(!item) return alert("留货记录不存在");
    var maxQty = Number(item.qty || 0);
    var inputEl = $("ship_q_" + id + "_" + index);
    var shipQty = inputEl ? Number(inputEl.value) : maxQty;
    if(!shipQty || shipQty <= 0) return alert("请输入正确的出库数量");
    if(shipQty > maxQty) return alert("不能超过留货数量 " + maxQty);
    var logName = overrideName || item.customer || "";
    if(!confirm("确认从留货出库？\n编号：" + data.code + "\n色号：" + (data.color || "-") + "\n留货客户：" + (item.customer || "未填") + "\n出库客户：" + (logName || "未填") + "\n数量：" + shipQty)) return;
    shipQty = Number(shipQty.toFixed(4));
    var remain = Number((maxQty - shipQty).toFixed(4));
    if(remain > 0) list[index] = Object.assign({}, item, { qty: remain });
    else list.splice(index, 1);
    if(Number(data.stock || 0) <= 0 && !hasActiveReserve(list)) await deleteDoc(ref);
    else await updateDoc(ref, { reservedList: list, lastUpdate: serverTimestamp() });
    await addDoc(collection(db, "logs"), {
      timestamp: serverTimestamp(),
      type: "出库",
      code: data.code,
      spec: data.spec || "",
      color: data.color || "",
      warehouse: data.warehouse || "",
      qty: shipQty,
      customer: logName,
      source: "留货出库",
      reserveCustomer: item.customer || ""
    });
    alert(remain > 0 ? ("已出库 " + shipQty + "，剩余留货 " + remain) : ("已全部出库 " + shipQty));
    if($("out_search") && $("out_search").value.trim() && typeof window.searchOut === "function") window.searchOut();
  };
  document.addEventListener("click", function(){
    setTimeout(enhanceReserveCustomerInputs, 80);
  }, true);
}

function enhanceReserveCustomerInputs(){
  var box = $("out_result");
  if(!box) return;
  box.querySelectorAll("button[onclick*='shipReserve']").forEach(function(btn){
    var m = String(btn.getAttribute("onclick") || "").match(/shipReserve\('([^']+)',\s*(\d+)\)/);
    if(!m) return;
    var id = m[1], index = m[2];
    var inpId = "ship_c_" + id + "_" + index;
    if($(inpId)) return;
    var wrap = btn.parentNode;
    if(!wrap) return;
    var label = document.createElement("span");
    label.style.cssText = "font-size:12px;color:#64748b;";
    label.textContent = "出给";
    var inp = document.createElement("input");
    inp.id = inpId;
    inp.placeholder = "实际客户（可改）";
    inp.style.cssText = "width:120px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;";
    var exist = wrap.querySelector("span");
    if(exist){
      var reserveName = String(exist.textContent || "").replace(/^客户：/, "").replace(/（留.*$/, "").trim();
      if(reserveName && reserveName !== "未填") inp.value = reserveName;
    }
    wrap.insertBefore(inp, btn);
    wrap.insertBefore(label, inp);
  });
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
