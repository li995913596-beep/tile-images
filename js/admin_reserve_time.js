/**
 * 留货时间 + 超过30天提醒 + 修改留货（数量/时间/客户）
 * 新留货写入 at(ISO)；旧记录无时间显示「无时间」，不计入超期
 * 修改数量时：增加从可售扣，减少退回可售
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

/** ISO / Date → datetime-local value (YYYY-MM-DDTHH:mm) */
function toDatetimeLocalValue(at){
  const d = parseReserveAt(at) || new Date();
  function p(n){ return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}

/** datetime-local value → ISO string */
function fromDatetimeLocalValue(val){
  if(!val) return new Date().toISOString();
  const d = new Date(val);
  if(isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function hasActiveReserve(list){
  if(!Array.isArray(list)) return false;
  return list.some(r => r && Number(r.qty || 0) > 0);
}

function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

async function writeLog(type, data, qty, customer, extra){
  try {
    var payload = {
      timestamp: serverTimestamp(),
      type: type,
      code: data.code || "",
      spec: data.spec || "",
      color: data.color || "",
      warehouse: data.warehouse || "",
      qty: qty,
      customer: customer || ""
    };
    if(extra && typeof extra === "object"){
      Object.keys(extra).forEach(function(k){ payload[k] = extra[k]; });
    }
    await addDoc(collection(db, "logs"), payload);
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

function closeEditModal(){
  var m = document.getElementById("reserveEditModal");
  if(m) m.remove();
}

function openEditModal(opts){
  closeEditModal();
  var overlay = document.createElement("div");
  overlay.id = "reserveEditModal";
  overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.45);display:flex;align-items:center;justify-content:center;padding:16px;";
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:14px;width:100%;max-width:420px;box-shadow:0 20px 50px rgba(0,0,0,0.2);overflow:hidden;">' +
      '<div style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:700;color:#1f2937;font-size:15px;">修改留货</div>' +
      '<div style="padding:16px;">' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:12px;line-height:1.5;">编号 <b style="color:#0f172a;">' + esc(opts.code) + '</b> · 色号 ' + esc(opts.color || "-") + ' · ' + esc(opts.warehouse || "-") + '</div>' +
        '<label style="display:block;font-size:13px;color:#374151;margin-bottom:4px;">客户名</label>' +
        '<input id="re_edit_customer" value="' + esc(opts.customer) + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:12px;">' +
        '<label style="display:block;font-size:13px;color:#374151;margin-bottom:4px;">留货数量</label>' +
        '<input id="re_edit_qty" type="number" step="0.01" min="0.01" value="' + esc(opts.qty) + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:4px;">' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:12px;">当前可售库存：<b>' + opts.freeStock + '</b>（增加数量时从可售扣）</div>' +
        '<label style="display:block;font-size:13px;color:#374151;margin-bottom:4px;">留货时间</label>' +
        '<input id="re_edit_at" type="datetime-local" value="' + esc(opts.atLocal) + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:6px;">' +
        '<div style="font-size:12px;color:#94a3b8;margin-bottom:14px;">可改成业务员实际要求留货的日期，用于天数统计</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
          '<button type="button" id="re_edit_cancel" style="padding:8px 16px;border:1px solid #d1d5db;background:#fff;color:#374151;border-radius:8px;cursor:pointer;font-size:13px;">取消</button>' +
          '<button type="button" id="re_edit_save" style="padding:8px 18px;border:none;background:#2563eb;color:#fff;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">保存</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener("click", function(e){
    if(e.target === overlay) closeEditModal();
  });
  $("re_edit_cancel").onclick = closeEditModal;
  $("re_edit_save").onclick = function(){ opts.onSave(); };
  setTimeout(function(){
    var q = $("re_edit_qty");
    if(q) q.focus();
  }, 50);
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
          '<td style="padding:10px 12px;">' + esc(i.code || "") + '</td>' +
          '<td style="padding:10px 12px;">' + esc(i.spec || "-") + '</td>' +
          '<td style="padding:10px 12px;">' + esc(i.color || "-") + '</td>' +
          '<td style="padding:10px 12px;font-weight:600;">' + r.qty + '</td>' +
          '<td style="padding:10px 12px;">' + esc(r.customer || "") + '</td>' +
          '<td style="padding:10px 12px;font-size:12px;color:#475569;">' + fmtReserveAt(r.at) + '</td>' +
          '<td style="padding:10px 12px;">' + daysHtml + '</td>' +
          '<td style="padding:10px 12px;white-space:nowrap;">' +
            '<button type="button" onclick="editReserve(\'' + d.id + '\',' + index + ')" style="padding:5px 10px;margin-right:6px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:8px;cursor:pointer;font-size:12px;">修改</button>' +
            '<button type="button" onclick="deleteReserve(\'' + d.id + '\',' + index + ')" style="padding:5px 10px;background:#fdecea;color:#e74c3c;border:none;border-radius:8px;cursor:pointer;font-size:12px;">取消</button>' +
          '</td>' +
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

window.editReserve = async function(id, index){
  try {
    const ref = doc(db, "inventory", id);
    const snap = await getDoc(ref);
    if(!snap.exists()) return alert("记录不存在");
    const data = snap.data();
    const list = Array.isArray(data.reservedList) ? data.reservedList.slice() : [];
    const item = list[index];
    if(!item || !(Number(item.qty || 0) > 0)) return alert("留货记录不存在");

    const freeStock = Math.max(0, Number(data.stock || 0));
    const oldQty = Number(item.qty || 0);

    openEditModal({
      code: data.code || "",
      color: data.color || "",
      warehouse: data.warehouse || "",
      customer: item.customer || "",
      qty: oldQty,
      freeStock: freeStock,
      atLocal: toDatetimeLocalValue(item.at),
      onSave: async function(){
        try {
          const newCustomer = (($("re_edit_customer") && $("re_edit_customer").value) || "").trim();
          const newQty = Number(($("re_edit_qty") && $("re_edit_qty").value) || 0);
          const atVal = ($("re_edit_at") && $("re_edit_at").value) || "";
          if(!newQty || newQty <= 0) return alert("留货数量必须大于 0");

          const delta = Number((newQty - oldQty).toFixed(4));
          if(delta > 0 && delta > freeStock){
            return alert("可售库存不足，最多可再留 " + freeStock + "（当前可售 " + freeStock + "）");
          }

          const newAt = fromDatetimeLocalValue(atVal);
          const newStock = Number((freeStock - delta).toFixed(4));

          list[index] = {
            customer: newCustomer,
            qty: newQty,
            at: newAt,
            time: item.time || null
          };

          await updateDoc(ref, {
            stock: newStock < 0 ? 0 : newStock,
            reservedList: list,
            lastUpdate: serverTimestamp()
          });

          var logNote = "改数量 " + oldQty + "→" + newQty;
          if(newCustomer !== (item.customer || "")) logNote += "；客户 " + (item.customer || "空") + "→" + (newCustomer || "空");
          if(fmtReserveAt(item.at) !== fmtReserveAt(newAt)) logNote += "；时间 " + fmtReserveAt(item.at) + "→" + fmtReserveAt(newAt);

          await writeLog("修改留货", data, newQty, newCustomer, {
            note: logNote,
            oldQty: oldQty,
            source: "修改留货"
          });

          closeEditModal();
          alert("已保存修改\n数量：" + oldQty + " → " + newQty +
            (delta !== 0 ? "\n可售库存：" + freeStock + " → " + (newStock < 0 ? 0 : newStock) : "") +
            "\n时间：" + fmtReserveAt(newAt));
          if(window.loadReserve) window.loadReserve();
        } catch(err){
          console.error(err);
          alert("保存失败：" + ((err && err.message) || err));
        }
      }
    });
  } catch(e){
    console.error(e);
    alert("打开修改失败：" + ((e && e.message) || e));
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
      customer: customer,
      qty: qty,
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
  console.log("admin_reserve_time.js ready v20260821a: edit qty/time/customer");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
