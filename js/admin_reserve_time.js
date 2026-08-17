/**
 * 留货时间 + 超过30天提醒（后台清单）
 * 新留货写入 at(ISO)；旧记录无时间显示「无时间」，不计入超期
 */
import { db } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, updateDoc, addDoc, deleteDoc,
  serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

function parseReserveAt(at){
  if(at == null || at === "") return null;
  try {
    if(at.toDate) return at.toDate();
    const d = new Date(at);
    return isNaN(d.getTime()) ? null : d;
  } catch(e){ return null; }
}

function reserveDays(at){
  const d = parseReserveAt(at);
  if(!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function fmtReserveAt(at){
  const d = parseReserveAt(at);
  if(!d) return "无时间";
  function p(n){ return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

function hasActiveReserve(list){
  if(!Array.isArray(list)) return false;
  return list.some(r => r && Number(r.qty || 0) > 0);
}

async function writeLog(type, data, qty, customer){
  try {
    await addDoc(collection(db, "logs"), {
      timestamp: serverTimestamp(),
      type,
      code: data.code || "",
      spec: data.spec || "",
      color: data.color || "",
      warehouse: data.warehouse || "",
      qty,
      customer: customer || ""
    });
  } catch(e){ console.warn("log failed", e); }
}

function ensureReserveTableHead(){
  const tbody = $("reserveList");
  if(!tbody) return;
  const table = tbody.closest("table");
  if(!table) return;
  const thead = table.querySelector("thead tr");
  if(!thead) return;
  if(thead.dataset.timeCol === "1") return;
  thead.innerHTML =
    '<th style="padding:10px 12px;text-align:left;">编号</th>' +
    '<th style="padding:10px 12px;text-align:left;">规格</th>' +
    '<th style="padding:10px 12px;text-align:left;">色号</th>' +
    '<th style="padding:10px 12px;text-align:left;">留货数量</th>' +
    '<th style="padding:10px 12px;text-align:left;">客户名</th>' +
    '<th style="padding:10px 12px;text-align:left;">留货时间</th>' +
    '<th style="padding:10px 12px;text-align:left;">已留天数</th>' +
    '<th style="padding:10px 12px;text-align:left;">操作</th>';
  thead.dataset.timeCol = "1";
}

function ensureOverdueBox(){
  const list = $("reserveList");
  if(!list) return null;
  const wrap = list.closest("div");
  if(!wrap) return null;
  let box = document.getElementById("reserveOverdueBox");
  if(!box){
    box = document.createElement("div");
    box.id = "reserveOverdueBox";
    box.style.cssText = "display:none;margin:0 0 12px;padding:12px 14px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px;line-height:1.5;";
    wrap.parentNode.insertBefore(box, wrap);
  }
  return box;
}

window.loadReserve = async function(){
  const tbody = $("reserveList");
  if(!tbody) return;
  ensureReserveTableHead();
  tbody.innerHTML = '<tr><td colspan="8" style="padding:12px;color:#888;">加载中…</td></tr>';
  try {
    const snap = await getDocs(query(collection(db, "inventory"), where("reservedList", "!=", [])));
    tbody.innerHTML = "";
    let has = false;
    const overdue = [];
    snap.forEach(d => {
      const i = d.data();
      (i.reservedList || []).forEach((r, index) => {
        if(!r || !(Number(r.qty || 0) > 0)) return;
        has = true;
        const days = reserveDays(r.at);
        const isOver = days != null && days >= 30;
        if(isOver){
          overdue.push({
            code: i.code || "",
            customer: r.customer || "未填",
            qty: r.qty,
            days
          });
        }
        const rowStyle = isOver
          ? "border-bottom:1px solid #fecaca;background:#fef2f2;"
          : "border-bottom:1px solid #eef2f6;";
        const daysHtml = days == null
          ? '<span style="color:#888;">—</span>'
          : (isOver
            ? '<span style="color:#b91c1c;font-weight:700;">' + days + ' 天 ⚠</span>'
            : '<span>' + days + ' 天</span>');
        tbody.innerHTML +=
          '<tr style="' + rowStyle + '">' +
          '<td style="padding:10px 12px;">' + (i.code || "") + '</td>' +
          '<td style="padding:10px 12px;">' + (i.spec || "-") + '</td>' +
          '<td style="padding:10px 12px;">' + (i.color || "-") + '</td>' +
          '<td style="padding:10px 12px;font-weight:600;">' + r.qty + '</td>' +
          '<td style="padding:10px 12px;">' + (r.customer || "") + '</td>' +
          '<td style="padding:10px 12px;font-size:12px;color:#475569;">' + fmtReserveAt(r.at) + '</td>' +
          '<td style="padding:10px 12px;">' + daysHtml + '</td>' +
          '<td style="padding:10px 12px;"><button type="button" onclick="deleteReserve(\'' + d.id + '\',' + index + ')" style="padding:6px 12px;background:#fdecea;color:#e74c3c;box-shadow:none;border:none;border-radius:8px;cursor:pointer;">取消留货</button></td>' +
          '</tr>';
      });
    });
    if(!has){
      tbody.innerHTML = '<tr><td colspan="8" style="padding:16px;text-align:center;color:#888;">暂无留货记录</td></tr>';
    }
    const box = ensureOverdueBox();
    if(box){
      if(overdue.length){
        box.style.display = "block";
        box.innerHTML =
          '<div style="font-weight:700;margin-bottom:6px;">⚠ 有 ' + overdue.length + ' 笔留货已超过 30 天，请尽快处理</div>' +
          overdue.slice(0, 12).map(o =>
            '· ' + o.code + ' / ' + o.customer + ' ×' + o.qty + '（已留 ' + o.days + ' 天）'
          ).join('<br>') +
          (overdue.length > 12 ? '<br>…还有 ' + (overdue.length - 12) + ' 笔' : '');
      } else {
        box.style.display = "none";
        box.innerHTML = "";
      }
    }
  } catch(e){
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="8" style="padding:16px;color:#b91c1c;">加载失败：' + ((e && e.message) || e) + '</td></tr>';
  }
};

window.reserveStock = async function(id){
  try {
    const ref = doc(db, "inventory", id);
    const snap = await getDoc(ref);
    if(!snap.exists()) return alert("记录不存在");
    const data = snap.data();
    const qty = Number(($("re_q_" + id) && $("re_q_" + id).value) || 0);
    const customer = (($("re_c_" + id) && $("re_c_" + id).value) || "").trim();
    if(!qty || qty <= 0) return alert("请输入正确数量");
    if(qty > data.stock) return alert("库存不足");
    const list = Array.isArray(data.reservedList) ? [...data.reservedList] : [];
    list.push({
      customer,
      qty,
      at: new Date().toISOString()
    });
    await updateDoc(ref, {
      stock: Number((data.stock - qty).toFixed(4)),
      reservedList: list,
      lastUpdate: serverTimestamp()
    });
    await writeLog("留货", data, qty, customer);
    alert(customer ? ("留货成功：" + customer + " " + qty) : ("留货成功：" + qty));
    if(window.loadReserve) window.loadReserve();
    if($("re_search") && $("re_search").value.trim() && window.searchReserve) window.searchReserve();
  } catch(e){
    console.error(e);
    alert("留货失败：" + (e.message || e));
  }
};

window.exportReserve = async function(){
  try {
    if(typeof XLSX === "undefined") return alert("XLSX 未加载");
    const snap = await getDocs(query(collection(db, "inventory"), where("reservedList", "!=", [])));
    const rows = [];
    snap.forEach(d => {
      const i = d.data();
      (i.reservedList || []).forEach(r => {
        if(!r || !(Number(r.qty || 0) > 0)) return;
        const days = reserveDays(r.at);
        rows.push({
          "编号": i.code || "",
          "规格": i.spec || "",
          "留货数量": Number(r.qty || 0),
          "客户名": r.customer || "",
          "留货时间": fmtReserveAt(r.at),
          "已留天数": days == null ? "" : days,
          "是否超30天": days != null && days >= 30 ? "是" : ""
        });
      });
    });
    if(!rows.length) return alert("当前没有留货记录");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows, {
        header: ["编号", "规格", "留货数量", "客户名", "留货时间", "已留天数", "是否超30天"]
      }),
      "留货清单"
    );
    XLSX.writeFile(wb, "留货信息_" + new Date().toISOString().split("T")[0] + ".xlsx");
    alert("导出成功！");
  } catch(err){
    alert("导出失败：" + (err.message || err));
  }
};

window.deleteReserve = async function(id, index){
  try {
    const ref = doc(db, "inventory", id);
    const snap = await getDoc(ref);
    if(!snap.exists()) return alert("记录不存在");
    const data = snap.data();
    const list = Array.isArray(data.reservedList) ? [...data.reservedList] : [];
    const removed = list[index];
    if(!removed) return alert("留货记录不存在");
    list.splice(index, 1);
    const backQty = Number(removed.qty || 0);
    const newStock = Number((Number(data.stock || 0) + backQty).toFixed(4));
    if(newStock <= 0 && !hasActiveReserve(list)) await deleteDoc(ref);
    else await updateDoc(ref, { reservedList: list, stock: newStock, lastUpdate: serverTimestamp() });
    await writeLog("取消留货", data, backQty, removed.customer || "");
    alert(removed.customer ? ("已取消留货：" + removed.customer + " " + backQty) : ("已取消留货：" + backQty));
    if(window.loadReserve) window.loadReserve();
  } catch(e){
    console.error(e);
    alert("取消失败：" + (e.message || e));
  }
};

function hookShowTab(){
  if(typeof window.showTab !== "function") return false;
  if(window.showTab.__reserveTimeHooked) return true;
  const orig = window.showTab;
  window.showTab = function(name){
    orig.apply(this, arguments);
    if(name === "reserve"){
      setTimeout(function(){
        ensureReserveTableHead();
        if(window.loadReserve) window.loadReserve();
      }, 80);
    }
  };
  window.showTab.__reserveTimeHooked = true;
  return true;
}

function boot(){
  hookShowTab();
  let n = 0;
  const t = setInterval(function(){
    n++;
    if(hookShowTab() || n > 40) clearInterval(t);
  }, 200);
  setTimeout(function(){
    if($("reserveList") && window.loadReserve) window.loadReserve();
  }, 1500);
  console.log("admin_reserve_time.js ready v20260817e: color+time cols");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
