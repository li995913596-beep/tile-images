/**
 * 覆盖整柜入库：同编号打托分行累加，不覆盖库存
 * v20260918b
 */
import { db } from "./firebase.js";
import {
  collection, doc, getDoc, addDoc, updateDoc,
  serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

window.closeSiblingDuplicates = async function(){ return; };

var _origPreview = window.loadInboundPreview;
window.loadInboundPreview = async function(){
  if(typeof _origPreview === "function") await _origPreview.apply(this, arguments);
  var box = $("inbound_preview");
  if(!box) return;
  var note = box.querySelector(".ib-fix-note");
  if(!note){
    note = document.createElement("div");
    note.className = "ib-fix-note";
    note.style.cssText = "margin-top:8px;font-size:12px;color:#0f766e;";
    note.textContent = "同编号不同数量（打托分行，如 900 + 10）会全部保留，确认入库时累加到库存，不会互相覆盖。";
    box.appendChild(note);
  }
};

window.confirmInboundContainer = async function(){
  var cn = (($("inbound_container") && $("inbound_container").value) || "").trim();
  var wh = (($("inbound_warehouse") && $("inbound_warehouse").value) || "").trim().toLowerCase();
  if(!cn) return alert("请选择柜号");
  if(!wh) return alert("请选择入库仓库");
  var n = 0;
  while(document.getElementById("ib_code_"+n)) n++;
  if(!n) return alert("没有可入库的行，请先选择柜号加载");
  var lines = [];
  for(var i = 0; i < n; i++){
    var code = (($("ib_code_"+i) && $("ib_code_"+i).value) || "").trim();
    var color = (($("ib_color_"+i) && $("ib_color_"+i).value) || "").trim();
    var spec = String(($( "ib_spec_"+i) && $("ib_spec_"+i).value) || "").trim();
    var qty = Number(($("ib_qty_"+i) && $("ib_qty_"+i).value) || 0);
    var dmgBox = Number(($("ib_dmgbox_"+i) && $("ib_dmgbox_"+i).value) || 0);
    var dmgPc = Number(($("ib_dmgpc_"+i) && $("ib_dmgpc_"+i).value) || 0);
    var ppbRaw = ($("ib_ppb_"+i) && $("ib_ppb_"+i).value);
    var wtRaw = ($("ib_wt_"+i) && $("ib_wt_"+i).value);
    var pack = (($("ib_pack_"+i) && $("ib_pack_"+i).value) || "").trim();
    var src = window.inboundCache && window.inboundCache[i] && window.inboundCache[i].item;
    if(!pack && src) pack = String(src.brand || src.packaging || "").trim();
    var tid = window.inboundCache && window.inboundCache[i] && window.inboundCache[i].id;
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
      transitId: tid,
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
    return (idx+1) + ". " + l.code + " 色号" + (l.color||"-") + " 本行实入 " + l.inboundQty;
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
      if(lines[gi].transitId){
        var live0 = await getDoc(doc(db, "in_transit", lines[gi].transitId));
        var st = live0.exists() ? live0.data() : null;
        if(st && /已入库|已入庫|已入仓|已入倉/.test(String(st.status||""))){
          skip++;
          continue;
        }
      }
      var invId0 = lines[gi].code + "_" + lines[gi].color + "_" + wh;
      if(!byInv[invId0]){
        byInv[invId0] = { invId: invId0, code: lines[gi].code, color: lines[gi].color, spec: lines[gi].spec, piecesPerBox: lines[gi].piecesPerBox, boxWeight: lines[gi].boxWeight, packaging: lines[gi].packaging, total: 0, rows: [] };
        invOrder.push(invId0);
      }
      byInv[invId0].total = Number((byInv[invId0].total + lines[gi].inboundQty).toFixed(4));
      byInv[invId0].rows.push(lines[gi]);
    }
    async function addStockOnce(group){
      var addQty = Number(group.total || 0);
      var ref = doc(db, "inventory", group.invId);
      var meta = { code: group.code, color: group.color, spec: group.spec || "", piecesPerBox: group.piecesPerBox, boxWeight: group.boxWeight, packaging: group.packaging };
      await runTransaction(db, async function(tx){
        var snap = await tx.get(ref);
        if(snap.exists()){
          var data = snap.data() || {};
          tx.update(ref, {
            stock: Number((Number(data.stock || 0) + addQty).toFixed(4)),
            lastUpdate: serverTimestamp()
          });
        } else {
          tx.set(ref, {
            code: meta.code, color: meta.color, spec: meta.spec, warehouse: wh,
            stock: addQty, piecesPerBox: meta.piecesPerBox, boxWeight: meta.boxWeight,
            packaging: meta.packaging, reservedList: [], lastUpdate: serverTimestamp()
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
          await addDoc(collection(db, "logs"), {
            timestamp: serverTimestamp(), type: "入库",
            code: L.code, spec: L.spec || "", color: L.color, warehouse: wh,
            qty: L.inboundQty,
            customer: "柜号" + cn + (G.rows.length > 1 ? (" 打托"+G.rows.length+"行合计"+addQty) : ""),
            source: "整柜入库", containerNo: cn, fromFree: L.inboundQty
          });
          if(L.transitId){
            await updateDoc(doc(db, "in_transit", L.transitId), {
              status: "已入库", inboundWarehouse: wh, inboundQty: L.inboundQty,
              damageBoxes: L.dmgBox, damagePieces: L.dmgPc, updatedAt: serverTimestamp()
            });
          }
          ok++;
        }
      } catch(err){
        console.error(err);
        fail.push(G.code + " 合计" + G.total + ": " + ((err && err.message) || err));
      }
    }
    var msg = "入库完成：成功 " + ok + " 行（打托分行已累加，未覆盖）";
    if(skip) msg += "\n跳过已入库 " + skip + " 行";
    if(fail.length) msg += "\n失败：\n" + fail.join("\n");
    alert(msg);
    if(window.loadInboundContainers) window.loadInboundContainers();
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
    if($("inbound_preview")) $("inbound_preview").innerHTML = "";
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "确认整柜入库"; }
  }
};

console.log("transit_inbound_fix.js ready v20260918b");
