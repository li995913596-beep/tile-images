/**
 * 美缝剂库存：前台只读查看；后台可增改出入库
 * 字段：产品名称、颜色、数量、仓库
 */
import { db } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, query, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

function esc(s){ return String(s == null ? "" : s); }

function normWh(w){
  return String(w || "").trim().toLowerCase().replace(/[\/\\ ]+/g, "_");
}

function groutDocId(name, color, warehouse){
  var n = String(name || "").trim().replace(/[\/\\]/g, "_");
  var c = String(color || "").trim().replace(/[\/\\]/g, "_");
  var w = normWh(warehouse);
  return (n + "__" + c + "__" + w).slice(0, 700);
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

async function writeGroutLog(type, name, color, warehouse, qty, operator, note){
  try {
    await addDoc(collection(db, "logs"), {
      timestamp: serverTimestamp(),
      type: type,
      code: name || "美缝剂",
      spec: color || "",
      color: color || "",
      warehouse: warehouse || "",
      qty: Number(qty) || 0,
      customer: operator || "",
      source: "美缝剂",
      operator: operator || "",
      note: note || ""
    });
  } catch(e){ console.warn("美缝剂日志写入失败", e); }
}

async function loadAllGrout(){
  var snap = await getDocs(query(collection(db, "grout"), limit(2000)));
  var list = [];
  snap.forEach(function(d){
    var x = d.data() || {};
    list.push({
      id: d.id,
      name: x.name || "美缝剂",
      color: x.color || "",
      warehouse: x.warehouse || "",
      qty: Number(x.qty || 0)
    });
  });
  list.sort(function(a, b){
    return String(a.name).localeCompare(String(b.name), "zh-CN")
      || String(a.color).localeCompare(String(b.color), "zh-CN")
      || String(a.warehouse).localeCompare(String(b.warehouse), "zh-CN");
  });
  return list;
}

function groupByName(list){
  var map = {};
  (list || []).forEach(function(it){
    var n = it.name || "美缝剂";
    if(!map[n]) map[n] = [];
    map[n].push(it);
  });
  return map;
}

/** canEdit=false 前台只读；true 后台可操作 */
function renderGroutList(list, hostId, canEdit){
  var host = $(hostId);
  if(!host) return;
  if(!list.length){
    host.innerHTML = '<div style="padding:14px;color:#94a3b8;font-size:14px;">暂无美缝剂记录' + (canEdit ? "，请先新增录入。" : "。") + '</div>';
    return;
  }
  var grouped = groupByName(list);
  var names = Object.keys(grouped).sort(function(a,b){ return a.localeCompare(b, "zh-CN"); });
  var html = "";
  names.forEach(function(name){
    html += '<div style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;">';
    html += '<div style="padding:10px 14px;background:#faf5ff;border-bottom:1px solid #e9d5ff;font-weight:700;color:#6b21a8;">🧴 ' + esc(name) +
      ' <span style="font-weight:500;color:#7c3aed;font-size:12px;">（' + grouped[name].length + ' 种）</span></div>';
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:420px;">';
    html += '<thead><tr style="background:#fafafa;text-align:left;color:#64748b;">' +
      '<th style="padding:8px 12px;">颜色</th>' +
      '<th style="padding:8px 12px;">仓库</th>' +
      '<th style="padding:8px 12px;">数量</th>' +
      (canEdit ? '<th style="padding:8px 12px;">操作</th>' : '') +
      '</tr></thead><tbody>';
    grouped[name].forEach(function(it){
      var qtyColor = it.qty > 0 ? "#16a34a" : "#b91c1c";
      html += '<tr style="border-top:1px solid #f1f5f9;">' +
        '<td style="padding:10px 12px;font-weight:600;">' + esc(it.color || "-") + '</td>' +
        '<td style="padding:10px 12px;"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#f3e8ff;color:#6b21a8;font-size:12px;">' + esc(it.warehouse || "-") + '</span></td>' +
        '<td style="padding:10px 12px;"><b style="color:' + qtyColor + ';font-size:16px;">' + it.qty + '</b></td>';
      if(canEdit){
        html += '<td style="padding:10px 12px;white-space:nowrap;">' +
          '<button type="button" data-grout-in="' + esc(it.id) + '" style="padding:5px 10px;margin-right:6px;border:none;border-radius:6px;background:#16a34a;color:#fff;cursor:pointer;font-size:12px;">入库</button>' +
          '<button type="button" data-grout-out="' + esc(it.id) + '" style="padding:5px 10px;margin-right:6px;border:none;border-radius:6px;background:#ea580c;color:#fff;cursor:pointer;font-size:12px;">出库</button>' +
          '<button type="button" data-grout-del="' + esc(it.id) + '" style="padding:5px 10px;border:1px solid #fecaca;border-radius:6px;background:#fff;color:#b91c1c;cursor:pointer;font-size:12px;">删除</button>' +
        '</td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
  });
  host.innerHTML = html;

  if(!canEdit) return;
  host.querySelectorAll("[data-grout-in]").forEach(function(btn){
    btn.onclick = function(){ window.groutAdjust(btn.getAttribute("data-grout-in"), "in"); };
  });
  host.querySelectorAll("[data-grout-out]").forEach(function(btn){
    btn.onclick = function(){ window.groutAdjust(btn.getAttribute("data-grout-out"), "out"); };
  });
  host.querySelectorAll("[data-grout-del]").forEach(function(btn){
    btn.onclick = function(){ window.groutDelete(btn.getAttribute("data-grout-del")); };
  });
}

window.reloadGrout = async function(){
  var front = $("groutFrontList");
  var admin = $("groutAdminList");
  if(front) front.innerHTML = '<div style="padding:12px;color:#666;">加载中…</div>';
  if(admin) admin.innerHTML = '<div style="padding:12px;color:#666;">加载中…</div>';
  try {
    var list = await loadAllGrout();
    if(front) renderGroutList(list, "groutFrontList", false);
    if(admin) renderGroutList(list, "groutAdminList", true);
  } catch(e){
    console.error(e);
    if(front) front.innerHTML = '<div style="padding:12px;color:#b91c1c;">加载失败</div>';
    if(admin) admin.innerHTML = '<div style="padding:12px;color:#b91c1c;">加载失败（检查 Firebase 是否允许 grout）</div>';
  }
};

window.groutAdjust = async function(id, dir){
  if(!id) return;
  var label = dir === "in" ? "入库" : "出库";
  var operator = askOperator(label);
  if(!operator) return;
  var raw = prompt(label + "数量：");
  if(raw == null) return;
  var n = Number(raw);
  if(!n || n <= 0) return alert("请输入大于 0 的数量");
  try {
    var ref = doc(db, "grout", id);
    var snap = await getDoc(ref);
    if(!snap.exists()) return alert("记录不存在，请刷新");
    var data = snap.data() || {};
    var cur = Number(data.qty || 0);
    var next = dir === "in" ? cur + n : cur - n;
    if(next < 0) return alert("库存不足，当前仅 " + cur);
    await updateDoc(ref, { qty: next, lastUpdate: serverTimestamp() });
    await writeGroutLog(
      dir === "in" ? "美缝剂入库" : "美缝剂出库",
      data.name, data.color, data.warehouse, n, operator, ""
    );
    alert(label + "成功\n操作人：" + operator + "\n当前数量：" + next);
    window.reloadGrout();
  } catch(e){
    console.error(e);
    alert(label + "失败：" + ((e && e.message) || e));
  }
};

window.groutDelete = async function(id){
  if(!id) return;
  var operator = askOperator("删除");
  if(!operator) return;
  if(!confirm("确定删除这条美缝剂记录？")) return;
  try {
    var ref = doc(db, "grout", id);
    var snap = await getDoc(ref);
    var data = snap.exists() ? (snap.data() || {}) : {};
    await deleteDoc(ref);
    await writeGroutLog("美缝剂删除", data.name || "", data.color || "", data.warehouse || "", data.qty || 0, operator, "删除记录");
    alert("已删除");
    window.reloadGrout();
  } catch(e){
    console.error(e);
    alert("删除失败");
  }
};

window.groutAdd = async function(){
  var nameEl = $("gxa_name");
  var colorEl = $("gxa_color");
  var whEl = $("gxa_warehouse");
  var qtyEl = $("gxa_qty");
  var name = (nameEl && nameEl.value || "美缝剂").trim() || "美缝剂";
  var color = (colorEl && colorEl.value || "").trim();
  var warehouse = normWh(whEl && whEl.value);
  var qty = Number(qtyEl && qtyEl.value);
  if(!color) return alert("请填写颜色");
  if(!warehouse) return alert("请填写仓库");
  if(isNaN(qty) || qty < 0) return alert("数量不能为负");
  var operator = askOperator("录入");
  if(!operator) return;

  var id = groutDocId(name, color, warehouse);
  try {
    var ref = doc(db, "grout", id);
    var snap = await getDoc(ref);
    if(snap.exists()){
      var cur = Number((snap.data() || {}).qty || 0);
      var next = cur + (qty || 0);
      await updateDoc(ref, {
        name: name, color: color, warehouse: warehouse,
        qty: next, lastUpdate: serverTimestamp()
      });
      if(qty > 0) await writeGroutLog("美缝剂入库", name, color, warehouse, qty, operator, "新增合并");
      alert("该颜色已存在，已合并数量，当前 " + next + "\n操作人：" + operator);
    } else {
      await setDoc(ref, {
        name: name, color: color, warehouse: warehouse,
        qty: qty || 0, lastUpdate: serverTimestamp()
      });
      if(qty > 0) await writeGroutLog("美缝剂入库", name, color, warehouse, qty, operator, "新建");
      alert("已新增\n操作人：" + operator);
    }
    if(colorEl) colorEl.value = "";
    if(qtyEl) qtyEl.value = "";
    window.reloadGrout();
  } catch(e){
    console.error(e);
    alert("保存失败：" + ((e && e.message) || e));
  }
};

function formHtml(){
  return (
    '<div style="padding:14px;border-radius:12px;background:#faf5ff;border:1px solid #e9d5ff;margin-bottom:14px;">' +
      '<div style="font-weight:600;margin-bottom:10px;color:#6b21a8;">新增 / 合并录入</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
        '<input id="gxa_name" value="美缝剂" placeholder="产品名称" style="padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;width:110px;">' +
        '<input id="gxa_color" placeholder="颜色*" style="padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;min-width:120px;">' +
        '<input id="gxa_warehouse" placeholder="仓库* 如 k38" style="padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;width:110px;">' +
        '<input id="gxa_qty" type="number" min="0" step="1" placeholder="数量" style="padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;width:90px;">' +
        '<button type="button" id="gxa_add_btn" style="padding:7px 16px;border:none;border-radius:8px;background:#7c3aed;color:#fff;cursor:pointer;font-weight:600;">保存</button>' +
        '<button type="button" id="gxa_reload_btn" style="padding:7px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;cursor:pointer;">刷新</button>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:12px;color:#7c3aed;">同一产品名+颜色+仓库会自动合并。出入库需填操作人并记日志。前台仅可查看。</div>' +
    '</div>'
  );
}

function buildFrontUI(){
  var root = $("groutFrontRoot");
  if(!root) return;
  if(root.dataset.built === "1") return;
  root.dataset.built = "1";
  root.innerHTML =
    '<h2 style="margin:0 0 6px;font-size:18px;color:#1f2937;">美缝剂库存</h2>' +
    '<p style="font-size:13px;color:#64748b;margin:0 0 14px;">仅供查看。修改请联系管理员在后台操作。</p>' +
    '<div id="groutFrontList"></div>';
  window.reloadGrout();
}

function buildAdminUI(){
  var tab = $("tab_grout");
  if(!tab) return;
  if(tab.dataset.built === "1" && tab.querySelector("#groutAdminList")) return;
  tab.dataset.built = "1";
  tab.innerHTML =
    '<h3 style="margin:0 0 10px;font-size:16px;color:#1f2937;">🧴 美缝剂库存</h3>' +
    '<p style="font-size:13px;color:#666;margin:0 0 12px;">字段：产品名称、颜色、数量、仓库。前台只读，仅后台可编辑。</p>' +
    formHtml() +
    '<div id="groutAdminList"></div>';
  var addBtn = $("gxa_add_btn");
  if(addBtn) addBtn.onclick = function(){ window.groutAdd(); };
  var reloadBtn = $("gxa_reload_btn");
  if(reloadBtn) reloadBtn.onclick = function(){ window.reloadGrout(); };
}

function hookShowTab(){
  if(typeof window.showTab !== "function") return false;
  if(window.showTab.__groutHooked) return true;
  var orig = window.showTab;
  window.showTab = function(name){
    orig.apply(this, arguments);
    if(name === "grout"){
      buildAdminUI();
      window.reloadGrout();
    }
  };
  window.showTab.__groutHooked = true;
  return true;
}

function boot(){
  if($("groutFrontRoot")) buildFrontUI();
  hookShowTab();
  var n = 0;
  var t = setInterval(function(){
    n++;
    hookShowTab();
    if($("tab_grout") && $("tab_grout").style.display === "block") buildAdminUI();
    if(n > 60) clearInterval(t);
  }, 300);
  console.log("grout.js ready v20260817a");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
