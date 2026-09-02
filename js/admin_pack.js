/**
 * Pack fields: boxWeight / packaging. Labels follow tile_lang.
 * v20260902i
 */
import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, getDocs, query, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }
function packLang(){
  try {
    var v = localStorage.getItem("tile_lang");
    if (v === "en" || v === "th" || v === "zh") return v;
  } catch (e) {}
  if (window.I18N && I18N.getLang) return I18N.getLang();
  return "zh";
}
function L(zh, en, th){
  var l = packLang();
  if (l === "en") return en == null ? zh : en;
  if (l === "th") return th == null ? zh : th;
  return zh;
}

function ensureNewPackFields(){
  var ppb = $("new_piecesPerBox");
  if(!ppb) return;
  if($("new_boxWeight")) return;
  var wrap = document.createElement("div");
  wrap.id = "new_pack_fields";
  wrap.innerHTML =
    '<div style="margin-top:8px;">' + L("\u4e00\u7bb1\u591a\u91cdkg\uff08\u53ef\u7a7a\uff09", "Weight/box kg (optional)", "\u0e19\u0e49\u0e33\u0e2b\u0e19\u0e31\u0e01/\u0e01\u0e25\u0e48\u0e2d\u0e07 kg (\u0e27\u0e48\u0e32\u0e07\u0e44\u0e14\u0e49)") + '</div>' +
    '<input id="new_boxWeight" type="number" step="0.01">' +
    '<div style="margin-top:8px;">' + L("\u5305\u88c5\uff08\u53ef\u7a7a\uff09", "Packaging (optional)", "\u0e1a\u0e23\u0e23\u0e08\u0e38\u0e20\u0e31\u0e13\u0e11\u0e4c (\u0e27\u0e48\u0e32\u0e07\u0e44\u0e14\u0e49)") + '</div>' +
    '<input id="new_packaging" placeholder="' + L("\u5982\u7eb8\u7bb1", "e.g. carton", "\u0e40\u0e0a\u0e48\u0e19 \u0e01\u0e25\u0e48\u0e2d\u0e07") + '">';
  var next = ppb.nextSibling;
  while(next && next.nodeType === 3) next = next.nextSibling;
  if(next && next.parentNode === ppb.parentNode) ppb.parentNode.insertBefore(wrap, next);
  else ppb.parentNode.appendChild(wrap);
}

function injectEditPackFields(root){
  if(!root) return;
  root.querySelectorAll("[id^='edit_ppb_']").forEach(function(ppb){
    var id = ppb.id.replace("edit_ppb_", "");
    if($("edit_bw_" + id)) return;
    var btn = ppb.parentNode && ppb.parentNode.querySelector("button[onclick*='saveEdit']");
    var frag = document.createElement("span");
    frag.style.cssText = "display:contents";
    frag.innerHTML =
      '<span style="font-size:12px;color:#666;">' + L("\u4e00\u7bb1\u591a\u91cd(kg)", "kg/box", "\u0e01\u0e01./\u0e01\u0e25\u0e48\u0e2d\u0e07") + '</span>' +
      '<input id="edit_bw_' + id + '" type="number" step="0.01" style="width:70px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;">' +
      '<span style="font-size:12px;color:#666;">' + L("\u5305\u88c5", "Packaging", "\u0e1a\u0e23\u0e23\u0e08\u0e38\u0e20\u0e31\u0e13\u0e11\u0e4c") + '</span>' +
      '<input id="edit_pack_' + id + '" placeholder="' + L("\u5982\u7eb8\u7bb1", "e.g. carton", "\u0e40\u0e0a\u0e48\u0e19 \u0e01\u0e25\u0e48\u0e2d\u0e07") + '" style="width:80px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;">';
    if(btn) ppb.parentNode.insertBefore(frag, btn);
    else ppb.parentNode.appendChild(frag);
    getDoc(doc(db, "inventory", id)).then(function(snap){
      if(!snap.exists()) return;
      var d = snap.data();
      var bw = $("edit_bw_" + id);
      var pk = $("edit_pack_" + id);
      if(bw && d.boxWeight != null && d.boxWeight !== "") bw.value = d.boxWeight;
      if(pk && d.packaging) pk.value = d.packaging;
    }).catch(function(){});
  });
}

window.saveEdit = async function(id){
  try{
    var ref = doc(db, "inventory", id);
    var snap = await getDoc(ref);
    if(!snap.exists()) return alert("\u8bb0\u5f55\u4e0d\u5b58\u5728\uff0c\u8bf7\u91cd\u65b0\u641c\u7d22");
    var data = snap.data();
    var code = (($("edit_code_"+id)||{}).value || "").trim();
    var spec = (($("edit_spec_"+id)||{}).value || "").trim();
    var color = (($("edit_color_"+id)||{}).value || "").trim();
    var warehouse = (($("edit_wh_"+id)||{}).value || "").toString().trim().toLowerCase();
    var ppbRaw = (($("edit_ppb_"+id)||{}).value || "").trim();
    var piecesPerBox = ppbRaw === "" ? null : Number(ppbRaw);
    var bwRaw = (($("edit_bw_"+id)||{}).value || "").trim();
    var boxWeight = bwRaw === "" ? null : Number(bwRaw);
    var packaging = (($("edit_pack_"+id)||{}).value || "").trim() || null;
    if(!code) return alert("\u7f16\u53f7\u4e0d\u80fd\u4e3a\u7a7a");
    if(!warehouse) return alert("\u4ed3\u5e93\u4e0d\u80fd\u4e3a\u7a7a");
    if(ppbRaw !== "" && (!piecesPerBox || piecesPerBox <= 0)) return alert("\u6bcf\u7bb1\u7247\u6570\u4e0d\u6b63\u786e");
    if(bwRaw !== "" && (isNaN(boxWeight) || boxWeight <= 0)) return alert("\u4e00\u7bb1\u591a\u91cd\u4e0d\u6b63\u786e");
    var newId = code + "_" + color + "_" + warehouse;
    var same =
      String(data.code||"") === code &&
      String(data.spec||"") === spec &&
      String(data.color||"") === color &&
      String(data.warehouse||"").toLowerCase() === warehouse &&
      (data.piecesPerBox == null ? null : Number(data.piecesPerBox)) === piecesPerBox &&
      (data.boxWeight == null ? null : Number(data.boxWeight)) === boxWeight &&
      (data.packaging || null) === packaging;
    if(same) return alert("\u6ca1\u6709\u6539\u52a8");
    if(!confirm("\u786e\u8ba4\u4fee\u6539\uff1f\n\u539f\uff1a" + data.code + " / " + (data.spec||"-") + " / \u8272" + (data.color||"-") + " / " + data.warehouse +
      "\n\u65b0\uff1a" + code + " / " + (spec||"-") + " / \u8272" + (color||"-") + " / " + warehouse +
      "\n\u5e93\u5b58 " + data.stock + "\u3001\u7559\u8d27\u4f1a\u4e00\u8d77\u4fdd\u7559")) return;
    var payload = {
      code: code, spec: spec, color: color, warehouse: warehouse,
      piecesPerBox: piecesPerBox, boxWeight: boxWeight, packaging: packaging,
      stock: Number(data.stock || 0),
      reservedList: Array.isArray(data.reservedList) ? data.reservedList : [],
      lastUpdate: serverTimestamp()
    };
    if(data.hidden != null) payload.hidden = data.hidden;
    if(newId === id){
      await updateDoc(ref, {
        code: code, spec: spec, color: color, warehouse: warehouse,
        piecesPerBox: piecesPerBox, boxWeight: boxWeight, packaging: packaging,
        lastUpdate: serverTimestamp()
      });
    } else {
      var exist = await getDoc(doc(db, "inventory", newId));
      if(exist.exists()) return alert("\u76ee\u6807\u5df2\u5b58\u5728\uff1a" + newId + "\n\u8bf7\u5148\u5904\u7406\u90a3\u6761\u5e93\u5b58\uff0c\u907f\u514d\u91cd\u590d");
      await setDoc(doc(db, "inventory", newId), payload);
      await deleteDoc(ref);
    }
    await addDoc(collection(db, "logs"), {
      timestamp: serverTimestamp(), type: "\u4fee\u6539",
      code: code, spec: spec, color: color, warehouse: warehouse,
      qty: Number(data.stock || 0), note: "\u4fee\u6539\u5e93\u5b58\u4fe1\u606f"
    });
    alert("\u4fee\u6539\u6210\u529f");
    if($("in_search") && $("in_search").value.trim() && typeof window.searchIn === "function") window.searchIn();
  }catch(e){
    console.error(e);
    alert("\u4fee\u6539\u5931\u8d25\uff1a" + (e.message||e));
  }
};

window.addNewStock = async function(){
  try{
    var code = ($("new_code").value||"").trim();
    var color = ($("new_color").value||"").trim();
    var warehouse = ($("new_warehouse").value||"").toString().trim().toLowerCase();
    if(!code||!warehouse) return alert("\u8bf7\u586b\u5199\u7f16\u53f7\u548c\u4ed3\u5e93");
    var id = code + "_" + color + "_" + warehouse;
    await setDoc(doc(db,"inventory",id),{
      code: code, spec: $("new_spec").value, color: color, warehouse: warehouse,
      stock: Number($("new_qty").value)||0,
      piecesPerBox: $("new_piecesPerBox").value ? Number($("new_piecesPerBox").value) : null,
      boxWeight: $("new_boxWeight") && $("new_boxWeight").value ? Number($("new_boxWeight").value) : null,
      packaging: ($("new_packaging") && $("new_packaging").value || "").trim() || null,
      reservedList: [], lastUpdate: serverTimestamp()
    });
    alert("\u65b0\u589e\u6210\u529f");
  }catch(e){
    console.error(e);
    alert("\u65b0\u589e\u5931\u8d25\uff1a" + (e.message||e));
  }
};

function patchExport(){
  if(typeof window.exportInventory !== "function" || window.exportInventory.__packPatched) return;
  window.exportInventory = async function(){
    try{
      if(typeof XLSX === "undefined") return alert("XLSX \u672a\u52a0\u8f7d");
      var snap = await getDocs(query(collection(db,"inventory"), limit(5000)));
      var warehouseMap = {}, allRows = [];
      snap.forEach(function(d){
        var i = d.data();
        if(i.hidden) return;
        var reserved = 0;
        if(Array.isArray(i.reservedList)) i.reservedList.forEach(function(r){ if(r) reserved += Number(r.qty||r.quantity||0); });
        var row = {
          "\u7f16\u53f7": i.code||"", "\u89c4\u683c": i.spec||"", "\u8272\u53f7": i.color||"",
          "\u6570\u91cf": Number(i.stock||0), "\u6240\u5728\u4ed3\u5e93": i.warehouse||"", "\u7559\u8d27": reserved,
          "\u6bcf\u7bb1\u7247\u6570": i.piecesPerBox||"", "\u4e00\u7bb1\u591a\u91cd": i.boxWeight||"", "\u5305\u88c5": i.packaging||""
        };
        var w = (i.warehouse||"\u672a\u5206\u7c7b").toString().replace(/[\\\/\?\*\[\]\:]/g,"_").trim().substring(0,31)||"\u672a\u5206\u7c7b";
        if(!warehouseMap[w]) warehouseMap[w]=[];
        warehouseMap[w].push(row);
        allRows.push(row);
      });
      if(!Object.keys(warehouseMap).length) return alert("\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u6570\u636e");
      var wb = XLSX.utils.book_new();
      for(var w in warehouseMap) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(warehouseMap[w]), w);
      allRows.sort(function(a,b){
        var s = String(a["\u89c4\u683c"]||"").localeCompare(String(b["\u89c4\u683c"]||""),"zh-CN"); if(s) return s;
        var q = Number(a["\u6570\u91cf"]||0)-Number(b["\u6570\u91cf"]||0); if(q) return q;
        return String(a["\u7f16\u53f7"]||"").localeCompare(String(b["\u7f16\u53f7"]||""),"zh-CN");
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allRows), "\u5168\u90e8\u6392\u5e8f");
      XLSX.writeFile(wb, "\u5f53\u524d\u5e93\u5b58_" + new Date().toISOString().split("T")[0] + ".xlsx");
      alert("\u5bfc\u51fa\u6210\u529f\uff01");
    }catch(err){ alert("\u5bfc\u51fa\u5931\u8d25\uff1a" + (err.message||err)); }
  };
  window.exportInventory.__packPatched = true;
}

function patchImport(){
  if(typeof window.handleImport !== "function" || window.handleImport.__packPatched) return;
  window.handleImport = async function(){
    try{
      if(typeof XLSX === "undefined") return alert("XLSX \u672a\u52a0\u8f7d");
      var fileEl = $("excelFile");
      if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("\u8bf7\u9009\u62e9 Excel");
      var wb = XLSX.read(await fileEl.files[0].arrayBuffer(), { type: "array" });
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      var ok = 0, skip = 0;
      for(var i = 0; i < rows.length; i++){
        var row = rows[i];
        var safeCode = (row["\u7f16\u53f7"]||row["\u578b\u53f7"]||row["code"]||"").toString().trim();
        if(!safeCode){ skip++; continue; }
        var safeColor = (row["\u8272\u53f7"]||row["color"]||"").toString().trim();
        var safeWarehouse = (row["\u6240\u5728\u4ed3\u5e93"]||row["\u4ed3\u5e93"]||row["warehouse"]||"").toString().trim().toLowerCase();
        if(!safeWarehouse){ skip++; continue; }
        var bwRaw = row["\u4e00\u7bb1\u591a\u91cd"]||row["\u7bb1\u91cd"]||row["\u4e00\u7bb1\u91cd\u91cf"]||"";
        var packRaw = (row["\u5305\u88c5"]||"").toString().trim();
        try{
          await setDoc(doc(db,"inventory", safeCode+"_"+safeColor+"_"+safeWarehouse), {
            code: safeCode, spec: (row["\u89c4\u683c"]||"").toString(), color: safeColor, warehouse: safeWarehouse,
            stock: Number(row["\u6570\u91cf"])||0,
            piecesPerBox: row["\u6bcf\u7bb1\u7247\u6570"] ? Number(row["\u6bcf\u7bb1\u7247\u6570"]) : null,
            boxWeight: bwRaw !== "" && bwRaw != null ? Number(bwRaw) : null,
            packaging: packRaw || null, reservedList: [], lastUpdate: serverTimestamp()
          });
          ok++;
        }catch(e){ console.error(e); skip++; }
      }
      alert("\u5bfc\u5165\u5b8c\u6210\uff1a\u6210\u529f "+ok+" \u6761"+(skip?"\uff0c\u8df3\u8fc7 "+skip+" \u6761":""));
      fileEl.value = "";
    }catch(err){ alert("\u5bfc\u5165\u5931\u8d25\uff1a"+(err.message||err)); }
  };
  window.handleImport.__packPatched = true;
}

function watchInResult(){
  var box = $("in_result");
  if(!box || box.__packObs) return;
  box.__packObs = true;
  var obs = new MutationObserver(function(){ injectEditPackFields(box); });
  obs.observe(box, { childList: true, subtree: true });
}
function boot(){
  ensureNewPackFields(); watchInResult(); patchExport(); patchImport();
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
var tries = 0;
var timer = setInterval(function(){
  tries++;
  ensureNewPackFields(); watchInResult(); patchExport(); patchImport();
  if(($("new_boxWeight") && $("new_piecesPerBox")) || tries > 30) clearInterval(timer);
}, 500);
console.log("admin_pack.js ready v20260902i");
