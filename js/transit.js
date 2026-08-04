/**
 * 前台：在途货物列表（只读）
 * 默认显示 在途 + 已到港；可看历史
 */
import { db } from "./firebase.js";
import {
  collection, getDocs, query, limit
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

function statusBadge(s){
  const map = {
    "在途": "badge-zt",
    "已到港": "badge-dg",
    "已入库": "badge-rk",
    "取消": "badge-qx"
  };
  const cls = map[s] || "badge-rk";
  return '<span class="badge '+cls+'">'+(s||"-")+'</span>';
}

function renderList(list){
  const box = $("tResult");
  const hint = $("tHint");
  if(!list.length){
    box.innerHTML = '<div class="empty">暂无数据</div>';
    if(hint) hint.textContent = "";
    return;
  }
  let maxU = 0;
  list.forEach(r => {
    const t = r.updatedAt && r.updatedAt.toDate ? r.updatedAt.toDate().getTime() : (r.updatedAt ? new Date(r.updatedAt).getTime() : 0);
    if(t > maxU) maxU = t;
  });
  if(hint){
    hint.textContent = "共 "+list.length+" 条" + (maxU ? " · 数据最近更新："+fmtTime(maxU) : "");
  }

  box.innerHTML = "";
  list.forEach(item => {
    const card = document.createElement("div");
    card.className = "transit-card";
    const reserves = Array.isArray(item.reservations) ? item.reservations.filter(x => x && Number(x.qty)>0) : [];
    let reserveHtml = "";
    if(reserves.length){
      const lines = reserves.map(r => {
        const q = Number(r.qty||0);
        const c = (r.customer||"未填客户").toString();
        return c + " × " + q;
      }).join("；");
      reserveHtml = '<div class="reserve-box">已预定：'+lines+'</div>';
    }
    card.innerHTML =
      '<div class="code">'+statusBadge(item.status)+' '+(item.code||"-")+'</div>'+
      '<div class="meta">'+
        '规格 '+(item.spec||"-")+' · 色号 '+(item.color||"-")+' · 数量 <b>'+(item.qty??"-")+'</b><br>'+
        '柜号 '+(item.containerNo||"-")+' · 提单 '+(item.blNo||"-")+'<br>'+
        '预计到港 '+(item.eta||"未填")+
        (item.remark ? '<br>备注 '+(item.remark) : '')+
      '</div>'+
      reserveHtml+
      '<div class="updated">更新于 '+fmtTime(item.updatedAt)+'</div>';
    box.appendChild(card);
  });
}

async function loadAll(){
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

function filterList(all, statusMode, keyword){
  const kw = (keyword||"").trim().toLowerCase();
  return all.filter(item => {
    const st = item.status || "在途";
    if(statusMode === "active"){
      if(st !== "在途" && st !== "已到港") return false;
    } else if(statusMode === "history"){
      if(st !== "已入库" && st !== "取消") return false;
    } else if(statusMode !== "all"){
      if(st !== statusMode) return false;
    }
    if(!kw) return true;
    const blob = [item.code, item.spec, item.color, item.containerNo, item.blNo, item.remark]
      .map(x => String(x||"").toLowerCase()).join(" ");
    return blob.includes(kw);
  });
}

let cache = null;

async function refresh(){
  const box = $("tResult");
  box.innerHTML = '<div class="empty">加载中…</div>';
  try {
    if(!cache) cache = await loadAll();
    const statusMode = ($("tStatus") && $("tStatus").value) || "active";
    const kw = ($("tSearch") && $("tSearch").value) || "";
    renderList(filterList(cache, statusMode, kw));
  } catch(e){
    console.error(e);
    box.innerHTML = '<div class="empty">加载失败：'+((e&&e.message)||e)+'</div>';
  }
}

function boot(){
  const btn = $("tBtnSearch");
  const all = $("tBtnAll");
  const input = $("tSearch");
  const sel = $("tStatus");
  if(btn) btn.onclick = () => { cache = null; refresh(); };
  if(all) all.onclick = () => {
    if(input) input.value = "";
    if(sel) sel.value = "active";
    cache = null;
    refresh();
  };
  if(input) input.addEventListener("keydown", e => { if(e.key==="Enter"){ cache=null; refresh(); }});
  if(sel) sel.onchange = () => refresh();
  refresh();
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
