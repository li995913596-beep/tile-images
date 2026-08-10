/**
 * 后台在途管理 — 按提单分组表格
 * 1A 柜号只在同柜首行  2B 默认只展开第一个提单  3A+B 数量加粗+浅绿底
 */
import { auth, db } from "./firebase.js";
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { renderAdminList } from "./transit_status.js?v=20260810b";

function $(id){ return document.getElementById(id); }

function fmtTime(v){
  if(!v) return "-";
  try {
    var d = v.toDate ? v.toDate() : new Date(v);
    if(isNaN(d.getTime())) return "-";
    function p(n){ return String(n).padStart(2, "0"); }
    return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  } catch(e){ return "-"; }
}

function normHeader(h){
  return String(h || "").trim().toLowerCase().replace(/\s+/g, "");
}

function esc(s){
  var t = String(s == null ? "" : s);
  var amp = String.fromCharCode(38);
  var lt = String.fromCharCode(60);
  var gt = String.fromCharCode(62);
  var quot = String.fromCharCode(34);
  t = t.split(amp).join(amp + "amp;");
  t = t.split(quot).join(amp + "quot;");
  t = t.split(lt).join(amp + "lt;");
  t = t.split(gt).join(amp + "gt;");
  return t;
}

var HEADER_MAP = {
  "提单号": "blNo", "bl": "blNo", "blno": "blNo", "提单": "blNo",
  "柜号": "containerNo", "集装箱号": "containerNo", "containerno": "containerNo", "container": "containerNo",
  "型号": "code", "编号": "code", "code": "code",
  "色号": "color", "color": "color",
  "规格": "spec", "spec": "spec", "size": "spec",
  "备注": "remark", "remark": "remark", "note": "remark",
  "数量": "qty", "qty": "qty", "quantity": "qty",
  "预计到港日期": "eta", "预计到港": "eta", "到港日期": "eta", "到港": "eta", "eta": "eta",
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
      var n = Number(String(v).replace(/,/g, "").replace(/[^\d.-]/g, ""));
      out[field] = isNaN(n) ? 0 : n;
      if(field === "qty" && isNaN(Number(String(v).replace(/,/g, "")))){
        var raw = String(v).trim();
        if(raw && !out.remark) out.remark = raw;
      }
    } else if(field === "eta"){
      if(typeof v === "number" && v > 20000 && v < 80000 && window.XLSX && XLSX.SSF){
        try {
          var d = XLSX.SSF.parse_date_code(v);
          out.eta = d ? (d.y + "-" + String(d.m).padStart(2,"0") + "-" + String(d.d).padStart(2,"0")) : String(v);
        } catch(e){ out.eta = String(v); }
      } else if(Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())){
        out.eta = v.getFullYear() + "-" + String(v.getMonth()+1).padStart(2,"0") + "-" + String(v.getDate()).padStart(2,"0");
      } else {
        out.eta = String(v == null ? "" : v).trim();
      }
    } else if(field === "color" || field === "code" || field === "spec" || field === "remark" || field === "blNo" || field === "containerNo" || field === "brand" || field === "colorName" || field === "absorption" || field === "weight"){
      if(Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())){
        out[field] = v.getFullYear() + "-" + String(v.getMonth()+1).padStart(2,"0") + "-" + String(v.getDate()).padStart(2,"0");
      } else {
        out[field] = String(v == null ? "" : v).trim();
      }
    } else {
      out[field] = String(v == null ? "" : v).trim();
    }
  });
  return out;
}

window.importTransitExcel = async function(){
  try {
    if(!auth.currentUser) return alert("请先登录");
    var fileEl = $("transitExcel");
    if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("请先选择 Excel 文件");
    if(typeof XLSX === "undefined") return alert("XLSX 未加载，请强制刷新页面 (Ctrl+Shift+R)");

    var wb = XLSX.read(await fileEl.files[0].arrayBuffer(), { type: "array", cellDates: false });
    var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    if(!rows.length) return alert("Excel 没有数据行");

    var lastBl = "", lastContainer = "", lastEta = "";
    var ok = 0, skip = 0;
    var errors = [];

    for(var i = 0; i < rows.length; i++){
      var item = rowFromExcel(rows[i]);
      if(item.blNo) lastBl = item.blNo; else item.blNo = lastBl;
      if(item.containerNo) lastContainer = item.containerNo; else item.containerNo = lastContainer;
      if(item.eta) lastEta = item.eta; else item.eta = lastEta;
      if(!item.code){ skip++; continue; }
      if(item.color != null) item.color = String(item.color).trim();
      try {
        await addDoc(collection(db, "in_transit"), Object.assign({}, item, {
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }));
        ok++;
      } catch(e){
        console.error("row", i+2, e);
        skip++;
        if(errors.length < 3) errors.push((e && e.message) || String(e));
      }
    }

    var msg = "导入完成：成功 " + ok + " 条";
    if(skip) msg += "，跳过 " + skip + " 条";
    msg += "\n（空柜号/提单号已按「同上」自动填充）";
    if(errors.length) msg += "\n错误示例：" + errors.join("；");
    if(ok === 0 && errors.length) msg += "\n若是权限错误，请在 Firebase 规则允许 in_transit 写入";
    alert(msg);
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
    alert("已新增\n同一柜号可继续新增其他型号");
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
    if(!box) return alert("找不到预定编辑区，请先点「编辑」展开");
    var list = [];
    var incomplete = 0;
    box.querySelectorAll("[data-res-row]").forEach(function(row){
      var qtyEl = row.querySelector(".res-qty");
      var cusEl = row.querySelector(".res-customer");
      var qty = Number((qtyEl && qtyEl.value) || 0);
      var customer = ((cusEl && cusEl.value) || "").trim();
      if(qty > 0 && customer){
        list.push({ qty: qty, customer: customer });
      } else if(qty > 0 || customer){
        incomplete++;
      }
    });
    if(incomplete) return alert("有 " + incomplete + " 行预定不完整（数量和客户名都要填）");
    var total = list.reduce(function(s, r){ return s + Number(r.qty || 0); }, 0);
    var tip = list.length
      ? ("共 " + list.length + " 人预定，合计 " + total + "：\n" + list.map(function(r){ return r.customer + " ×" + r.qty; }).join("\n"))
      : "将清空该编号的全部预定";
    if(!confirm("确认保存预定？\n" + tip)) return;
    await updateDoc(doc(db, "in_transit", id), {
      reservations: list,
      updatedAt: serverTimestamp()
    });
    alert(list.length ? ("预定已保存（" + list.length + " 人）") : "已清空预定");
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } catch(e){
    console.error(e);
    alert("保存失败：" + ((e && e.message) || e));
  }
};

window.addResRow = function(id){
  var box = $("res_box_" + id);
  if(!box) return alert("请先点「编辑」展开预定区域");
  var div = document.createElement("div");
  div.setAttribute("data-res-row", "1");
  div.style.cssText = "display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap;align-items:center;";
  var n = box.querySelectorAll("[data-res-row]").length + 1;
  div.innerHTML =
    '<span style="font-size:11px;color:#64748b;min-width:36px;">#' + n + "</span>" +
    '<input class="res-qty" type="number" placeholder="数量" style="width:80px;padding:4px 6px;border:1px solid #d1d5db;border-radius:6px;">' +
    '<input class="res-customer" placeholder="客户名 / 业务员" style="flex:1;min-width:120px;padding:4px 6px;border:1px solid #d1d5db;border-radius:6px;">' +
    '<button type="button" style="padding:4px 10px;border:1px solid #fecaca;background:#fee2e2;color:#b91c1c;border-radius:6px;cursor:pointer;">删</button>';
  div.querySelector("button").onclick = function(){ div.remove(); };
  box.appendChild(div);
  var cus = div.querySelector(".res-customer");
  if(cus) cus.focus();
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
    filter.onchange = function(){ window.reloadTransitAdmin(); };
    filter.__bound = true;
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
