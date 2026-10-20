/**
 * 整柜一键入库（在途 → 库存）
 * v20260918b：打托分行（同编号不同数量）按行保留并累加库存，禁止覆盖
 */
import { auth, db } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc,
  query, limit, serverTimestamp, runTransaction
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

function sameContainer(a, b){
  var x = normCn(a), y = normCn(b);
  return !!x && x === y;
}

function logLooksInbound(log){
  if(!log) return false;
  var t = String(log.type || "").trim();
  if(/出库|出庫|留货|撤销|取消/.test(t)) return false;
  if(/入库|入庫|入仓|入倉/.test(t)) return true;
  var src = String(log.source || "");
  if(/整柜入库|一键入库|inbound/i.test(src)) return true;
  return false;
}

function logMentionsContainer(log, cn){
  if(!log || !cn) return false;
  var n = normCn(cn);
  if(!n) return false;
  var parts = [log.customer, log.source, log.remark, log.note, log.containerNo, log.container, log.柜号];
  for(var i = 0; i < parts.length; i++){
    var raw = String(parts[i] == null ? "" : parts[i]);
    if(!raw) continue;
    if(normCn(raw).indexOf(n) >= 0) return true;
    if(raw.indexOf(cn) >= 0) return true;
  }
  return false;
}

function qtyKey(code, color, qty){
  return lineKey(code, color) + "|" + Number(qty || 0).toFixed(4);
}

function collectClosedExact(docs, cn){
  var closed = {};
  docs.forEach(function(d){
    var item = d.data ? d.data() : (d.item || d);
    if(!sameContainer(item.containerNo, cn)) return;
    if(!isClosedTransit(item)) return;
    closed[qtyKey(item.code, item.color, item.qty)] = true;
  });
  return closed;
}

function rowIsClosed(item){
  return isClosedTransit(item);
}

async function loadLogsLite(){
  try {
    var snap = await getDocs(query(collection(db, "logs"), limit(2500)));
    var out = [];
    snap.forEach(function(d){ out.push(d.data()); });
    return out;
  } catch(e){
    console.warn("loadLogsLite", e);
    return [];
  }
}

function collectLogKeysForContainer(logs, cn){
  var keys = {};
  (logs || []).forEach(function(log){
    if(!logLooksInbound(log)) return;
    if(!logMentionsContainer(log, cn)) return;
    keys[lineKey(log.code, log.color)] = true;
    if(!normColor(log.color)) keys[normCode(log.code) + "|"] = true;
  });
  return keys;
}

function consumeQtyMatchedLogs(logs, cn, item){
  var need = Number(item.qty || 0);
  var code = normCode(item.code);
  if(!code) return false;
  var color = normColor(item.color);
  for(var i = 0; i < (logs || []).length; i++){
    var log = logs[i];
    if(!log || log.__used) continue;
    if(!logLooksInbound(log)) continue;
    if(normCode(log.code) !== code) continue;
    var lc = normColor(log.color);
    if(color && lc && color !== lc) continue;
    var q = Number(log.qty || 0);
    var qtyOk = need > 0 && q > 0 && Math.abs(q - need) < 0.05;
    if(!qtyOk) continue;
    if(logMentionsContainer(log, cn) || !/[柜號号]|整柜/.test([log.customer, log.source, log.containerNo, log.container].join(" "))){
      log.__used = true;
      return true;
    }
  }
  return false;
}

var inboundCache = [];
window.inboundCache = inboundCache;

window.loadInboundContainers = async function(){
  var sel = $("inbound_container");
  if(!sel) return;
  sel.innerHTML = '<option value="">加载中…</option>';
  try {
    var snap = await getDocs(query(collection(db, "in_transit"), limit(4000)));
    var docs = [];
    snap.forEach(function(d){ docs.push(d); });
    var map = {};
    var rawName = {};
    docs.forEach(function(d){
      var item = d.data();
      var cn = String(item.containerNo || "").trim();
      var n = normCn(cn);
      if(!n) return;
      if(!rawName[n]) rawName[n] = cn;
      if(rowIsClosed(item)) return;
      if(!map[n]) map[n] = 0;
      map[n]++;
    });
    var keys = Object.keys(map).sort(function(a,b){ return String(rawName[a]||a).localeCompare(String(rawName[b]||b), "zh-CN"); });
    if(!keys.length){
      sel.innerHTML = '<option value="">暂无可入库的柜子</option>';
      return;
    }
    sel.innerHTML = '<option value="">请选择柜号</option>' + keys.map(function(k){
      var label = rawName[k] || k;
      return '<option value="' + esc(label).replace(/"/g, "") + '">' + esc(label) + "（" + map[k] + "行）</option>";
    }).join("");
  } catch(e){
    console.error(e);
    sel.innerHTML = '<option value="">加载失败</option>';
  }
};

window.loadInboundPreview = async function(){
  var cn = (($("inbound_container") && $("inbound_container").value) || "").trim();
  var box = $("inbound_preview");
  if(!box) return;
  inboundCache = [];
  window.inboundCache = inboundCache;
  if(!cn){
    box.innerHTML = '<div style="color:#888;font-size:13px;">请先选择柜号</div>';
    return;
  }
  box.innerHTML = '<div style="color:#666;">加载中…对照在途状态和入库日志…</div>';
  try {
    var snap = await getDocs(query(collection(db, "in_transit"), limit(4000)));
    var docs = [];
    snap.forEach(function(d){ docs.push(d); });
    var logs = await loadLogsLite();
    var closedExact = collectClosedExact(docs, cn);
    var hidden = 0;
    var rows = [];
    var seenExactOpen = {};
    docs.forEach(function(d){
      var item = d.data();
      if(!sameContainer(item.containerNo, cn)) return;
      if(rowIsClosed(item)){
        hidden++;
        return;
      }
      var ek = qtyKey(item.code, item.color, item.qty);
      if(closedExact[ek] || seenExactOpen[ek]){
        hidden++;
        return;
      }
      if(consumeQtyMatchedLogs(logs, cn, item)){
        hidden++;
        return;
      }
      seenExactOpen[ek] = true;
      rows.push({ id: d.id, item: item });
    });
    rows.sort(function(a,b){
      return String(a.item.code||"").localeCompare(String(b.item.code||""), "zh-CN")
        || String(a.item.color||"").localeCompare(String(b.item.color||""), "zh-CN");
    });
    inboundCache = rows;
    window.inboundCache = inboundCache;
    if(!rows.length){
      box.innerHTML = '<div style="color:#b91c1c;">该柜没有待入库行' + (hidden ? "（已隐藏 " + hidden + " 行已入库/重复/日志已入）" : "（可能已入库）") + '</div>';
      return;
    }
    var html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:900px;">';
    html += '<thead><tr style="background:#f1f5f9;text-align:left;">' +
      '<th style="padding:8px;border-bottom:1px solid #e2e8f0;">编号</th>' +
      '<th style="padding:8px;border-bottom:1px solid #e2e8f0;">色号</th>' +
      '<th style="padding:8px;border-bottom:1px solid #e2e8f0;">规格</th>' +
      '<th style="padding:8px;border-bottom:1px solid #e2e8f0;">数量</th>' +
      '<th style="padding:8px;border-bottom:1px solid #e2e8f0;">损坏箱</th>' +
      '<th style="padding:8px;border-bottom:1px solid #e2e8f0;">损坏片</th>' +
      '<th style="padding:8px;border-bottom:1px solid #e2e8f0;">片/箱</th>' +
      '<th style="padding:8px;border-bottom:1px solid #e2e8f0;">箱重kg</th>' +
      '<th style="padding:8px;border-bottom:1px solid #e2e8f0;">包装</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(row, idx){
      var it = row.item;
      var ppb = it.pieces != null && it.pieces !== "" ? it.pieces : "";
      var wt = it.weight != null && it.weight !== "" ? it.weight : "";
      html += '<tr style="border-bottom:1px solid #f1f5f9;">' +
        '<td style="padding:6px;"><input id="ib_code_' + idx + '" value="' + esc(it.code||"") + '" style="width:100px;padding:5px;border:1px solid #d1d5db;border-radius:6px;"></td>' +
        '<td style="padding:6px;"><input id="ib_color_' + idx + '" value="' + esc(it.color||"") + '" style="width:80px;padding:5px;border:1px solid #d1d5db;border-radius:6px;"></td>' +
        '<td style="padding:6px;"><input id="ib_spec_' + idx + '" value="' + esc(normalizeSpec(it.spec||"")) + '" style="width:90px;padding:5px;border:1px solid #d1d5db;border-radius:6px;"></td>' +
        '<td style="padding:6px;"><input id="ib_qty_' + idx + '" type="number" step="0.01" value="' + esc(it.qty||0) + '" style="width:70px;padding:5px;border:1px solid #d1d5db;border-radius:6px;"></td>' +
        '<td style="padding:6px;"><input id="ib_dmgbox_' + idx + '" type="number" step="0.01" min="0" value="0" style="width:60px;padding:5px;border:1px solid #d1d5db;border-radius:6px;"></td>' +
        '<td style="padding:6px;"><input id="ib_dmgpc_' + idx + '" type="number" step="1" min="0" value="0" style="width:60px;padding:5px;border:1px solid #d1d5db;border-radius:6px;"></td>' +
        '<td style="padding:6px;"><input id="ib_ppb_' + idx + '" type="number" step="0.01" value="' + esc(ppb) + '" style="width:60px;padding:5px;border:1px solid #d1d5db;border-radius:6px;"></td>' +
        '<td style="padding:6px;"><input id="ib_wt_' + idx + '" type="number" step="0.01" value="' + esc(wt) + '" style="width:70px;padding:5px;border:1px solid #d1d5db;border-radius:6px;"></td>' +
        '<td style="padding:6px;"><input id="ib_pack_' + idx + '" value="' + esc(it.brand || it.packaging || "") + '" placeholder="可空" style="width:70px;padding:5px;border:1px solid #d1d5db;border-radius:6px;" title="默认用箱单牌子"></td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<div style="margin-top:10px;font-size:12px;color:#64748b;">待入库 ' + rows.length + ' 行' + (hidden ? "，已自动隐藏 " + hidden + " 行（该行已入库，或数量完全相同的重复导入）" : "") + '。同一编号打托拆成多行会全部保留并累加库存，不会互相覆盖。规格自动规范成 600x1200。实入 = 数量 − 损坏。</div>';
    html += '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">' +
      '<button type="button" id="btnInboundMarkOnly" style="padding:7px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;cursor:pointer;font-size:13px;">这些已入过库，只标记已入库（不增加库存）</button>' +
      '</div>';
    box.innerHTML = html;
    var markBtn = $("btnInboundMarkOnly");
    if(markBtn) markBtn.onclick = function(){ window.markContainerInboundOnly(); };
  } catch(e){
    console.error(e);
    box.innerHTML = '<div style="color:#b91c1c;">加载失败</div>';
  }
};

window.confirmInboundContainer = async function(){
  if(!auth.currentUser) return alert("请先登录");
  var cn = (($("inbound_container") && $("inbound_container").value) || "").trim();
  var wh = (($("inbound_warehouse") && $("inbound_warehouse").value) || "").trim().toLowerCase();
  if(!cn) return alert("请选择柜号");
  if(!wh) return alert("请选择入库仓库");
  if(!inboundCache.length) return alert("没有可入库的行，请先选择柜号加载");

  var lines = [];
  for(var i = 0; i < inboundCache.length; i++){
    var code = (($("ib_code_"+i) && $("ib_code_"+i).value) || "").trim();
    var color = (($("ib_color_"+i) && $("ib_color_"+i).value) || "").trim();
    var spec = normalizeSpec((($("ib_spec_"+i) && $("ib_spec_"+i).value) || "").trim());
    var qty = Number(($("ib_qty_"+i) && $("ib_qty_"+i).value) || 0);
    var dmgBox = Number(($("ib_dmgbox_"+i) && $("ib_dmgbox_"+i).value) || 0);
    var dmgPc = Number(($("ib_dmgpc_"+i) && $("ib_dmgpc_"+i).value) || 0);
    var ppbRaw = ($("ib_ppb_"+i) && $("ib_ppb_"+i).value);
    var wtRaw = ($("ib_wt_"+i) && $("ib_wt_"+i).value);
    var pack = (($("ib_pack_"+i) && $("ib_pack_"+i).value) || "").trim();
    if(!pack){
      var src = inboundCache[i] && inboundCache[i].item;
      if(src) pack = String(src.brand || src.packaging || "").trim();
    }
    var ppb = (ppbRaw !== "" && ppbRaw != null) ? Number(ppbRaw) : null;
    var boxWeight = (wtRaw !== "" && wtRaw != null) ? Number(wtRaw) : null;
    if(!code) return alert("第 " + (i+1) + " 行编号不能为空");
    if(qty < 0) return alert("第 " + (i+1) + " 行数量不能为负");
    var deduct = dmgBox > 0 ? dmgBox : 0;
    if(dmgPc > 0){
      if(!ppb || ppb <= 0) return alert("第 " + (i+1) + " 行有损坏片数，但未填片/箱，无法换算");
      deduct += dmgPc / ppb;
    }
    var inboundQty = Number((qty - deduct).toFixed(4));
    if(inboundQty < 0) inboundQty = 0;
    lines.push({
      transitId: inboundCache[i].id,
      code: code, color: color, spec: spec,
      qty: qty, dmgBox: dmgBox, dmgPc: dmgPc, inboundQty: inboundQty,
      piecesPerBox: (ppb != null && !isNaN(ppb)) ? ppb : null,
      boxWeight: (boxWeight != null && !isNaN(boxWeight)) ? boxWeight : null,
      packaging: pack || null
    });
  }

  var grouped = {};
  lines.forEach(function(l){
    var k = l.code + "|" + (l.color || "");
    if(!grouped[k]) grouped[k] = { code: l.code, color: l.color, parts: [], total: 0 };
    grouped[k].parts.push(l.inboundQty);
    grouped[k].total = Number((grouped[k].total + l.inboundQty).toFixed(4));
  });
  var summary = lines.map(function(l, idx){
    return (idx+1) + ". " + l.code + " 色号" + (l.color||"-") + " 本行实入 " + l.inboundQty +
      (l.dmgBox || l.dmgPc ? "（损箱"+l.dmgBox+" 损片"+l.dmgPc+"）" : "");
  }).join("\n");
  var sumLines = Object.keys(grouped).map(function(k){
    var g = grouped[k];
    return g.code + " 色号" + (g.color||"-") + " 合计 +" + g.total +
      (g.parts.length > 1 ? "（" + g.parts.join("+") + "，打托分行累加）" : "");
  }).join("\n");
  if(!confirm("确认整柜入库？\n柜号：" + cn + "\n仓库：" + wh + "\n共 " + lines.length + " 行\n同编号不同数量会累加，不会覆盖。\n\n" + summary + "\n\n合计：\n" + sumLines)) return;

  var btn = $("btnInboundConfirm");
  if(btn){ btn.disabled = true; btn.textContent = "入库中…"; }
  var ok = 0, skip = 0, fail = [];
  try {
    var byInv = {};
    var invOrder = [];
    for(var gi = 0; gi < lines.length; gi++){
      var live0 = await getDoc(doc(db, "in_transit", lines[gi].transitId));
      if(live0.exists() && isClosedTransit(live0.data())){
        skip++;
        continue;
      }
      var invId0 = lines[gi].code + "_" + lines[gi].color + "_" + wh;
      if(!byInv[invId0]){
        byInv[invId0] = { invId: invId0, code: lines[gi].code, color: lines[gi].color, spec: lines[gi].spec, piecesPerBox: lines[gi].piecesPerBox, boxWeight: lines[gi].boxWeight, packaging: lines[gi].packaging, total: 0, rows: [] };
        invOrder.push(invId0);
      }
      byInv[invId0].total = Number((byInv[invId0].total + lines[gi].inboundQty).toFixed(4));
      if(!byInv[invId0].spec && lines[gi].spec) byInv[invId0].spec = lines[gi].spec;
      if(byInv[invId0].piecesPerBox == null && lines[gi].piecesPerBox != null) byInv[invId0].piecesPerBox = lines[gi].piecesPerBox;
      if(byInv[invId0].boxWeight == null && lines[gi].boxWeight != null) byInv[invId0].boxWeight = lines[gi].boxWeight;
      if(!byInv[invId0].packaging && lines[gi].packaging) byInv[invId0].packaging = lines[gi].packaging;
      byInv[invId0].rows.push(lines[gi]);
    }
    async function addStockOnce(group){
      var addQty = Number(group.total || 0);
      var ref = doc(db, "inventory", group.invId);
      var meta = {
        code: group.code,
        color: group.color,
        spec: group.spec || "",
        piecesPerBox: group.piecesPerBox,
        boxWeight: group.boxWeight,
        packaging: group.packaging
      };
      await runTransaction(db, async function(tx){
        var snap = await tx.get(ref);
        if(snap.exists()){
          var data = snap.data() || {};
          var upd = {
            stock: Number((Number(data.stock || 0) + addQty).toFixed(4)),
            lastUpdate: serverTimestamp()
          };
          if(meta.spec && !data.spec) upd.spec = meta.spec;
          if(meta.piecesPerBox != null && (data.piecesPerBox == null || data.piecesPerBox === "")) upd.piecesPerBox = meta.piecesPerBox;
          if(meta.boxWeight != null && (data.boxWeight == null || data.boxWeight === "")) upd.boxWeight = meta.boxWeight;
          if(meta.packaging && !data.packaging) upd.packaging = meta.packaging;
          tx.update(ref, upd);
        } else {
          tx.set(ref, {
            code: meta.code,
            color: meta.color,
            spec: meta.spec,
            warehouse: wh,
            stock: addQty,
            piecesPerBox: meta.piecesPerBox,
            boxWeight: meta.boxWeight,
            packaging: meta.packaging,
            reservedList: [],
            lastUpdate: serverTimestamp()
          });
        }
      });
      return addQty;
    }
    for(var oi = 0; oi < invOrder.length; oi++){
      var G = byInv[invOrder[oi]];
      try {
        var addQty = await addStockOnce(G);
        for(var rj = 0; rj < G.rows.length; rj++){
          var L = G.rows[rj];
          try {
            await addDoc(collection(db, "logs"), {
              timestamp: serverTimestamp(),
              type: "入库",
              code: L.code,
              spec: L.spec || "",
              color: L.color,
              warehouse: wh,
              qty: L.inboundQty,
              customer: "柜号" + cn + (L.dmgBox || L.dmgPc ? (" 损箱"+L.dmgBox+"损片"+L.dmgPc) : "") + (G.rows.length > 1 ? (" 打托"+G.rows.length+"行合计"+addQty) : ""),
              source: "整柜入库",
              containerNo: cn,
              fromFree: L.inboundQty
            });
            await updateDoc(doc(db, "in_transit", L.transitId), {
              status: "已入库",
              inboundWarehouse: wh,
              inboundQty: L.inboundQty,
              damageBoxes: L.dmgBox,
              damagePieces: L.dmgPc,
              updatedAt: serverTimestamp()
            });
            ok++;
          } catch(errRow){
            console.error(errRow);
            fail.push(L.code + " x" + L.inboundQty + ": 库存已加，状态/日志失败 " + ((errRow && errRow.message) || errRow));
          }
        }
      } catch(err){
        console.error(err);
        fail.push(G.code + " 合计" + G.total + ": " + ((err && err.message) || err));
      }
    }
    var msg = "入库完成：成功 " + ok + " 行（在途已自动标记为「已入库」）";
    if(skip) msg += "\n跳过已入库 " + skip + " 行";
    if(fail.length) msg += "\n失败：\n" + fail.join("\n");
    alert(msg);
    inboundCache = [];
    window.inboundCache = inboundCache;
    if($("inbound_preview")) $("inbound_preview").innerHTML = "";
    window.loadInboundContainers();
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "确认整柜入库"; }
  }
};

window.markContainerInboundOnly = async function(){
  if(!auth.currentUser) return alert("请先登录");
  var cn = (($("inbound_container") && $("inbound_container").value) || "").trim();
  if(!cn) return alert("请选择柜号");
  if(!inboundCache.length) return alert("没有待处理的行");
  if(!confirm("确认把本柜这 " + inboundCache.length + " 行只改成「已入库」？\n不会增加库存，只是从整柜入库列表里拿掉。")) return;
  var ok = 0, fail = [];
  for(var i = 0; i < inboundCache.length; i++){
    try {
      await updateDoc(doc(db, "in_transit", inboundCache[i].id), {
        status: "已入库",
        inboundNote: "仅标记，未加库存",
        updatedAt: serverTimestamp()
      });
      ok++;
    } catch(err){
      fail.push((inboundCache[i].item && inboundCache[i].item.code) || inboundCache[i].id);
    }
  }
  alert("已标记 " + ok + " 行" + (fail.length ? "\n失败：" + fail.join("、") : ""));
  inboundCache = [];
  window.inboundCache = inboundCache;
  if($("inbound_preview")) $("inbound_preview").innerHTML = "";
  window.loadInboundContainers();
  if(window.reloadTransitAdmin) window.reloadTransitAdmin();
};

window.markWholeContainerInboundOnly = async function(){
  if(!auth.currentUser) return alert("请先登录");
  var cn = (($("inbound_container") && $("inbound_container").value) || "").trim();
  if(!cn) return alert("请先选择柜号");
  if(!confirm("确认把柜号「" + cn + "」下所有还显示在途/已到港的行，全部改成「已入库」？\n不会增加库存。")) return;
  var snap = await getDocs(query(collection(db, "in_transit"), limit(4000)));
  var ok = 0, fail = [];
  var jobs = [];
  snap.forEach(function(d){
    var item = d.data();
    if(!sameContainer(item.containerNo, cn)) return;
    if(isClosedTransit(item)) return;
    jobs.push(d.id);
  });
  for(var i = 0; i < jobs.length; i++){
    try {
      await updateDoc(doc(db, "in_transit", jobs[i]), {
        status: "已入库",
        inboundNote: "整柜仅标记，未加库存",
        updatedAt: serverTimestamp()
      });
      ok++;
    } catch(e){
      fail.push(jobs[i]);
    }
  }
  alert("已标记 " + ok + " 行" + (fail.length ? "\n失败 " + fail.length + " 行" : ""));
  inboundCache = [];
  window.inboundCache = inboundCache;
  if($("inbound_preview")) $("inbound_preview").innerHTML = "";
  window.loadInboundContainers();
  if(window.reloadTransitAdmin) window.reloadTransitAdmin();
};

async function closeTransitAfterRegularInbound(code, color){
  try {
    if(!code) return;
    var snap = await getDocs(query(collection(db, "in_transit"), limit(4000)));
    var hits = [];
    snap.forEach(function(d){
      var it = d.data();
      if(isClosedTransit(it)) return;
      if(normCode(it.code) !== normCode(code)) return;
      var lc = normColor(it.color), rc = normColor(color);
      if(lc && rc && lc !== rc) return;
      hits.push({ id: d.id, item: it });
    });
    if(!hits.length) return;
    var lines = hits.slice(0, 12).map(function(h){
      return (h.item.containerNo || "-") + " / " + (h.item.code || "") + " " + (h.item.color || "");
    }).join("\n");
    if(!confirm("库存已入库。在途里还有 " + hits.length + " 行同一编号，要一起改成「已入库」吗？\n（不改库存，只改在途状态）\n\n" + lines + (hits.length > 12 ? "\n…" : ""))) return;
    for(var i = 0; i < hits.length; i++){
      await updateDoc(doc(db, "in_transit", hits[i].id), {
        status: "已入库",
        inboundNote: "普通入库后同步标记",
        updatedAt: serverTimestamp()
      });
    }
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
    if(window.loadInboundContainers) window.loadInboundContainers();
  } catch(e){
    console.warn("closeTransitAfterRegularInbound", e);
  }
}

function hookRegularInbound(){
  if(typeof window.inStock === "function" && !window.inStock.__transitHook){
    var origIn = window.inStock;
    window.inStock = async function(id){
      await origIn.apply(this, arguments);
      try {
        var snap = await getDoc(doc(db, "inventory", id));
        if(snap.exists()){
          var data = snap.data();
          await closeTransitAfterRegularInbound(data.code, data.color);
        }
      } catch(e){ console.warn(e); }
    };
    window.inStock.__transitHook = true;
  }
  if(typeof window.addNewStock === "function" && !window.addNewStock.__transitHook){
    var origAdd = window.addNewStock;
    window.addNewStock = async function(){
      var code = (($("new_code") && $("new_code").value) || "").trim();
      var color = (($("new_color") && $("new_color").value) || "").trim();
      await origAdd.apply(this, arguments);
      try { await closeTransitAfterRegularInbound(code, color); } catch(e){ console.warn(e); }
    };
    window.addNewStock.__transitHook = true;
  }
}

function ensureContainerSearch(){
  var sel = $("inbound_container");
  if(!sel) return;
  var inp = $("inbound_container_q");
  if(!inp && sel.parentNode){
    inp = document.createElement("input");
    inp.id = "inbound_container_q";
    inp.placeholder = "输入柜号搜索";
    inp.style.cssText = "width:160px;padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;";
    sel.parentNode.insertBefore(inp, sel);
  }
  if(!inp || inp.__boundQ) return;
  inp.__boundQ = true;
  function applyFilter(){
    var q = String(inp.value || "").trim().toLowerCase();
    var opts = sel.options;
    var hits = [];
    for(var i = 0; i < opts.length; i++){
      var val = String(opts[i].value || "");
      var txt = String(opts[i].text || "");
      var show = !q || val.toLowerCase().indexOf(q) >= 0 || txt.toLowerCase().indexOf(q) >= 0 || normCn(val).indexOf(normCn(q)) >= 0;
      opts[i].hidden = !show && val !== "";
      if(show && val) hits.push(val);
    }
    return hits;
  }
  inp.addEventListener("input", applyFilter);
  inp.addEventListener("keydown", function(e){
    if(e.key !== "Enter") return;
    e.preventDefault();
    var hits = applyFilter();
    var q = String(inp.value || "").trim();
    if(!hits.length) return alert("没有匹配的柜号");
    var exact = hits.filter(function(v){ return v.toLowerCase() === q.toLowerCase() || normCn(v) === normCn(q); });
    sel.value = exact.length ? exact[0] : hits[0];
    window.loadInboundPreview();
  });
}

function bindInboundUI(){
  var pairs = [
    ["btnInboundLoadContainers", function(){ window.loadInboundContainers(); }],
    ["btnInboundPreview", function(){ window.loadInboundPreview(); }],
    ["btnInboundConfirm", function(){ window.confirmInboundContainer(); }],
    ["btnInboundMarkWhole", function(){ window.markWholeContainerInboundOnly(); }]
  ];
  pairs.forEach(function(pair){
    var el = $(pair[0]);
    if(el && !el.__boundIn){
      el.__boundIn = true;
      el.onclick = pair[1];
    }
  });
  var ic = $("inbound_container");
  if(ic && !ic.__boundChange){
    ic.__boundChange = true;
    ic.addEventListener("change", function(){ window.loadInboundPreview(); });
  }
  ensureContainerSearch();
  hookRegularInbound();
}

function hookShowTab(){
  if(typeof window.showTab !== "function") return false;
  if(window.showTab.__inboundHooked) return true;
  var orig = window.showTab;
  window.showTab = function(name){
    orig.apply(this, arguments);
    if(name === "transit"){
      bindInboundUI();
      window.loadInboundContainers();
    }
    if(name === "in") hookRegularInbound();
  };
  window.showTab.__inboundHooked = true;
  return true;
}

function ensureWarehouseOptions(){
  ["inbound_warehouse", "stats_warehouse", "r_warehouse"].forEach(function(id){
    var sel = $(id);
    if(!sel) return;
    var has = Array.from(sel.options).some(function(o){ return String(o.value).toLowerCase() === "my"; });
    if(has) return;
    var opt = document.createElement("option");
    opt.value = "my";
    opt.textContent = "MY";
    sel.appendChild(opt);
  });
}

function boot(){
  ensureWarehouseOptions();
  bindInboundUI();
  var n = 0;
  var t = setInterval(function(){
    n++;
    ensureWarehouseOptions();
    hookRegularInbound();
    if(hookShowTab() || n > 50) clearInterval(t);
  }, 200);
  setInterval(function(){ bindInboundUI(); ensureWarehouseOptions(); }, 2000);
  console.log("transit_inbound.js ready v20261020a (warehouse MY)");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
