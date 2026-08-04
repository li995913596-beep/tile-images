/**
 * 后台：在途货物管理
 * Excel 导入 + 手动新增 + 改状态/到港/备注/预定
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
    if(isNaN(d.getTime())) return String(v);
    const p = n => String(n).padStart(2,"0");
    return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes());
  } catch(e){ return "-"; }
}

function normHeader(h){
  return String(h||"").trim().toLowerCase().replace(/\s+/g,"");
}

const HEADER_MAP = {
  "提单号": "blNo", "bl": "blNo", "blno": "blNo", "提单": "blNo",
  "柜号": "containerNo", "集装箱号": "containerNo", "containerno": "containerNo", "container": "containerNo",
  "型号": "code", "编号": "code", "code": "code",
  "色号": "color", "color": "color",
  "规格": "spec", "spec": "spec", "size": "spec",
  "备注": "remark", "remark": "remark", "note": "remark",
  "数量": "qty", "qty": "qty", "quantity": "qty",
  "预计到港日期": "eta", "预计到港": "eta", "到港日期": "eta", "eta": "eta",
  "吸水率": "absorption",
  "牌子": "brand", "品牌": "brand",
  "颜色": "colorName",
  "重量": "weight",
  "片数": "pieces"
};

function rowFromExcel(obj){
  const out = {
    blNo: "", containerNo: "", code: "", color: "", spec: "",
    remark: "", qty: 0, eta: "", absorption: "", brand: "",
    colorName: "", weight: "", pieces: "",
    status: "在途",
    reservations: []
  };
  Object.keys(obj).forEach(k => {
    const field = HEADER_MAP[normHeader(k)] || HEADER_MAP[String(k).trim()];
    if(!field) return;
    let v = obj[k];
    if(v == null) v = "";
    if(field === "qty" || field === "pieces"){
      const n = Number(String(v).replace(/,/g,""));
      out[field] = isNaN(n) ? 0 : n;
    } else if(field === "eta"){
      if(typeof v === "number" && window.XLSX && XLSX.SSF){
        try {
          const d = XLSX.SSF.parse_date_code(v);
          if(d) out.eta = d.y+"-"+String(d.m).padStart(2,"0")+"-"+String(d.d).padStart(2,"0");
          else out.eta = String(v);
        } catch(e){ out.eta = String(v); }
      } else {
        out.eta = String(v).trim();
      }
    } else {
      out[field] = String(v).trim();
    }
  });
  return out;
}

window.importTransitExcel = async function(){
  if(!auth.currentUser) return alert("请先登录");
  const fileEl = $("transitExcel");
  if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("请先选择 Excel 文件");
  if(typeof XLSX === "undefined") return alert("XLSX 库未加载");

  const file = fileEl.files[0];
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if(!rows.length) return alert("Excel 没有数据行");

  let ok = 0, skip = 0;
  for(const raw of rows){
    const item = rowFromExcel(raw);
    if(!item.code && !item.containerNo){ skip++; continue; }
    try {
      await addDoc(collection(db, "in_transit"), {
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      ok++;
    } catch(e){
      console.error(e);
      skip++;
    }
  }
  alert("导入完成：成功 "+ok+" 条"+(skip ? "，跳过 "+skip+" 条" : ""));
  fileEl.value = "";
  window.reloadTransitAdmin && window.reloadTransitAdmin();
};

window.addTransitManual = async function(){
  if(!auth.currentUser) return alert("请先登录");
  const code = (($("tm_code")&&$("tm_code").value)||"").trim();
  if(!code) return alert("请填写型号/编号");
  const item = {
    blNo: (($("tm_bl")&&$("tm_bl").value)||"").trim(),
    containerNo: (($("tm_container")&&$("tm_container").value)||"").trim(),
    code,
    color: (($("tm_color")&&$("tm_color").value)||"").trim(),
    spec: (($("tm_spec")&&$("tm_spec").value)||"").trim(),
    remark: (($("tm_remark")&&$("tm_remark").value)||"").trim(),
    qty: Number(($("tm_qty")&&$("tm_qty").value)||0) || 0,
    eta: (($("tm_eta")&&$("tm_eta").value)||"").trim(),
    absorption: "",
    brand: "",
    colorName: "",
    weight: "",
    pieces: "",
    status: (($("tm_status")&&$("tm_status").value)||"在途"),
    reservations: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  try {
    await addDoc(collection(db, "in_transit"), item);
    alert("已新增");
    ["tm_bl","tm_container","tm_code","tm_color","tm_spec","tm_remark","tm_qty","tm_eta"].forEach(id=>{
      if($(id)) $(id).value = "";
    });
    window.reloadTransitAdmin && window.reloadTransitAdmin();
  } catch(e){
    alert("新增失败："+((e&&e.message)||e));
  }
};

window.updateTransitField = async function(id, field, value){
  if(!auth.currentUser) return alert("请先登录");
  try {
    const data = { updatedAt: serverTimestamp() };
    data[field] = value;
    await updateDoc(doc(db, "in_transit", id), data);
    window.reloadTransitAdmin && window.reloadTransitAdmin();
  } catch(e){
    alert("更新失败："+((e&&e.message)||e));
  }
};

window.saveTransitReservations = async function(id){
  if(!auth.currentUser) return alert("请先登录");
  const box = $("res_box_"+id);
  if(!box) return;
  const rows = box.querySelectorAll("[data-res-row]");
  const list = [];
  rows.forEach(row => {
    const qty = Number(row.querySelector(".res-qty")?.value || 0);
    const customer = (row.querySelector(".res-customer")?.value || "").trim();
    if(qty > 0 && customer) list.push({ qty, customer });
  });
  try {
    await updateDoc(doc(db, "in_transit", id), {
      reservations: list,
      updatedAt: serverTimestamp()
    });
    alert("预定已保存");
    window.reloadTransitAdmin && window.reloadTransitAdmin();
  } catch(e){
    alert("保存失败："+((e&&e.message)||e));
  }
};

window.addResRow = function(id){
  const box = $("res_box_"+id);
  if(!box) return;
  const div = document.createElement("div");
  div.setAttribute("data-res-row", "1");
  div.style.cssText = "display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap;";
  div.innerHTML =
    '<input class="res-qty" type="number" placeholder="数量" style="width:80px;padding:4px 6px;">'+'
    <input class="res-customer" placeholder="客户名" style="flex:1;min-width:100px;padding:4px 6px;">'+'
    <button type="button" style="padding:4px 8px;">删</button>';
  div.querySelector("button").onclick = () => div.remove();
  box.appendChild(div);
};

window.deleteTransitItem = async function(id){
  if(!auth.currentUser) return alert("请先登录");
  if(!confirm("确定删除这条在途记录？\n（一般建议改成「已入库」或「取消」作历史，而不是删除）")) return;
  try {
    await deleteDoc(doc(db, "in_transit", id));
    alert("已删除");
    window.reloadTransitAdmin && window.reloadTransitAdmin();
  } catch(e){
    alert("删除失败："+((e&&e.message)||e));
  }
};

async function loadList(){
  const snap = await getDocs(query(collection(db, "in_transit"), limit(2000)));
  const list = [];
  snap.forEach(d => list.push({ id: d.id, ...d.data() }));
  list.sort((a,b) => {
    const ta = a.updatedAt && a.updatedAt.toDate ? a.updatedAt.toDate().getTime() : 0;
    const tb = b.updatedAt && b.updatedAt.toDate ? b.updatedAt.toDate().getTime() : 0;
    return tb - ta;
  });
  return list;
}

function renderAdminList(list){
  const box = $("transitList");
  if(!box) return;
  const filter = ($("transitFilter") && $("transitFilter").value) || "active";
  const kw = (($("transitSearch")&&$("transitSearch").value)||"").trim().toLowerCase();

  const filtered = list.filter(item => {
    const st = item.status || "在途";
    if(filter === "active" && st !== "在途" && st !== "已到港") return false;
    if(filter === "history" && st !== "已入库" && st !== "取消") return false;
    if(filter !== "active" && filter !== "history" && filter !== "all" && st !== filter) return false;
    if(!kw) return true;
    const blob = [item.code, item.spec, item.color, item.containerNo, item.blNo]
      .map(x => String(x||"").toLowerCase()).join(" ");
    return blob.includes(kw);
  });

  if(!filtered.length){
    box.innerHTML = '<div style="color:#666;padding:12px;">暂无数据</div>';
    return;
  }

  box.innerHTML = "";
  filtered.forEach(item => {
    const id = item.id;
    const reserves = Array.isArray(item.reservations) ? item.reservations : [];
    const card = document.createElement("div");
    card.style.cssText = "border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-bottom:10px;background:#fff;";
    card.innerHTML =
      '<div style="font-weight:700;font-size:15px;margin-bottom:6px;">'+(item.code||"-")+
        ' <span style="font-weight:400;color:#666;font-size:13px;">规格 '+(item.spec||"-")+' · 色号 '+(item.color||"-")+' · 数量 '+(item.qty??"-")+'</span></div>'+
      '<div style="font-size:13px;color:#555;margin-bottom:8px;">柜号 '+(item.containerNo||"-")+' · 提单 '+(item.blNo||"-")+' · 更新 '+fmtTime(item.updatedAt)+'</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">'+'
        <label style="font-size:13px;">状态 '+'
          <select data-field="status" style="padding:4px 6px;">'+'
            ["在途","已到港","已入库","取消"].map(s =>
              '<option value="'+s+'"'+(item.status===s?' selected':'')+'>'+s+'</option>'
            ).join("")+
          '</select></label>'+
        '<label style="font-size:13px;">到港 <input data-field="eta" value="'+(item.eta||"").replace(/"/g,"&quot;")+'"