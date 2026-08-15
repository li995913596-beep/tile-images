/**
 * 纸箱库存：前台 boxes.html + 后台 tab_boxes
 * 品牌可扩展；按 品牌/规格/仓库 存数量；前后台均可出入库
 */
import { db } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, query, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

/** 后续新品牌只加这里 */
var BOX_BRANDS = ["蒙娜丽莎", "欧神诺"];

function esc(s){ return String(s == null ? "" : s); }

function normWh(w){
  return String(w || "").trim().toLowerCase().replace(/[\/\\ ]+/g, "_");
}

function boxDocId(brand, spec, warehouse){
  var b = String(brand || "").trim();
  var s = String(spec || "").trim().replace(/[\/\\]/g, "_");
  var w = normWh(warehouse);
  return (b + "__" + s + "__" + w).slice(0, 700);
}

async function writeBoxLog(type, brand, spec, warehouse, qty, note){
  try {
    await addDoc(collection(db, "logs"), {
      timestamp: serverTimestamp(),
      type: type,
      code: brand,
      spec: spec || "",
      color: "",
      warehouse: warehouse || "",
      qty: Number(qty) || 0,
      customer: note || "纸箱",
      source: "纸箱"
    });
  } catch(e){ console.warn("纸箱日志写入失败", e); }
}

async function loadAllBoxes(){
  var snap = await getDocs(query(collection(db, "boxes"), limit(2000)));
  var list = [];
  snap.forEach(function(d){
    var x = d.data() || {};
    list.push({
      id: d.id,
      brand: x.brand || "",
      spec: x.spec || "",
      warehouse: x.warehouse || "",
      qty: Number(x.qty || 0)
    });
  });
  list.sort(function(a, b){
    return String(a.brand).localeCompare(String(b.brand), "zh-CN")
      || String(a.spec).localeCompare(String(b.spec), "zh-CN")
      || String(a.warehouse).localeCompare(String(b.warehouse), "zh-CN");
  });
  return list;
}

function groupByBrand(list){
  var map = {};
  (list || []).forEach(function(it){
    var b = it.brand || "未分类";
    if(!map[b]) map[b] = [];
    map[b].push(it);
  });
  return map;
}

function brandOptionsHtml(selected){
  return BOX_BRANDS.map(function(b){
    return '<option value="' + esc(b) + '"' + (b === selected ? " selected" : "") + ">" + esc(b) + "</option>";
  }).join("") + '<option value="__custom__">其他（手填）</option>';
}

function renderBoxList(list, hostId){
  var host = $(hostId);
  if(!host) return;
  if(!list.length){
    host.innerHTML = '<div style="padding:14px;color:#94a3b8;font-size:14px;">暂无纸箱记录，请先在后台或下方「新增」录入。</div>';
    return;
  }
  var grouped = groupByBrand(list);
  var brands = Object.keys(grouped).sort(function(a,b){ return a.localeCompare(b, "zh-CN"); });
  var html = "";
  brands.forEach(function(brand){
    html += '<div style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;">';
    html += '<div style="padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;">📦 ' + esc(brand) +
      ' <span style="font-weight:500;color:#64748b;font-size:12px;">（' + grouped[brand].length + ' 种）</span></div>';
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:520px;">';
    html += '<thead><tr style="background:#fafafa;text-align:left;color:#64748b;">' +
      '<th style="padding:8px 12px;">规格</th>' +
      '<th style="padding:8px 12px;">仓库</th>' +
      '<th style="padding:8px 12px;">数量</th>' +
      '<th style="padding:8px 12px;">操作</th>' +
      '</tr></thead><tbody>';
    grouped[brand].forEach(function(it){
      var qtyColor = it.qty > 0 ? "#16a34a" : "#b91c1c";
      html += '<tr style="border-top:1px solid #f1f5f9;" data-box-id="' + esc(it.id) + '">' +
        '<td style="padding:10px 12px;font-weight:600;">' + esc(it.spec || "-") + '</td>' +
        '<td style="padding:10px 12px;"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#eef3f8;color:#334155;font-size:12px;">' + esc(it.warehouse || "-") + '</span></td>' +
        '<td style="padding:10px 12px;"><b style="color:' + qtyColor + ';font-size:16px;">' + it.qty + '</b></td>' +
        '<td style="padding:10px 12px;white-space:nowrap;">' +
          '<button type="button" data-box-in="' + esc(it.id) + '" style="padding:5px 10px;margin-right:6px;border:none;border-radius:6px;background:#16a34a;color:#fff;cursor:pointer;font-size:12px;">入库</button>' +
          '<button type="button" data-box-out="' + esc(it.id) + '" style="padding:5px 10px;margin-right:6px;border:none;border-radius:6px;background:#ea580c;color:#fff;cursor:pointer;font-size:12px;">出库</button>' +
          '<button type="button" data-box-del="' + esc(it.id) + '" style="padding:5px 10px;border:1px solid #fecaca;border-radius:6px;background:#fff;color:#b91c1c;cursor:pointer;font-size:12px;">删除</button>' +
        '</td></tr>';
    });
    html += '</tbody></table></div></div>';
  });
  host.innerHTML = html;

  host.querySelectorAll("[data-box-in]").forEach(function(btn){
    btn.onclick = function(){ window.boxAdjust(btn.getAttribute("data-box-in"), "in"); };
  });
  host.querySelectorAll("[data-box-out]").forEach(function(btn){
    btn.onclick = function(){ window.boxAdjust(btn.getAttribute("data-box-out"), "out"); };
  });
  host.querySelectorAll("[data-box-del]").forEach(function(btn){
    btn.onclick = function(){ window.boxDelete(btn.getAttribute("data-box-del")); };
  });
}

window.reloadBoxes = async function(){
  var hosts = ["boxesFrontList", "boxesAdminList"];
  hosts.forEach(function(id){
    var el = $(id);
    if(el) el.innerHTML = '<div style="padding:12px;color:#666;">加载中…</div>';
  });
  try {
    var list = await loadAllBoxes();
    if($("boxesFrontList")) renderBoxList(list, "boxesFrontList");
    if($("boxesAdminList")) renderBoxList(list, "boxesAdminList");
  } catch(e){
    console.error(e);
    hosts.forEach(function(id){
      var el = $(id);
      if(el) el.innerHTML = '<div style="padding:12px;color:#b91c1c;">加载失败</div>';
    });
  }
};

window.boxAdjust = async function(id, dir){
  if(!id) return;
  var label = dir === "in" ? "入库" : "出库";
  var raw = prompt(label + "数量：");
  if(raw == null) return;
  var n = Number(raw);
  if(!n || n <= 0) return alert("请输入大于 0 的数量");
  try {
    var ref = doc(db, "boxes", id);
    var snap = await getDoc(ref);
    if(!snap.exists()) return alert("记录不存在，请刷新");
    var data = snap.data() || {};
    var cur = Number(data.qty || 0);
    var next = dir === "in" ? cur + n : cur - n;
    if(next < 0) return alert("库存不足，当前仅 " + cur);
    await updateDoc(ref, { qty: next, lastUpdate: serverTimestamp() });
    await writeBoxLog(dir === "in" ? "纸箱入库" : "纸箱出库", data.brand, data.spec, data.warehouse, n, "");
    alert(label + "成功，当前数量 " + next);
    window.reloadBoxes();
  } catch(e){
    console.error(e);
    alert(label + "失败：" + ((e && e.message) || e));
  }
};

window.boxDelete = async function(id){
  if(!id) return;
  if(!confirm("确定删除这条纸箱记录？")) return;
  try {
    var ref = doc(db, "boxes", id);
    var snap = await getDoc(ref);
    var data = snap.exists() ? (snap.data() || {}) : {};
    await deleteDoc(ref);
    await writeBoxLog("纸箱删除", data.brand || "", data.spec || "", data.warehouse || "", data.qty || 0, "删除记录");
    alert("已删除");
    window.reloadBoxes();
  } catch(e){
    console.error(e);
    alert("删除失败");
  }
};

window.boxAdd = async function(prefix){
  prefix = prefix || "bx";
  var brandSel = $(prefix + "_brand");
  var brandCustom = $(prefix + "_brand_custom");
  var specEl = $(prefix + "_spec");
  var whEl = $(prefix + "_warehouse");
  var qtyEl = $(prefix + "_qty");
  var brand = (brandSel && brandSel.value) || "";
  if(brand === "__custom__"){
    brand = (brandCustom && brandCustom.value || "").trim();
  }
  brand = String(brand || "").trim();
  var spec = (specEl && specEl.value || "").trim();
  var warehouse = normWh(whEl && whEl.value);
  var qty = Number(qtyEl && qtyEl.value);
  if(!brand) return alert("请选择或填写品牌");
  if(!spec) return alert("请填写规格");
  if(!warehouse) return alert("请填写仓库");
  if(isNaN(qty) || qty < 0) return alert("数量不能为负");
  if(BOX_BRANDS.indexOf(brand) < 0) BOX_BRANDS.push(brand);

  var id = boxDocId(brand, spec, warehouse);
  try {
    var ref = doc(db, "boxes", id);
    var snap = await getDoc(ref);
    if(snap.exists()){
      var cur = Number((snap.data() || {}).qty || 0);
      var next = cur + (qty || 0);
      await updateDoc(ref, {
        brand: brand, spec: spec, warehouse: warehouse,
        qty: next, lastUpdate: serverTimestamp()
      });
      if(qty > 0) await writeBoxLog("纸箱入库", brand, spec, warehouse, qty, "新增合并");
      alert("该规格已存在，已合并数量，当前 " + next);
    } else {
      await setDoc(ref, {
        brand: brand, spec: spec, warehouse: warehouse,
        qty: qty || 0, lastUpdate: serverTimestamp()
      });
      if(qty > 0) await writeBoxLog("纸箱入库", brand, spec, warehouse, qty, "新建");
      alert("已新增");
    }
    if(specEl) specEl.value = "";
    if(qtyEl) qtyEl.value = "";
    window.reloadBoxes();
  } catch(e){
    console.error(e);
    alert("保存失败：" + ((e && e.message) || e));
  }
};

function bindBrandCustomToggle(prefix){
  var sel = $(prefix + "_brand");
  var custom = $(prefix + "_brand_custom");
  if(!sel || !custom) return;
  function sync(){
    custom.style.display = sel.value === "__custom__" ? "inline-block" : "none";
  }
  sel.onchange = sync;
  sync();
}

function formHtml(prefix){
  return (
    '<div style="padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:14px;">' +
      '<div style="font-weight:600;margin-bottom:10px;color:#1f2937;">新增 / 合并录入</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
        '<select id="' + prefix + '_brand" style="padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;">' + brandOptionsHtml(BOX_BRANDS[0]) + '</select>' +
        '<input id="' + prefix + '_brand_custom" placeholder="其他品牌名" style="display:none;padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;min-width:120px;">' +
        '<input id="' + prefix + '_spec" placeholder="规格*" style="padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;min-width:120px;">' +
        '<input id="' + prefix + '_warehouse" placeholder="仓库* 如 k38" style="padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;width:110px;">' +
        '<input id="' + prefix + '_qty" type="number" min="0" step="1" placeholder="数量" style="padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;width:90px;">' +
        '<button type="button" id="' + prefix + '_add_btn" style="padding:7px 16px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;font-weight:600;">保存</button>' +
        '<button type="button" id="' + prefix + '_reload_btn" style="padding:7px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;cursor:pointer;">刷新</button>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:12px;color:#64748b;">同一品牌+规格+仓库会自动合并数量。新品牌选「其他」手填即可。</div>' +
    '</div>'
  );
}

function buildFrontUI(){
  var root = $("boxesFrontRoot");
  if(!root) return;
  if(root.dataset.built === "1") return;
  root.dataset.built = "1";
  root.innerHTML =
    '<p style="font-size:13px;color:#666;margin:0 0 12px;line-height:1.5;">按品牌查看纸箱数量。支持入库 / 出库（不扣瓷砖库存）。</p>' +
    formHtml("bxf") +
    '<div id="boxesFrontList"></div>';
  bindBrandCustomToggle("bxf");
  var addBtn = $("bxf_add_btn");
  if(addBtn) addBtn.onclick = function(){ window.boxAdd("bxf"); };
  var reloadBtn = $("bxf_reload_btn");
  if(reloadBtn) reloadBtn.onclick = function(){ window.reloadBoxes(); };
  window.reloadBoxes();
}

function buildAdminUI(){
  var tab = $("tab_boxes");
  if(!tab) return;
  if(tab.dataset.built === "1" && tab.querySelector("#boxesAdminList")) return;
  tab.dataset.built = "1";
  tab.innerHTML =
    '<h3 style="margin:0 0 10px;font-size:16px;color:#1f2937;">📦 纸箱库存</h3>' +
    '<p style="font-size:13px;color:#666;margin:0 0 12px;">品牌默认：蒙娜丽莎、欧神诺，可继续增加。前台 📦 入口同步可查可出入库。</p>' +
    formHtml("bxa") +
    '<div id="boxesAdminList"></div>';
  bindBrandCustomToggle("bxa");
  var addBtn = $("bxa_add_btn");
  if(addBtn) addBtn.onclick = function(){ window.boxAdd("bxa"); };
  var reloadBtn = $("bxa_reload_btn");
  if(reloadBtn) reloadBtn.onclick = function(){ window.reloadBoxes(); };
}

function hookShowTab(){
  if(typeof window.showTab !== "function") return false;
  if(window.showTab.__boxesHooked) return true;
  var orig = window.showTab;
  window.showTab = function(name){
    orig.apply(this, arguments);
    if(name === "boxes"){
      buildAdminUI();
      window.reloadBoxes();
    }
  };
  window.showTab.__boxesHooked = true;
  return true;
}

function boot(){
  buildFrontUI();
  hookShowTab();
  var n = 0;
  var t = setInterval(function(){
    n++;
    hookShowTab();
    if($("tab_boxes") && $("tab_boxes").style.display === "block"){
      buildAdminUI();
    }
    if(n > 60) clearInterval(t);
  }, 300);
  console.log("boxes.js ready v20260815j");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
