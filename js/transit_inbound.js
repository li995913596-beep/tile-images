/**
 * 整柜一键入库（在途 → 库存）
 */
import { auth, db } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc,
  query, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

/** 规格统一：600*1200*9.0 -> 600x1200（去掉厚度，* 改 x） */
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

var inboundCache = [];

window.loadInboundContainers = async function(){
  var sel = $("inbound_container");
  if(!sel) return;
  sel.innerHTML = '<option value="">加载中…</option>';
  try {
    var snap = await getDocs(query(collection(db, "in_transit"), limit(2000)));
    var map = {};
    snap.forEach(function(d){
      var item = d.data();
      var st = item.status || "在途";
      if(st === "已入库" || st === "取消") return;
      var cn = String(item.containerNo || "").trim();
      if(!cn) return;
      if(!map[cn]) map[cn] = 0;
      map[cn]++;
    });
    var keys = Object.keys(map).sort(function(a,b){ return a.localeCompare(b, "zh-CN"); });
    if(!keys.length){
      sel.innerHTML = '<option value="">暂无可入库的柜子</option>';
      return;
    }
    sel.innerHTML = '<option value="">请选择柜号</option>' + keys.map(function(k){
      return '<option value="' + esc(k).replace(/"/g, "") + '">' + esc(k) + "（" + map[k] + "行）</option>";
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
  if(!cn){
    box.innerHTML = '<div style="color:#888;font-size:13px;">请先选择柜号</div>';
    return;
  }
  box.innerHTML = '<div style="color:#666;">加载中…</div>';
  try {
    var snap = await getDocs(query(collection(db, "in_transit"), limit(2000)));
    var rows = [];
    snap.forEach(function(d){
      var item = d.data();
      if(String(item.containerNo || "").trim() !== cn) return;
      var st = item.status || "在途";
      if(st === "已入库" || st === "取消") return;
      rows.push({ id: d.id, item: item });
    });
    rows.sort(function(a,b){
      return String(a.item.code||"").localeCompare(String(b.item.code||""), "zh-CN")
        || String(a.item.color||"").localeCompare(String(b.item.color||""), "zh-CN");
    });
    inboundCache = rows;
    if(!rows.length){
      box.innerHTML = '<div style="color:#b91c1c;">该柜没有待入库行（可能已入库）</div>';
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
    html += '<div style="margin-top:10px;font-size:12px;color:#64748b;">共 ' + rows.length + ' 行。规格自动规范成 600x1200。实入 = 数量 − 损坏。包装默认取箱单「牌子」。</div>';
    box.innerHTML = html;
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

  var summary = lines.map(function(l, idx){
    return (idx+1) + ". " + l.code + " 色号" + (l.color||"-") + " 实入 " + l.inboundQty +
      (l.dmgBox || l.dmgPc ? "（损箱"+l.dmgBox+" 损片"+l.dmgPc+"）" : "");
  }).join("\n");
  if(!confirm("确认整柜入库？\n柜号：" + cn + "\n仓库：" + wh + "\n共 " + lines.length + " 行\n\n" + summary)) return;

  var btn = $("btnInboundConfirm");
  if(btn){ btn.disabled = true; btn.textContent = "入库中…"; }
  var ok = 0, fail = [];
  try {
    for(var j = 0; j < lines.length; j++){
      var L = lines[j];
      try {
        var invId = L.code + "_" + L.color + "_" + wh;
        var ref = doc(db, "inventory", invId);
        var snap = await getDoc(ref);
        if(snap.exists()){
          var data = snap.data();
          var upd = {
            stock: Number((Number(data.stock || 0) + L.inboundQty).toFixed(4)),
            lastUpdate: serverTimestamp()
          };
          if(L.spec && !data.spec) upd.spec = L.spec;
          if(L.piecesPerBox != null && (data.piecesPerBox == null || data.piecesPerBox === "")) upd.piecesPerBox = L.piecesPerBox;
          if(L.boxWeight != null && (data.boxWeight == null || data.boxWeight === "")) upd.boxWeight = L.boxWeight;
          if(L.packaging && !data.packaging) upd.packaging = L.packaging;
          await updateDoc(ref, upd);
        } else {
          await setDoc(ref, {
            code: L.code,
            color: L.color,
            spec: L.spec || "",
            warehouse: wh,
            stock: L.inboundQty,
            piecesPerBox: L.piecesPerBox,
            boxWeight: L.boxWeight,
            packaging: L.packaging,
            reservedList: [],
            lastUpdate: serverTimestamp()
          });
        }
        await addDoc(collection(db, "logs"), {
          timestamp: serverTimestamp(),
          type: "入库",
          code: L.code,
          spec: L.spec || "",
          color: L.color,
          warehouse: wh,
          qty: L.inboundQty,
          customer: "柜号" + cn + (L.dmgBox || L.dmgPc ? (" 损箱"+L.dmgBox+"损片"+L.dmgPc) : "")
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
      } catch(err){
        console.error(err);
        fail.push(L.code + ": " + ((err && err.message) || err));
      }
    }
    var msg = "入库完成：成功 " + ok + " 行";
    if(fail.length) msg += "\n失败：\n" + fail.join("\n");
    alert(msg);
    inboundCache = [];
    if($("inbound_preview")) $("inbound_preview").innerHTML = "";
    window.loadInboundContainers();
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "确认整柜入库"; }
  }
};

function bindInboundUI(){
  var pairs = [
    ["btnInboundLoadContainers", function(){ window.loadInboundContainers(); }],
    ["btnInboundPreview", function(){ window.loadInboundPreview(); }],
    ["btnInboundConfirm", function(){ window.confirmInboundContainer(); }]
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
  };
  window.showTab.__inboundHooked = true;
  return true;
}

function boot(){
  bindInboundUI();
  var n = 0;
  var t = setInterval(function(){
    n++;
    if(hookShowTab() || n > 50) clearInterval(t);
  }, 200);
  setInterval(bindInboundUI, 2000);
  console.log("transit_inbound.js ready v20260814i");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
