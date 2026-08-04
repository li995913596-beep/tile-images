/**
 * 后台在途管理
 * 一个柜子多种砖 = 同一柜号多行记录（每行一个型号）
 * 色号可空，仅型号/编号必填
 */
import { auth, db } from "./firebase.js";
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

function fmtTime(v){
  if(!v) return "-";
  try {
    const d = v.toDate ? v.toDate() : new Date(v);
    if(isNaN(d.getTime())) return "-";
    const p = function(n){ return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  } catch(e){ return "-"; }
}

function normHeader(h){
  return String(h || "").trim().toLowerCase().replace(/\s+/g, "");
}

function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g, "&")
    .replace(/"/g, """)
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

var HEADER_MAP = {
  "提单号": "blNo", "bl": "blNo", "blno": "blNo", "提单": "blNo",
  "柜号": "containerNo", "集装箱号": "containerNo", "containerno": "containerNo", "container": "containerNo",
  "型号": "code", "编号": "code", "code": "code",
  "色号": "color", "color": "color",
  "规格": "spec", "spec": "spec", "size": "spec",
  "备注": "remark", "remark": "remark", "note": "remark",
  "数量": "qty", "qty": "qty", "quantity": "qty",
  "预计到港日期": "eta", "预计到港": "eta", "到港日期": "eta", "eta": "eta",
  "吸水率": "absorption", "牌子": "brand", "品牌": "brand",
  "颜色": "colorName", "重量": "weight", "片数": "pieces"
};

function rowFromExcel(obj){
  var out = {
    blNo: "", containerNo: "", code: "", color: "", spec: "", remark: "",
    qty: 0, eta: "", absorption: "", brand: "", colorName: "", weight: "", pieces: "",
    status: "在途", reservations: []
  };
  Object.keys(obj).forEach(function(k){
    var field = HEADER_MAP[normHeader(k)] || HEADER_MAP[String(k).trim()];
    if(!field) return;
    var v = obj[k];
    if(v == null) v = "";
    if(field === "qty" || field === "pieces"){
      var n = Number(String(v).replace(/,/g, ""));
      out[field] = isNaN(n) ? 0 : n;
    } else if(field === "eta" && typeof v === "number" && window.XLSX && XLSX.SSF){
      try {
        var d = XLSX.SSF.parse_date_code(v);
        out.eta = d ? (d.y + "-" + String(d.m).padStart(2,"0") + "-" + String(d.d).padStart(2,"0")) : String(v);
      } catch(e){ out.eta = String(v); }
    } else {
      out[field] = String(v).trim();
    }
  });
  return out;
}

window.importTransitExcel = async function(){
  try {
    if(!auth.currentUser) return alert("请先登录");
    var fileEl = $("transitExcel");
    if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("请先选择 Excel");
    if(typeof XLSX === "undefined") return alert("XLSX 未加载，请刷新页面");
    var wb = XLSX.read(await fileEl.files[0].arrayBuffer(), { type: "array" });
    var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    if(!rows.length) return alert("无数据行");
    var ok = 0, skip = 0;
    for(var i = 0; i < rows.length; i++){
      var item = rowFromExcel(rows[i]);
      if(!item.code){ skip++; continue; }
      try {
        await addDoc(collection(db, "in_transit"), Object.assign({}, item, {
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }));
        ok++;
      } catch(e){ console.error(e); skip++; }
    }
    alert("导入完成：成功 " + ok + " 条" + (skip ? "，跳过 " + skip + " 条" : "") + "\n说明：同一柜号可有多行（多种砖）");
    fileEl.value = "";
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } catch(e){
    console.error(e);
    alert("导入失败：" + ((e && e.message) || e));
  }
};

window.addTransitManual = async function(){
  try {
    if(!auth.currentUser) return alert("请先登录");
    var code = (($("tm_code") && $("tm_code").value) || "").trim();
    if(!code) return alert("请填写型号/编号（色号可以不填）");
    var item = {
      blNo: (($("tm_bl") && $("tm_bl").value) || "").trim(),
      containerNo: (($("tm_container") && $("tm_container").value) || "").trim(),
      code: code,
      color: (($("tm_color") && $("tm_color").value) || "").trim(),
      spec: (($("tm_spec") && $("tm_spec").value) || "").trim(),
      remark: (($("tm_remark") && $("tm_remark").value) || "").trim(),
      qty: Number(($("tm_qty") && $("tm_qty").value) || 0) || 0,
      eta: (($("tm_eta") && $("tm_eta").value) || "").trim(),
      absorption: "", brand: "", colorName: "", weight: "", pieces: "",
      status: (($("tm_status") && $("tm_status").value) || "在途"),
      reservations: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await addDoc(collection(db, "in_transit"), item);
    alert("已新增\n同一柜号可继续新增其他型号（一个柜子多种砖 = 多行同柜号）");
    ["tm_code", "tm_color", "tm_spec", "tm_remark", "tm_qty"].forEach(function(id){
      if($(id)) $(id).value = "";
    });
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } catch(e){
    console.error(e);
    alert("新增失败：" + ((e && e.message) || e));
  }
};

window.saveTransitReservations = async function(id){
  try {
    if(!auth.currentUser) return alert("请先登录");
    var box = $("res_box_" + id);
    if(!box) return;
    var list = [];
    box.querySelectorAll("[data-res-row]").forEach(function(row){
      var qtyEl = row.querySelector(".res-qty");
      var cusEl = row.querySelector(".res-customer");
      var qty = Number((qtyEl && qtyEl.value) || 0);
      var customer = ((cusEl && cusEl.value) || "").trim();
      if(qty > 0 && customer) list.push({ qty: qty, customer: customer });
    });
    await updateDoc(doc(db, "in_transit", id), {
      reservations: list,
      updatedAt: serverTimestamp()
    });
    alert("预定已保存");
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } catch(e){
    alert("保存失败：" + ((e && e.message) || e));
  }
};

window.addResRow = function(id){
  var box = $("res_box_" + id);
  if(!box) return;
  var div = document.createElement("div");
  div.setAttribute("data-res-row", "1");
  div.style.cssText = "display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap;";
  div.innerHTML =
    '<input class="res-qty" type="number" placeholder="数量" style="width:80px;padding:4px 6px;">' +
    '<input class="res-customer" placeholder="客户名" style="flex:1;min-width:100px;padding:4px 6px;">' +
    '<button type="button" style="padding:4px 8px;">删</button>';
  div.querySelector("button").onclick = function(){ div.remove(); };
  box.appendChild(div);
};

window.deleteTransitItem = async function(id){
  try {
    if(!auth.currentUser) return alert("请先登录");
    if(!confirm("确定删除？建议改为「已入库」或「取消」保留历史。")) return;
    await deleteDoc(doc(db, "in_transit", id));
    alert("已删除");
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } catch(e){
    alert("删除失败：" + ((e && e.message) || e));
  }
};

async function loadList(){
  var snap = await getDocs(query(collection(db, "in_transit"), limit(2000)));
  var list = [];
  snap.forEach(function(d){ list.push(Object.assign({ id: d.id }, d.data())); });
  list.sort(function(a, b){
    var ta = a.updatedAt && a.updatedAt.toDate ? a.updatedAt.toDate().getTime() : 0;
    var tb = b.updatedAt && b.updatedAt.toDate ? b.updatedAt.toDate().getTime() : 0;
    return tb - ta;
  });
  return list;
}

function renderAdminList(list){
  var box = $("transitList");
  if(!box) return;
  var filter = ($("transitFilter") && $("transitFilter").value) || "active";
  var kw = (($("transitSearch") && $("transitSearch").value) || "").trim().toLowerCase();

  var filtered = list.filter(function(item){
    var st = item.status || "在途";
    if(filter === "active" && st !== "在途" && st !== "已到港") return false;
    if(filter === "history" && st !== "已入库" && st !== "取消") return false;
    if(filter !== "active" && filter !== "history" && filter !== "all" && st !== filter) return false;
    if(!kw) return true;
    var blob = [item.code, item.spec, item.color, item.containerNo, item.blNo]
      .map(function(x){ return String(x || "").toLowerCase(); }).join(" ");
    return blob.indexOf(kw) >= 0;
  });

  if(!filtered.length){
    box.innerHTML = '<div style="color:#666;padding:12px;">暂无数据。同一柜号可新增多行（多种砖）。</div>';
    return;
  }

  box.innerHTML = "";
  filtered.forEach(function(item){
    var id = item.id;
    var reserves = Array.isArray(item.reservations) ? item.reservations : [];
    var card = document.createElement("div");
    card.style.cssText = "border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-bottom:10px;background:#fff;";

    var opts = ["在途", "已到港", "已入库", "取消"].map(function(s){
      return '<option value="' + s + '"' + (item.status === s ? " selected" : "") + ">" + s + "</option>";
    }).join("");

    card.innerHTML =
      '<div style="font-weight:700;font-size:15px;margin-bottom:6px;">' + esc(item.code) +
      ' <span style="font-weight:400;color:#666;font-size:13px;">规格 ' + esc(item.spec) +
      ' · 色号 ' + (item.color ? esc(item.color) : "无") +
      ' · 数量 ' + (item.qty != null ? item.qty : "-") + '</span></div>' +
      '<div style="font-size:13px;color:#555;margin-bottom:8px;">柜号 ' + esc(item.containerNo) +
      ' · 提单 ' + esc(item.blNo) + ' · 更新 ' + fmtTime(item.updatedAt) + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">' +
      '<label style="font-size:13px;">状态 <select data-field="status" style="padding:4px 6px;">' + opts + '</select></label>' +
      '<label style="font-size:13px;">到港 <input data-field="eta" value="' + esc(item.eta) + '" style="width:120px;padding:4px 6px;"></label>' +
      '<label style="font-size:13px;">备注 <input data-field="remark" value="' + esc(item.remark) + '" style="min-width:140px;padding:4px 6px;"></label>' +
      '<button type="button" class="btn-save-fields" style="padding:5px 12px;border:none;border-radius:6px;background:#2f7dd1;color:#fff;cursor:pointer;">保存</button>' +
      '<button type="button" class="btn-del" style="padding:5px 12px;border:none;border-radius:6px;background:#dc2626;color:#fff;cursor:pointer;">删除</button>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">预定（数量+客户名）</div>' +
      '<div id="res_box_' + id + '"></div>' +
      '<div style="margin-top:6px;display:flex;gap:8px;">' +
      '<button type="button" class="btn-add-res" style="padding:4px 10px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;">+ 添加预定</button>' +
      '<button type="button" class="btn-save-res" style="padding:4px 10px;border:none;border-radius:6px;background:#16a34a;color:#fff;cursor:pointer;">保存预定</button>' +
      '</div>';

    var resBox = card.querySelector("#res_box_" + id);
    reserves.forEach(function(r){
      var div = document.createElement("div");
      div.setAttribute("data-res-row", "1");
      div.style.cssText = "display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap;";
      div.innerHTML =
        '<input class="res-qty" type="number" value="' + Number(r.qty || 0) + '" style="width:80px;padding:4px 6px;">' +
        '<input class="res-customer" value="' + esc(r.customer) + '" style="flex:1;min-width:100px;padding:4px 6px;">' +
        '<button type="button" style="padding:4px 8px;">删</button>';
      div.querySelector("button").onclick = function(){ div.remove(); };
      resBox.appendChild(div);
    });

    card.querySelector(".btn-save-fields").onclick = async function(){
      try {
        await updateDoc(doc(db, "in_transit", id), {
          status: card.querySelector('[data-field="status"]').value,
          eta: card.querySelector('[data-field="eta"]').value.trim(),
          remark: card.querySelector('[data-field="remark"]').value.trim(),
          updatedAt: serverTimestamp()
        });
        alert("已保存");
        if(window.reloadTransitAdmin) window.reloadTransitAdmin();
      } catch(e){ alert((e && e.message) || e); }
    };
    card.querySelector(".btn-del").onclick = function(){ window.deleteTransitItem(id); };
    card.querySelector(".btn-add-res").onclick = function(){ window.addResRow(id); };
    card.querySelector(".btn-save-res").onclick = function(){ window.saveTransitReservations(id); };
    box.appendChild(card);
  });
}

window.reloadTransitAdmin = async function(){
  var box = $("transitList");
  if(!box) return;
  box.innerHTML = '<div style="color:#666;padding:12px;">加载中…</div>';
  try {
    renderAdminList(await loadList());
  } catch(e){
    console.error(e);
    box.innerHTML = '<div style="color:#b91c1c;padding:12px;">加载失败：' + ((e && e.message) || e) +
      '<br>若提示权限，请在 Firebase 规则中允许 in_transit 读写</div>';
  }
};

function ensureTransitUI(){
  var pairs = [
    ["btnTransitImport", function(){ window.importTransitExcel(); }],
    ["btnTransitAdd", function(){ window.addTransitManual(); }],
    ["btnTransitReload", function(){ window.reloadTransitAdmin(); }]
  ];
  pairs.forEach(function(pair){
    var el = $(pair[0]);
    if(el && !el.__bound){
      el.__bound = true;
      el.onclick = pair[1];
    }
  });
  var filter = $("transitFilter");
  if(filter && !filter.__bound){
    filter.__bound = true;
    filter.onchange = function(){ window.reloadTransitAdmin(); };
  }
  var search = $("transitSearch");
  if(search && !search.__bound){
    search.__bound = true;
    search.addEventListener("keydown", function(e){
      if(e.key === "Enter") window.reloadTransitAdmin();
    });
  }
}

function hookShowTab(){
  function tryHook(){
    if(typeof window.showTab !== "function") return false;
    if(window.showTab.__transitHooked) return true;
    var orig = window.showTab;
    window.showTab = function(name){
      orig.apply(this, arguments);
      if(name === "transit"){
        ensureTransitUI();
        window.reloadTransitAdmin();
      }
    };
    window.showTab.__transitHooked = true;
    return true;
  }
  if(tryHook()) return;
  var n = 0;
  var t = setInterval(function(){
    n++;
    if(tryHook() || n > 40) clearInterval(t);
  }, 200);
}

function boot(){
  ensureTransitUI();
  hookShowTab();
  console.log("transit_admin.js ready OK");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
setInterval(ensureTransitUI, 2000);
