/**
 * 纸箱库存：顶部 📦 进入；可查看；编辑需口令（默认 8888，后台可改）
 */
import { db } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, query, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

var BOX_BRANDS = ["蒙娜丽莎", "欧神诺"];
var DEFAULT_PIN = "8888";
var PIN_SESSION_KEY = "tile_boxes_edit_ok";
var cachedPin = null;

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

function isEditUnlocked(){
  try { return sessionStorage.getItem(PIN_SESSION_KEY) === "1"; } catch(e){ return false; }
}

function setEditUnlocked(ok){
  try {
    if(ok) sessionStorage.setItem(PIN_SESSION_KEY, "1");
    else sessionStorage.removeItem(PIN_SESSION_KEY);
  } catch(e){}
}

async function getBoxPin(){
  if(cachedPin) return cachedPin;
  try {
    var snap = await getDoc(doc(db, "settings", "boxes"));
    if(snap.exists()){
      var p = String((snap.data() || {}).pin || "").trim();
      if(p){ cachedPin = p; return cachedPin; }
    }
  } catch(e){ console.warn("读取纸箱口令失败，用默认", e); }
  cachedPin = DEFAULT_PIN;
  return cachedPin;
}

async function requireEditAuth(){
  if(isEditUnlocked()) return true;
  var pin = await getBoxPin();
  var input = prompt("编辑纸箱需要口令：");
  if(input == null) return false;
  if(String(input).trim() !== pin){
    alert("口令错误");
    return false;
  }
  setEditUnlocked(true);
  updateEditLockUI();
  return true;
}

function askOperator(actionLabel){
  var name = prompt((actionLabel || "操作") + " — 请填写操作人：");
  if(name == null) return null;
  name = String(name).trim();
  if(!name){
    alert("必须填写操作人");
    return null;
  }
  return name;
}

async function writeBoxLog(type, brand, spec, warehouse, qty, operator, note){
  try {
    await addDoc(collection(db, "logs"), {
      timestamp: serverTimestamp(),
      type: type,
      code: brand,
      spec: spec || "",
      color: "",
      warehouse: warehouse || "",
      qty: Number(qty) || 0,
      customer: operator || "",
      source: "纸箱",
      operator: operator || "",
      note: note || ""
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
    host.innerHTML = '<div style="padding:14px;color:#94a3b8;font-size:14px;">暂无纸箱记录。</div>';
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
      html += '<tr style="border-top:1px solid #f1f5f9;">' +
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
  if(!(await requireEditAuth())) return;
  var label = dir === "in" ? "入库" : "出库";
  var operator = askOperator(label);
  if(!operator) return;
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
    await writeBoxLog(dir === "in" ? "纸箱入库" : "纸箱出库", data.brand, data.spec, data.warehouse, n, operator, "");
    alert(label + "成功\n操作人：" + operator + "\n当前数量：" + next);
    window.reloadBoxes();
  } catch(e){
    console.error(e);
    alert(label + "失败：" + ((e && e.message) || e));
  }
};

window.boxDelete = async function(id){
  if(!id) return;
  if(!(await requireEditAuth())) return;
  var operator = askOperator("删除");
  if(!operator) return;
  if(!confirm("确定删除这条纸箱记录？")) return;
  try {
    var ref = doc(db, "boxes", id);
    var snap = await getDoc(ref);
    var data = snap.exists() ? (snap.data() || {}) : {};
    await deleteDoc(ref);
    await writeBoxLog("纸箱删除", data.brand || "", data.spec || "", data.warehouse || "", data.qty || 0, operator, "删除记录");
    alert("已删除");
    window.reloadBoxes();
  } catch(e){
    console.error(e);
    alert("删除失败");
  }
};

window.boxAdd = async function(prefix){
  prefix = prefix || "bx";
  if(!(await requireEditAuth())) return;
  var brandSel = $(prefix + "_brand");
  var brandCustom = $(prefix + "_brand_custom");
  var specEl = $(prefix + "_spec");
  var whEl = $(prefix + "_warehouse");
  var qtyEl = $(prefix + "_qty");
  var brand = (brandSel && brandSel.value) || "";
  if(brand === "__custom__") brand = (brandCustom && brandCustom.value || "").trim();
  brand = String(brand || "").trim();
  var spec = (specEl && specEl.value || "").trim();
  var warehouse = normWh(whEl && whEl.value);
  var qty = Number(qtyEl && qtyEl.value);
  if(!brand) return alert("请选择或填写品牌");
  if(!spec) return alert("请填写规格");
  if(!warehouse) return alert("请填写仓库");
  if(isNaN(qty) || qty < 0) return alert("数量不能为负");
  var operator = askOperator("录入");
  if(!operator) return;
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
      if(qty > 0) await writeBoxLog("纸箱入库", brand, spec, warehouse, qty, operator, "新增合并");
      alert("已合并数量，当前 " + next + "\n操作人：" + operator);
    } else {
      await setDoc(ref, {
        brand: brand, spec: spec, warehouse: warehouse,
        qty: qty || 0, lastUpdate: serverTimestamp()
      });
      if(qty > 0) await writeBoxLog("纸箱入库", brand, spec, warehouse, qty, operator, "新建");
      alert("已新增\n操作人：" + operator);
    }
    if(specEl) specEl.value = "";
    if(qtyEl) qtyEl.value = "";
    window.reloadBoxes();
  } catch(e){
    console.error(e);
    alert("保存失败：" + ((e && e.message) || e));
  }
};

window.boxSavePin = async function(){
  var el = $("boxes_pin_new");
  var p = (el && el.value || "").trim();
  if(!p) return alert("请输入新口令");
  if(p.length < 4) return alert("口令至少 4 位");
  try {
    await setDoc(doc(db, "settings", "boxes"), {
      pin: p,
      updatedAt: serverTimestamp()
    }, { merge: true });
    cachedPin = p;
    if(el) el.value = "";
    alert("纸箱编辑口令已更新");
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
      '<div style="margin-top:8px;font-size:12px;color:#64748b;">编辑需口令；出入库需填操作人并记日志。</div>' +
    '</div>'
  );
}

function updateEditLockUI(){
  var tip = $("boxes_edit_tip");
  var btn = $("boxes_lock_btn");
  if(isEditUnlocked()){
    if(tip) tip.textContent = "已解锁编辑（本会话）";
    if(btn){ btn.style.display = "inline-block"; btn.textContent = "锁定编辑"; }
  } else {
    if(tip) tip.textContent = "可查看；入库/出库/新增需口令";
    if(btn) btn.style.display = "none";
  }
}

function buildFrontUI(){
  var root = $("boxesFrontRoot");
  if(!root) return;
  if(root.dataset.built === "1") return;
  root.dataset.built = "1";
  root.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;">' +
      '<div style="flex:1;">' +
        '<h2 style="margin:0 0 4px;font-size:18px;color:#1f2937;">纸箱库存</h2>' +
        '<div id="boxes_edit_tip" style="font-size:13px;color:#64748b;">可查看；入库/出库/新增需口令</div>' +
      '</div>' +
      '<button type="button" id="boxes_unlock_btn" style="padding:7px 12px;border:none;border-radius:8px;background:#0f766e;color:#fff;cursor:pointer;font-size:13px;font-weight:600;">解锁编辑</button>' +
      '<button type="button" id="boxes_lock_btn" style="display:none;padding:7px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#64748b;cursor:pointer;font-size:13px;">锁定编辑</button>' +
    '</div>' +
    formHtml("bxf") +
    '<div id="boxesFrontList"></div>';
  bindBrandCustomToggle("bxf");
  var addBtn = $("bxf_add_btn");
  if(addBtn) addBtn.onclick = function(){ window.boxAdd("bxf"); };
  var reloadBtn = $("bxf_reload_btn");
  if(reloadBtn) reloadBtn.onclick = function(){ window.reloadBoxes(); };
  var unlockBtn = $("boxes_unlock_btn");
  if(unlockBtn) unlockBtn.onclick = async function(){
    if(await requireEditAuth()) alert("已解锁，可以编辑");
  };
  var lockBtn = $("boxes_lock_btn");
  if(lockBtn) lockBtn.onclick = function(){
    setEditUnlocked(false);
    updateEditLockUI();
  };
  updateEditLockUI();
  window.reloadBoxes();
}

function buildAdminUI(){
  var tab = $("tab_boxes");
  if(!tab) return;
  if(tab.dataset.built === "1" && tab.querySelector("#boxesAdminList")) return;
  tab.dataset.built = "1";
  tab.innerHTML =
    '<h3 style="margin:0 0 10px;font-size:16px;color:#1f2937;">📦 纸箱库存</h3>' +
    '<p style="font-size:13px;color:#666;margin:0 0 12px;">前台可查看；编辑需口令（默认 8888）。下方可修改口令。</p>' +
    '<div style="padding:14px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;margin-bottom:14px;">' +
      '<div style="font-weight:600;margin-bottom:8px;color:#9a3412;">编辑口令</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
        '<input id="boxes_pin_new" type="text" placeholder="新口令（至少4位）" style="padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;min-width:160px;">' +
        '<button type="button" id="boxes_pin_save" style="padding:7px 14px;border:none;border-radius:8px;background:#ea580c;color:#fff;cursor:pointer;font-weight:600;">保存口令</button>' +
      '</div>' +
      '<div style="margin-top:6px;font-size:12px;color:#9a3412;">前台编辑纸箱时使用此口令。改完立即生效。</div>' +
    '</div>' +
    formHtml("bxa") +
    '<div id="boxesAdminList"></div>';
  bindBrandCustomToggle("bxa");
  var addBtn = $("bxa_add_btn");
  if(addBtn) addBtn.onclick = function(){ window.boxAdd("bxa"); };
  var reloadBtn = $("bxa_reload_btn");
  if(reloadBtn) reloadBtn.onclick = function(){ window.reloadBoxes(); };
  var pinSave = $("boxes_pin_save");
  if(pinSave) pinSave.onclick = function(){ window.boxSavePin(); };
  setEditUnlocked(true);
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
  if($("boxesFrontRoot")) buildFrontUI();
  hookShowTab();
  var n = 0;
  var t = setInterval(function(){
    n++;
    hookShowTab();
    if($("tab_boxes") && $("tab_boxes").style.display === "block") buildAdminUI();
    if(n > 60) clearInterval(t);
  }, 300);
  console.log("boxes.js ready v20260815m");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
