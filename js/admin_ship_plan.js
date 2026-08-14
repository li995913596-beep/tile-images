/**
 * 出货计划：搜索库存选砖（无图）→ 填客户/付款/车辆信息 → 一键生成可复制文案
 * 不扣库存，不影响现有出库
 */
import { db } from "./firebase.js";
import {
  collection, getDocs, query, where, limit, startAfter
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

/** @type {Array<{id:string,code:string,spec:string,color:string,warehouse:string,stock:number,qty:number}>} */
var planLines = [];

function todayStr(){
  var d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

/** 与前台一致：精确 + 全库模糊分页 */
async function searchInventoryLikeFrontend(raw){
  var keyword = raw.trim().toLowerCase();
  if(!keyword) return [];
  var list = [];
  var seen = new Set();

  function add(docSnap){
    if(seen.has(docSnap.id)) return;
    seen.add(docSnap.id);
    var item = docSnap.data();
    if(item.hidden) return;
    list.push({
      id: docSnap.id,
      code: item.code || "",
      spec: item.spec || "",
      color: item.color || "",
      warehouse: item.warehouse || "",
      stock: Number(item.stock || 0)
    });
  }

  try {
    var variants = [...new Set([raw.trim(), keyword, raw.trim().toUpperCase()])];
    for(var i = 0; i < variants.length; i++){
      var v = variants[i];
      (await getDocs(query(collection(db, "inventory"), where("code", "==", v)))).forEach(add);
      (await getDocs(query(collection(db, "inventory"), where("spec", "==", v)))).forEach(add);
    }
  } catch(e){ console.error(e); }

  try {
    var lastDoc = null;
    var pageSize = 500;
    for(var pages = 0; pages < 40; pages++){
      var qAll = lastDoc
        ? query(collection(db, "inventory"), limit(pageSize), startAfter(lastDoc))
        : query(collection(db, "inventory"), limit(pageSize));
      var snap = await getDocs(qAll);
      if(snap.empty) break;
      snap.forEach(function(docSnap){
        var item = docSnap.data();
        var fullId = docSnap.id.toLowerCase();
        var code = String(item.code || "").toLowerCase();
        var spec = String(item.spec || "").toLowerCase();
        var color = String(item.color || "").toLowerCase();
        var warehouse = String(item.warehouse || "").toLowerCase();
        if(
          fullId.indexOf(keyword) >= 0 ||
          code.indexOf(keyword) >= 0 ||
          spec.indexOf(keyword) >= 0 ||
          color.indexOf(keyword) >= 0 ||
          warehouse.indexOf(keyword) >= 0
        ) add(docSnap);
      });
      lastDoc = snap.docs[snap.docs.length - 1];
      if(snap.size < pageSize) break;
    }
  } catch(e){ console.error(e); }

  list.sort(function(a, b){
    var ca = String(a.code || "").toLowerCase();
    var cb = String(b.code || "").toLowerCase();
    var score = function(c){
      if(c === keyword) return 0;
      if(c.indexOf(keyword) >= 0) return 1;
      return 2;
    };
    var sa = score(ca), sb = score(cb);
    if(sa !== sb) return sa - sb;
    if(ca !== cb) return ca.localeCompare(cb, "zh-CN");
    return String(a.warehouse).localeCompare(String(b.warehouse));
  });
  return list;
}

function warehouseStyle(w){
  w = String(w || "").toLowerCase();
  if(w === "k38") return { bg: "#e8f1fb", tag: "#dbeafe", tc: "#2563eb" };
  if(w === "k39") return { bg: "#eaf7f1", tag: "#dcfce7", tc: "#16a34a" };
  if(w === "1") return { bg: "#f3ecff", tag: "#ffedd5", tc: "#ea580c" };
  if(w === "c9") return { bg: "#fdf2f8", tag: "#fce7f3", tc: "#db2777" };
  return { bg: "#f3f4f6", tag: "#e5e7eb", tc: "#555" };
}

function renderSearchResults(items){
  var box = $("sp_search_result");
  if(!box) return;
  if(!items.length){
    box.innerHTML = '<div style="padding:12px;color:#888;">未找到库存</div>';
    return;
  }
  box.innerHTML = items.map(function(item, idx){
    var st = warehouseStyle(item.warehouse);
    var stockColor = item.stock === 0 ? "#ef4444" : (item.stock < 10 ? "#f59e0b" : "#16a34a");
    return (
      '<div style="background:' + st.bg + ';padding:12px 14px;border-radius:12px;margin-bottom:8px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;">' +
        '<div style="flex:1;min-width:160px;">' +
          '<div style="font-weight:700;font-size:15px;">' + esc(item.code) + '</div>' +
          '<div style="font-size:13px;color:#555;margin-top:2px;">规格 ' + esc(item.spec || "-") +
            ' · 色号 <b>' + esc(item.color || "-") + '</b></div>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
          '<span style="font-size:12px;padding:4px 10px;border-radius:999px;background:' + st.tag + ';color:' + st.tc + ';font-weight:600;">' +
            esc(item.warehouse || "-") + '</span>' +
          '<span style="font-size:15px;font-weight:700;color:' + stockColor + ';">库存 ' + item.stock + '</span>' +
          '<input id="sp_qty_' + idx + '" type="number" min="0" step="0.01" placeholder="出货数" style="width:88px;padding:6px 8px;border:1px solid #d1d5db;border-radius:8px;">' +
          '<button type="button" data-sp-add="' + idx + '" style="padding:6px 14px;border:none;border-radius:8px;background:#0f766e;color:#fff;cursor:pointer;font-weight:600;">加入计划</button>' +
        '</div>' +
      '</div>'
    );
  }).join("");

  box._spItems = items;
  box.querySelectorAll("[data-sp-add]").forEach(function(btn){
    btn.onclick = function(){
      var i = Number(btn.getAttribute("data-sp-add"));
      var item = (box._spItems || [])[i];
      if(!item) return;
      var qtyEl = $("sp_qty_" + i);
      var qty = Number(qtyEl && qtyEl.value);
      if(!qty || qty <= 0) return alert("请填写出货数量");
      if(qty > item.stock){
        if(!confirm("出货数量 " + qty + " 大于库存 " + item.stock + "，仍要加入？")) return;
      }
      planLines.push({
        id: item.id,
        code: item.code,
        spec: item.spec,
        color: item.color,
        warehouse: item.warehouse,
        stock: item.stock,
        qty: qty
      });
      renderPlanLines();
      if(qtyEl) qtyEl.value = "";
    };
  });
}

function renderPlanLines(){
  var box = $("sp_plan_list");
  if(!box) return;
  if(!planLines.length){
    box.innerHTML = '<div style="padding:10px;color:#888;font-size:13px;">尚未加入瓷砖，请先搜索后点「加入计划」</div>';
    return;
  }
  box.innerHTML = planLines.map(function(line, idx){
    return (
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid #eef2f6;background:#fff;">' +
        '<span style="font-weight:700;min-width:24px;color:#64748b;">' + (idx + 1) + '.</span>' +
        '<span style="font-weight:600;">' + esc(line.code) + '</span>' +
        '<span style="color:#64748b;">' + esc(line.spec || "-") + '</span>' +
        '<span>色号 <b>' + esc(line.color || "-") + '</b></span>' +
        '<span style="font-size:12px;padding:2px 8px;border-radius:999px;background:#e5e7eb;">' + esc(line.warehouse || "-") + '</span>' +
        '<span style="font-weight:700;color:#0f766e;">× ' + line.qty + '</span>' +
        '<button type="button" data-sp-del="' + idx + '" style="margin-left:auto;padding:4px 10px;border:1px solid #fecaca;background:#fee2e2;color:#b91c1c;border-radius:6px;cursor:pointer;">移除</button>' +
      '</div>'
    );
  }).join("");
  box.querySelectorAll("[data-sp-del]").forEach(function(btn){
    btn.onclick = function(){
      var i = Number(btn.getAttribute("data-sp-del"));
      planLines.splice(i, 1);
      renderPlanLines();
    };
  });
}

function buildCustomerLine(){
  var name = (($("sp_customer") && $("sp_customer").value) || "").trim();
  var pay = (($("sp_pay") && $("sp_pay").value) || "").trim();
  var account = (($("sp_account") && $("sp_account").value) || "").trim();
  var parts = [];
  if(name) parts.push(name);
  if(pay) parts.push(pay);
  if(account) parts.push(account);
  return parts.length ? ("客户:" + parts.join("，")) : "客户:";
}

function generatePlanText(){
  var date = (($("sp_date") && $("sp_date").value) || todayStr()).trim();
  var vehicle = (($("sp_vehicle") && $("sp_vehicle").value) || "").trim();
  var note = (($("sp_note") && $("sp_note").value) || "").trim();

  var lines = [];
  lines.push("出货计划เบิก");
  lines.push("日期วันที่:" + date);
  lines.push("单位或车牌 ป้ายทะเบียน:");
  if(vehicle){
    vehicle.split(/\r?\n/).forEach(function(row){
      var t = row.trim();
      if(t) lines.push(t);
    });
  }
  lines.push(buildCustomerLine());
  planLines.forEach(function(line, idx){
    lines.push((idx + 1) + ".ကုဒ်နိပတ်/编号：" + (line.code || ""));
    lines.push("အလျားအနံ/规格：" + (line.spec || ""));
    lines.push("အရောင်ကုဒ်色号：" + (line.color || ""));
    lines.push("အရေအတွက်/数量：" + line.qty);
  });
  if(note) lines.push(note);
  else lines.push("送货单一起带过去");
  return lines.join("\n");
}

window.spSearch = async function(){
  var input = $("sp_search");
  var raw = (input && input.value || "").trim();
  var box = $("sp_search_result");
  if(!raw) return alert("请输入编号或规格");
  if(box) box.innerHTML = '<div style="padding:12px;color:#666;">搜索中…</div>';
  try {
    var items = await searchInventoryLikeFrontend(raw);
    renderSearchResults(items);
  } catch(e){
    console.error(e);
    if(box) box.innerHTML = '<div style="padding:12px;color:#b91c1c;">搜索失败</div>';
  }
};

window.spGenerate = function(){
  if(!planLines.length) return alert("请先加入至少一条出货瓷砖");
  var text = generatePlanText();
  var out = $("sp_output");
  if(out){
    out.value = text;
    out.style.display = "block";
  }
  return text;
};

window.spCopy = async function(){
  var text = window.spGenerate();
  if(!text) return;
  try {
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      alert("已复制到剪贴板");
    } else {
      var out = $("sp_output");
      if(out){
        out.focus();
        out.select();
        document.execCommand("copy");
        alert("已复制到剪贴板");
      }
    }
  } catch(e){
    alert("复制失败，请手动全选文本框复制");
  }
};

window.spClearPlan = function(){
  if(planLines.length && !confirm("清空当前计划明细？")) return;
  planLines = [];
  renderPlanLines();
  var out = $("sp_output");
  if(out){ out.value = ""; out.style.display = "none"; }
};

function buildShipPlanUI(){
  var tab = $("tab_ship");
  if(!tab) return;
  if(tab.dataset.built === "1" && tab.querySelector("#sp_search")) return;
  tab.dataset.built = "1";
  tab.innerHTML =
    '<h3 style="margin:0 0 12px;font-size:16px;color:#1f2937;">出货计划</h3>' +
    '<p style="font-size:13px;color:#666;margin:0 0 14px;line-height:1.5;">搜索库存选砖（显示仓库/色号/数量，无图片）→ 填客户与付款 → 生成文案一键复制。不扣库存。</p>' +
    '<div style="display:grid;gap:12px;margin-bottom:14px;">' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">' +
        '<label style="font-size:13px;">日期 <input id="sp_date" value="' + todayStr() + '" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;width:130px;"></label>' +
        '<label style="font-size:13px;">客户 <input id="sp_customer" placeholder="客户名称" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;min-width:140px;"></label>' +
        '<label style="font-size:13px;">付款 ' +
          '<select id="sp_pay" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;">' +
            '<option value="已付款">已付款</option>' +
            '<option value="未付款">未付款</option>' +
            '<option value="">（不写）</option>' +
          '</select></label>' +
        '<label style="font-size:13px;">账户 ' +
          '<select id="sp_account" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;">' +
            '<option value="公账">公账</option>' +
            '<option value="私账">私账</option>' +
            '<option value="">（不写）</option>' +
          '</select></label>' +
      '</div>' +
      '<div>' +
        '<div style="font-size:13px;font-weight:600;margin-bottom:4px;color:#374151;">车辆信息（可直接粘贴，可空）</div>' +
        '<textarea id="sp_vehicle" rows="4" placeholder="可直接粘贴车牌、吨位、电话等" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #d1d5db;border-radius:10px;font-size:13px;line-height:1.45;resize:vertical;"></textarea>' +
      '</div>' +
      '<div>' +
        '<div style="font-size:13px;font-weight:600;margin-bottom:4px;color:#374151;">文末备注（可空，默认送货单一起带过去）</div>' +
        '<input id="sp_note" placeholder="送货单一起带过去" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;">' +
      '</div>' +
    '</div>' +
    '<div style="padding:14px;border-radius:12px;background:#f0fdfa;border:1px solid #99f6e4;margin-bottom:14px;">' +
      '<div style="font-weight:600;margin-bottom:8px;color:#0f766e;">1 搜索库存并加入计划</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
        '<input id="sp_search" placeholder="输入编号或规格，如 3610 / NB3610" style="flex:1;min-width:180px;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;">' +
        '<button type="button" id="sp_btn_search" style="padding:8px 16px;border:none;border-radius:8px;background:#0f766e;color:#fff;cursor:pointer;font-weight:600;">搜索</button>' +
      '</div>' +
      '<div id="sp_search_result"></div>' +
    '</div>' +
    '<div style="padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">' +
        '<div style="font-weight:600;color:#1f2937;">2 本单明细</div>' +
        '<button type="button" id="sp_btn_clear" style="padding:5px 12px;border:1px solid #e5e7eb;background:#fff;border-radius:6px;cursor:pointer;font-size:12px;">清空明细</button>' +
      '</div>' +
      '<div id="sp_plan_list"></div>' +
    '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;">' +
      '<button type="button" id="sp_btn_gen" style="padding:10px 18px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;font-weight:600;">生成出货计划</button>' +
      '<button type="button" id="sp_btn_copy" style="padding:10px 18px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;font-weight:600;">一键复制</button>' +
    '</div>' +
    '<textarea id="sp_output" readonly rows="14" style="display:none;width:100%;box-sizing:border-box;padding:12px;border:1px solid #d1d5db;border-radius:10px;font-size:13px;line-height:1.5;font-family:ui-monospace,monospace;"></textarea>';

  var btnSearch = $("sp_btn_search");
  if(btnSearch) btnSearch.onclick = function(){ window.spSearch(); };
  var searchInput = $("sp_search");
  if(searchInput){
    searchInput.addEventListener("keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); window.spSearch(); }
    });
  }
  var btnGen = $("sp_btn_gen");
  if(btnGen) btnGen.onclick = function(){ window.spGenerate(); };
  var btnCopy = $("sp_btn_copy");
  if(btnCopy) btnCopy.onclick = function(){ window.spCopy(); };
  var btnClear = $("sp_btn_clear");
  if(btnClear) btnClear.onclick = function(){ window.spClearPlan(); };

  renderPlanLines();
}

function hookShowTab(){
  if(typeof window.showTab !== "function") return false;
  if(window.showTab.__shipPlanHooked) return true;
  var orig = window.showTab;
  window.showTab = function(name){
    orig.apply(this, arguments);
    if(name === "ship"){
      buildShipPlanUI();
    }
  };
  window.showTab.__shipPlanHooked = true;
  return true;
}

function ensureShipVisible(){
  var tab = $("tab_ship");
  if(!tab) return;
  var shown = tab.style.display === "block" || (tab.offsetParent !== null && tab.style.display !== "none");
  if(!shown) return;
  if(!tab.querySelector("#sp_search")){
    tab.dataset.built = "";
    buildShipPlanUI();
  }
}

function boot(){
  hookShowTab();
  var n = 0;
  var t = setInterval(function(){
    n++;
    hookShowTab();
    ensureShipVisible();
    if(n > 80) clearInterval(t);
  }, 250);
  setInterval(ensureShipVisible, 800);
  console.log("admin_ship_plan.js ready v20260814b");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
