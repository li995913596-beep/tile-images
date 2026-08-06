/**
 * 包装信息扩展：一箱多重(boxWeight)、包装(packaging)
 * 在 CDN admin 加载后强制往「新增」表单和「编辑」面板注入字段
 */
import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, getDocs, query, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

/** 新增表单：在「每箱片数」后面插入「一箱多重 / 包装」 */
function ensureNewPackFields(){
  var ppb = $("new_piecesPerBox");
  if(!ppb) return;
  if($("new_boxWeight")) return;

  var wrap = document.createElement("div");
  wrap.id = "new_pack_fields";
  wrap.innerHTML =
    '<div style="margin-top:8px;">一箱多重kg（可空）</div>' +
    '<input id="new_boxWeight" type="number" step="0.01">' +
    '<div style="margin-top:8px;">包装（可空）</div>' +
    '<input id="new_packaging" placeholder="如纸箱">';

  var next = ppb.nextSibling;
  while(next && next.nodeType === 3) next = next.nextSibling;
  if(next && next.parentNode === ppb.parentNode){
    ppb.parentNode.insertBefore(wrap, next);
  } else {
    ppb.parentNode.appendChild(wrap);
  }
  console.log("admin_pack: 已注入新增表单 一箱多重/包装");
}

/** 编辑面板：在每箱片数后注入 */
function injectEditPackFields(root){
  if(!root) return;
  root.querySelectorAll("[id^='edit_ppb_']").forEach(function(ppb){
    var id = ppb.id.replace("edit_ppb_", "");
    if($("edit_bw_" + id)) return;
    var btn = ppb.parentNode && ppb.parentNode.querySelector("button[onclick*='saveEdit']");
    var frag = document.createElement("span");
    frag.style.cssText = "display:contents";
    frag.innerHTML =
      '<span style="font-size:12px;color:#666;">一箱多重(kg)</span>' +
      '<input id="edit_bw_' + id + '" type="number" step="0.01" style="width:70px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;">' +
      '<span style="font-size:12px;color:#666;">包装</span>' +
      '<input id="edit_pack_' + id + '" placeholder="如纸箱" style="width:80px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;">';
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
    if(!snap.exists()) return alert("记录不存在，请重新搜索");
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
    if(!code) return alert("编号不能为空");
    if(!warehouse) return alert("仓库不能为空");
    if(ppbRaw !== "" && (!piecesPerBox || piecesPerBox <= 0)) return alert("每箱片数不正确");
    if(bwRaw !== "" && (isNaN(boxWeight) || boxWeight <= 0)) return alert("一箱多重不正确");

    var newId = code + "_" + color + "_" + warehouse;
    var same =
      String(data.code||"") === code &&
      String(data.spec||"") === spec &&
      String(data.color||"") === color &&
      String(data.warehouse||"").toLowerCase() === warehouse &&
      (data.piecesPerBox == null ? null : Number(data.piecesPerBox)) === piecesPerBox &&
      (data.boxWeight == null ? null : Number(data.boxWeight)) === boxWeight &&
      (data.packaging || null) === packaging;
    if(same) return alert("没有改动");

    if(!confirm("确认修改？\n原：" + data.code + " / " + (data.spec||"-") + " / 色" + (data.color||"-") + " / " + data.warehouse +
      "\n新：" + code + " / " + (spec||"-") + " / 色" + (color||"-") + " / " + warehouse +
      "\n库存 " + data.stock + "、留货会一起保留")) return;

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
      if(exist.exists()) return alert("目标已存在：" + newId + "\n请先处理那条库存，避免重复");
      await setDoc(doc(db, "inventory", newId), payload);
      await deleteDoc(ref);
    }

    await addDoc(collection(db, "logs"), {
      timestamp: serverTimestamp(),
      type: "修改",
      code: code, spec: spec, color: color, warehouse: warehouse,
      qty: Number(data.stock || 0),
      note: "修改库存信息"
    });
    alert("修改成功");
    if($("in_search") && $("in_search").value.trim() && typeof window.searchIn === "function") window.searchIn();
  }catch(e){
    console.error(e);
    alert("修改失败：" + (e.message||e));
  }
};

window.addNewStock = async function(){
  try{
    var code = ($("new_code").value||"").trim();
    var color = ($("new_color").value||"").trim();
    var warehouse = ($("new_warehouse").value||"").toString().trim().toLowerCase();
    if(!code||!warehouse) return alert("请填写编号和仓库");
    var id = code + "_" + color + "_" + warehouse;
    await setDoc(doc(db,"inventory",id),{
      code: code,
      spec: $("new_spec").value,
      color: color,
      warehouse: warehouse,
      stock: Number($("new_qty").value)||0,
      piecesPerBox: $("new_piecesPerBox").value ? Number($("new_piecesPerBox").value) : null,
      boxWeight: $("new_boxWeight") && $("new_boxWeight").value ? Number($("new_boxWeight").value) : null,
      packaging: ($("new_packaging") && $("new_packaging").value || "").trim() || null,
      reservedList: [],
      lastUpdate: serverTimestamp()
    });
    alert("新增成功");
  }catch(e){
    console.error(e);
    alert("新增失败：" + (e.message||e));
  }
};

function patchExport(){
  if(typeof window.exportInventory !== "function") return;
  if(window.exportInventory.__packPatched) return;
  window.exportInventory = async function(){
    try{
      if(typeof XLSX === "undefined") return alert("XLSX 未加载");
      var snap = await getDocs(query(collection(db,"inventory"), limit(5000)));
      var warehouseMap = {}, allRows = [];
      snap.forEach(function(d){
        var i = d.data();
        if(i.hidden) return;
        var reserved = 0;
        if(Array.isArray(i.reservedList)) i.reservedList.forEach(function(r){ if(r) reserved += Number(r.qty||r.quantity||0); });
        var row = {
          "编号": i.code||"", "规格": i.spec||"", "色号": i.color||"",
          "数量": Number(i.stock||0), "所在仓库": i.warehouse||"", "留货": reserved,
          "每箱片数": i.piecesPerBox||"", "一箱多重": i.boxWeight||"", "包装": i.packaging||""
        };
        var w = (i.warehouse||"未分类").toString().replace(/[\\\/\?\*\[\]\:]/g,"_").trim().substring(0,31)||"未分类";
        if(!warehouseMap[w]) warehouseMap[w]=[];
        warehouseMap[w].push(row);
        allRows.push(row);
      });
      if(!Object.keys(warehouseMap).length) return alert("没有可导出的数据");
      var wb = XLSX.utils.book_new();
      for(var w in warehouseMap) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(warehouseMap[w]), w);
      allRows.sort(function(a,b){
        var s = String(a["规格"]||"").localeCompare(String(b["规格"]||""),"zh-CN"); if(s) return s;
        var q = Number(a["数量"]||0)-Number(b["数量"]||0); if(q) return q;
        return String(a["编号"]||"").localeCompare(String(b["编号"]||""),"zh-CN");
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allRows), "全部排序");
      XLSX.writeFile(wb, "当前库存_" + new Date().toISOString().split("T")[0] + ".xlsx");
      alert("导出成功！");
    }catch(err){ alert("导出失败：" + (err.message||err)); }
  };
  window.exportInventory.__packPatched = true;
}

function patchImport(){
  if(typeof window.handleImport !== "function") return;
  if(window.handleImport.__packPatched) return;
  window.handleImport = async function(){
    try{
      if(typeof XLSX === "undefined") return alert("XLSX 未加载");
      var fileEl = $("excelFile");
      if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("请选择 Excel");
      var wb = XLSX.read(await fileEl.files[0].arrayBuffer(), { type: "array" });
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      var ok = 0, skip = 0;
      for(var i = 0; i < rows.length; i++){
        var row = rows[i];
        var safeCode = (row["编号"]||row["型号"]||row["code"]||"").toString().trim();
        if(!safeCode){ skip++; continue; }
        var safeColor = (row["色号"]||row["color"]||"").toString().trim();
        var safeWarehouse = (row["所在仓库"]||row["仓库"]||row["warehouse"]||"").toString().trim().toLowerCase();
        if(!safeWarehouse){ skip++; continue; }
        var bwRaw = row["一箱多重"]||row["箱重"]||row["一箱重量"]||"";
        var packRaw = (row["包装"]||"").toString().trim();
        try{
          await setDoc(doc(db,"inventory", safeCode+"_"+safeColor+"_"+safeWarehouse), {
            code: safeCode,
            spec: (row["规格"]||"").toString(),
            color: safeColor,
            warehouse: safeWarehouse,
            stock: Number(row["数量"])||0,
            piecesPerBox: row["每箱片数"] ? Number(row["每箱片数"]) : null,
            boxWeight: bwRaw !== "" && bwRaw != null ? Number(bwRaw) : null,
            packaging: packRaw || null,
            reservedList: [],
            lastUpdate: serverTimestamp()
          });
          ok++;
        }catch(e){ console.error(e); skip++; }
      }
      alert("导入完成：成功 "+ok+" 条"+(skip?"，跳过 "+skip+" 条":""));
      fileEl.value = "";
    }catch(err){ alert("导入失败："+(err.message||err)); }
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
  ensureNewPackFields();
  watchInResult();
  patchExport();
  patchImport();
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

var tries = 0;
var timer = setInterval(function(){
  tries++;
  ensureNewPackFields();
  watchInResult();
  patchExport();
  patchImport();
  if(($("new_boxWeight") && $("new_piecesPerBox")) || tries > 30) clearInterval(timer);
}, 500);

console.log("admin_pack.js ready v20260806b");
