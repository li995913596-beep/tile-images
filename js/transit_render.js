/**
 * 在途后台表格渲染（按提单分组）
 * - 按提单批量改到港时间
 * - 数量样式与主页搜索一致（圆角彩色徽章）
 */
import { db } from "./firebase.js";
import {
  doc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, query, limit, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

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

function pad2(n){ return String(n).padStart(2, "0"); }

function fmtTime(v){
  if(!v) return "";
  try {
    var d = v.toDate ? v.toDate() : new Date(v);
    if(isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  } catch(e){ return ""; }
}

function fmtEtaCN(eta){
  if(eta == null || eta === "") return "";
  if(Object.prototype.toString.call(eta) === "[object Date]" && !isNaN(eta.getTime())){
    return eta.getFullYear() + "年" + (eta.getMonth()+1) + "月" + eta.getDate() + "日";
  }
  var s = String(eta).trim();
  if(!s) return "";
  var d = null;
  if(/^\d+(\.\d+)?$/.test(s)){
    var n = Number(s);
    if(n > 20000 && n < 80000){
      d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
    }
  }
  if(!d){
    var m = s.match(/^(\d{4})[-\/年.](\d{1,2})[-\/月.](\d{1,2})/);
    if(m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  if(!d){
    var t = Date.parse(s);
    if(!isNaN(t)) d = new Date(t);
  }
  if(!d || isNaN(d.getTime())){
    if(/年.*月.*日/.test(s)) return s;
    return s.length > 24 ? s.slice(0, 16) : s;
  }
  return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

function fmtColor(c){
  if(c == null || c === "") return "";
  if(Object.prototype.toString.call(c) === "[object Date]" && !isNaN(c.getTime())){
    return c.getFullYear() + "-" + pad2(c.getMonth()+1) + "-" + pad2(c.getDate());
  }
  var s = String(c).trim();
  if(/GMT|UTC|标准时间|[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4}/.test(s)){
    var t = Date.parse(s);
    if(!isNaN(t)){
      var d = new Date(t);
      return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate());
    }
  }
  return s;
}

function qtyPill(qty){
  if(qty == null || qty === "") return "-";
  var n = Number(qty);
  var bg = "#22c55e";
  if(!isNaN(n)){
    if(n === 0) bg = "#ef4444";
    else if(n < 10) bg = "#f59e0b";
  }
  return '<span class="qty-pill" style="background:' + bg + ';">' + esc(String(qty)) + "</span>";
}

function groupByBL(list){
  var order = [];
  var map = {};
  list.forEach(function(item){
    var bl = (item.blNo && String(item.blNo).trim()) ? String(item.blNo).trim() : "(无提单号)";
    if(!map[bl]){ map[bl] = []; order.push(bl); }
    map[bl].push(item);
  });
  order.forEach(function(bl){
    map[bl].sort(function(a, b){
      var ca = String(a.containerNo || "");
      var cb = String(b.containerNo || "");
      if(ca !== cb) return ca < cb ? -1 : 1;
      return String(a.code || "").localeCompare(String(b.code || ""));
    });
  });
  return order.map(function(bl){ return { blNo: bl, items: map[bl] }; });
}

function ensureAdminTableStyle(){
  if(document.getElementById("transitAdminTableStyle")) return;
  var st = document.createElement("style");
  st.id = "transitAdminTableStyle";
  st.textContent =
    ".ta-bl{background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:12px;overflow:hidden;}" +
    ".ta-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 14px;cursor:pointer;background:#f8fafc;user-select:none;}" +
    ".ta-head:hover{background:#f1f5f9;}" +
    ".ta-head.open{background:#eff6ff;border-bottom:1px solid #e5e7eb;}" +
    ".ta-toggle{font-size:12px;color:#64748b;width:14px;}" +
    ".ta-title{font-weight:700;font-size:15px;color:#1e293b;}" +
    ".ta-meta{font-size:12px;color:#64748b;}" +
    ".ta-eta{font-size:13px;font-weight:700;color:#b45309;background:#fef3c7;padding:2px 8px;border-radius:6px;}" +
    ".ta-updated{font-size:12px;color:#64748b;}" +
    ".ta-head-actions{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center;}" +
    ".ta-head-actions input{padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;width:120px;}" +
    ".ta-head-actions button{padding:5px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#374151;cursor:pointer;font-size:12px;font-weight:600;}" +
    ".ta-head-actions .btn-eta{background:#fef3c7;color:#b45309;border-color:#fcd34d;}" +
    ".ta-head-actions .btn-del-bl{background:#fee2e2;color:#b91c1c;border-color:#fecaca;}" +
    ".ta-body{overflow-x:auto;}" +
    ".ta-table{width:100%;border-collapse:collapse;font-size:13px;min-width:720px;}" +
    ".ta-table th{text-align:left;padding:8px 10px;background:#f1f5f9;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0;white-space:nowrap;}" +
    ".ta-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#334155;}" +
    ".ta-table tr:hover td{background:#fafafa;}" +
    ".ta-qty{text-align:right;min-width:72px;}" +
    ".qty-pill{display:inline-block;font-size:15px;font-weight:700;padding:5px 12px;border-radius:10px;color:#fff;min-width:36px;text-align:center;}" +
    ".ta-code{font-weight:600;}" +
    ".ta-cno{color:#64748b;font-size:12px;white-space:nowrap;}" +
    ".ta-cno .btn-del-c{margin-left:6px;padding:2px 6px;font-size:11px;border-radius:4px;border:1px solid #fecaca;background:#fee2e2;color:#b91c1c;cursor:pointer;}" +
    ".ta-edit{padding:10px 12px;background:#f8fafc;border-top:1px dashed #e2e8f0;display:none;}" +
    ".ta-edit.open{display:block;}" +
    ".ta-actions button{margin-right:6px;margin-top:2px;padding:5px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#1f2937;cursor:pointer;font-size:12px;font-weight:600;}" +
    ".ta-actions .btn-edit{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;}" +
    ".ta-actions .btn-danger{background:#fee2e2;color:#b91c1c;border-color:#fecaca;}" +
    ".ta-actions .btn-primary{background:#2f7dd1;color:#fff;border:none;}" +
    ".ta-actions .btn-ok{background:#16a34a;color:#fff;border:none;}";
  document.head.appendChild(st);
}

async function deleteByIds(ids){
  if(!ids.length) return;
  for(var i = 0; i < ids.length; i += 400){
    var batch = writeBatch(db);
    ids.slice(i, i + 400).forEach(function(id){
      batch.delete(doc(db, "in_transit", id));
    });
    await batch.commit();
  }
}

async function updateByIds(ids, fields){
  if(!ids.length) return;
  for(var i = 0; i < ids.length; i += 400){
    var batch = writeBatch(db);
    ids.slice(i, i + 400).forEach(function(id){
      batch.update(doc(db, "in_transit", id), fields);
    });
    await batch.commit();
  }
}

async function collectIdsByBL(blNo){
  var snap = await getDocs(query(collection(db, "in_transit"), limit(2000)));
  var ids = [];
  snap.forEach(function(d){
    var data = d.data();
    var bl = (data.blNo && String(data.blNo).trim()) ? String(data.blNo).trim() : "(无提单号)";
    if(bl === blNo) ids.push(d.id);
  });
  return ids;
}

window.deleteTransitByBL = async function(blNo){
  try {
    if(!confirm("确定删除整个提单「" + blNo + "」下的全部记录？此操作不可恢复。")) return;
    var ids = await collectIdsByBL(blNo);
    if(!ids.length) return alert("没有找到该提单的记录");
    await deleteByIds(ids);
    alert("已删除提单「" + blNo + "」共 " + ids.length + " 条");
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } catch(e){
    console.error(e);
    alert("删除失败：" + ((e && e.message) || e));
  }
};

window.deleteTransitByContainer = async function(blNo, containerNo){
  try {
    var tip = "确定删除提单「" + blNo + "」下柜号「" + (containerNo || "(空)") + "」的全部编号？";
    if(!confirm(tip)) return;
    var snap = await getDocs(query(collection(db, "in_transit"), limit(2000)));
    var ids = [];
    snap.forEach(function(d){
      var data = d.data();
      var bl = (data.blNo && String(data.blNo).trim()) ? String(data.blNo).trim() : "(无提单号)";
      var c = String(data.containerNo || "");
      if(bl === blNo && c === String(containerNo || "")) ids.push(d.id);
    });
    if(!ids.length) return alert("没有找到该柜的记录");
    await deleteByIds(ids);
    alert("已删除柜号「" + (containerNo || "(空)") + "」共 " + ids.length + " 条");
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } catch(e){
    console.error(e);
    alert("删除失败：" + ((e && e.message) || e));
  }
};

window.updateTransitEtaByBL = async function(blNo, etaInput){
  try {
    var eta = (etaInput == null ? "" : String(etaInput)).trim();
    if(!confirm("确定把提单「" + blNo + "」下全部编号的预计到港改为：\n" + (eta || "(清空)") + " ？")) return;
    var ids = await collectIdsByBL(blNo);
    if(!ids.length) return alert("没有找到该提单的记录");
    await updateByIds(ids, { eta: eta, updatedAt: serverTimestamp() });
    alert("已更新提单「" + blNo + "」共 " + ids.length + " 条到港时间");
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } catch(e){
    console.error(e);
    alert("更新失败：" + ((e && e.message) || e));
  }
};

export function renderAdminList(list){
  var box = $("transitList");
  if(!box) return;
  ensureAdminTableStyle();

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

  var groups = groupByBL(filtered);
  box.innerHTML = "";

  groups.forEach(function(g, gi){
    var items = g.items;
    var containers = {};
    items.forEach(function(it){ containers[it.containerNo || "-"] = true; });

    var eta = "";
    var updated = "";
    for(var i = 0; i < items.length; i++){
      if(!eta && items[i].eta) eta = items[i].eta;
      var u = fmtTime(items[i].updatedAt);
      if(u && (!updated || u > updated)) updated = u;
    }
    var etaCN = fmtEtaCN(eta);
    var etaInputVal = "";
    if(eta){
      var cn = fmtEtaCN(eta);
      var m = String(cn).match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if(m) etaInputVal = m[1] + "-" + pad2(m[2]) + "-" + pad2(m[3]);
      else etaInputVal = String(eta).slice(0, 10);
    }

    var sec = document.createElement("div");
    sec.className = "ta-bl";
    var open = (gi === 0);

    var head = document.createElement("div");
    head.className = "ta-head" + (open ? " open" : "");
    head.innerHTML =
      '<span class="ta-toggle">' + (open ? "▼" : "▶") + "</span>" +
      '<span class="ta-title">提单 ' + esc(g.blNo) + "</span>" +
      '<span class="ta-meta">' + Object.keys(containers).length + " 柜 · " + items.length + " 行</span>" +
      (etaCN ? '<span class="ta-eta">预计到港：' + esc(etaCN) + "</span>" : "") +
      (updated ? '<span class="ta-updated">更新：' + esc(updated) + "</span>" : "") +
      '<span class="ta-head-actions">' +
      '<input type="text" class="eta-input" placeholder="YYYY-MM-DD" value="' + esc(etaInputVal) + '" title="按提单统一改到港">' +
      '<button type="button" class="btn-eta">保存到港</button>' +
      '<button type="button" class="btn-del-bl">删除整个提单</button>' +
      "</span>";

    var etaInput = head.querySelector(".eta-input");
    head.querySelector(".btn-eta").onclick = function(e){
      e.stopPropagation();
      window.updateTransitEtaByBL(g.blNo, etaInput.value);
    };
    etaInput.onclick = function(e){ e.stopPropagation(); };
    etaInput.onkeydown = function(e){
      e.stopPropagation();
      if(e.key === "Enter"){
        e.preventDefault();
        window.updateTransitEtaByBL(g.blNo, etaInput.value);
      }
    };
    head.querySelector(".btn-del-bl").onclick = function(e){
      e.stopPropagation();
      window.deleteTransitByBL(g.blNo);
    };

    var body = document.createElement("div");
    body.className = "ta-body";
    body.style.display = open ? "block" : "none";

    var table = document.createElement("table");
    table.className = "ta-table";
    table.innerHTML =
      "<thead><tr>" +
      "<th>柜号</th><th>型号</th><th>色号</th><th>规格</th>" +
      '<th style="text-align:right;">数量</th><th>状态</th><th>操作</th>' +
      "</tr></thead>";
    var tbody = document.createElement("tbody");
    var lastContainer = null;

    items.forEach(function(item){
      var id = item.id;
      var cNo = item.containerNo || "";
      var showC = (cNo !== lastContainer);
      lastContainer = cNo;
      var reserves = Array.isArray(item.reservations) ? item.reservations : [];
      var resText = reserves.length
        ? reserves.map(function(r){ return esc(r.customer) + "×" + (r.qty || 0); }).join("；")
        : "";

      var tr = document.createElement("tr");
      var cnoHtml = "";
      if(showC){
        cnoHtml = esc(cNo || "-") +
          ' <button type="button" class="btn-del-c" title="删除此柜全部编号">删柜</button>';
      }
      tr.innerHTML =
        '<td class="ta-cno">' + cnoHtml + "</td>" +
        '<td class="ta-code">' + esc(item.code || "") + "</td>" +
        "<td>" + esc(fmtColor(item.color)) + "</td>" +
        "<td>" + esc(item.spec || "") + "</td>" +
        '<td class="ta-qty">' + qtyPill(item.qty) + "</td>" +
        "<td>" + esc(item.status || "在途") +
        (resText ? '<div style="font-size:11px;color:#9a3412;margin-top:2px;">订:' + resText + "</div>" : "") +
        "</td>" +
        '<td class="ta-actions">' +
        '<button type="button" class="btn-edit">编辑</button>' +
        '<button type="button" class="btn-danger btn-del">删除</button>' +
        "</td>";
      tbody.appendChild(tr);

      if(showC){
        tr.querySelector(".btn-del-c").onclick = function(e){
          e.stopPropagation();
          window.deleteTransitByContainer(g.blNo, cNo);
        };
      }

      var trEdit = document.createElement("tr");
      var tdEdit = document.createElement("td");
      tdEdit.colSpan = 7;
      tdEdit.className = "ta-edit";
      var opts = ["在途", "已到港", "已入库", "取消"].map(function(s){
        return '<option value="' + s + '"' + (item.status === s ? " selected" : "") + ">" + s + "</option>";
      }).join("");
      tdEdit.innerHTML =
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">' +
        '<label style="font-size:12px;">状态 <select data-field="status" style="padding:4px 6px;">' + opts + "</select></label>" +
        '<label style="font-size:12px;">备注 <input data-field="remark" value="' + esc(item.remark || "") + '" style="min-width:120px;padding:4px 6px;"></label>' +
        '<button type="button" class="btn-primary btn-save-fields">保存</button>' +
        '<span style="font-size:11px;color:#9a3412;">到港请用提单标题上的「保存到港」统一改</span>' +
        "</div>" +
        '<div style="font-size:12px;font-weight:600;margin-bottom:4px;">预定（数量+客户名）</div>' +
        '<div id="res_box_' + id + '"></div>' +
        '<div style="margin-top:6px;">' +
        '<button type="button" class="btn-add-res">+ 添加预定</button> ' +
        '<button type="button" class="btn-ok btn-save-res">保存预定</button>' +
        "</div>";
      trEdit.appendChild(tdEdit);
      tbody.appendChild(trEdit);

      var resBox = tdEdit.querySelector("#res_box_" + id);
      reserves.forEach(function(r){
        var div = document.createElement("div");
        div.setAttribute("data-res-row", "1");
        div.style.cssText = "display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap;";
        div.innerHTML =
          '<input class="res-qty" type="number" value="' + Number(r.qty || 0) + '" style="width:80px;padding:4px 6px;">' +
          '<input class="res-customer" value="' + esc(r.customer) + '" style="flex:1;min-width:100px;padding:4px 6px;">' +
          '<button type="button" style="padding:4px 8px;color:#1f2937;">删</button>';
        div.querySelector("button").onclick = function(){ div.remove(); };
        resBox.appendChild(div);
      });

      tr.querySelector(".btn-edit").onclick = function(){
        tdEdit.classList.toggle("open");
      };
      tr.querySelector(".btn-del").onclick = function(){
        if(window.deleteTransitItem) window.deleteTransitItem(id);
      };
      tdEdit.querySelector(".btn-save-fields").onclick = async function(){
        try {
          await updateDoc(doc(db, "in_transit", id), {
            status: tdEdit.querySelector('[data-field="status"]').value,
            remark: tdEdit.querySelector('[data-field="remark"]').value.trim(),
            updatedAt: serverTimestamp()
          });
          alert("已保存");
          if(window.reloadTransitAdmin) window.reloadTransitAdmin();
        } catch(e){ alert((e && e.message) || e); }
      };
      tdEdit.querySelector(".btn-add-res").onclick = function(){
        if(window.addResRow) window.addResRow(id);
      };
      tdEdit.querySelector(".btn-save-res").onclick = function(){
        if(window.saveTransitReservations) window.saveTransitReservations(id);
      };
    });

    table.appendChild(tbody);
    body.appendChild(table);
    sec.appendChild(head);
    sec.appendChild(body);
    box.appendChild(sec);

    head.onclick = function(e){
      if(e.target.closest && e.target.closest("button, input")) return;
      var isOpen = body.style.display !== "none";
      body.style.display = isOpen ? "none" : "block";
      head.classList.toggle("open", !isOpen);
      head.querySelector(".ta-toggle").textContent = isOpen ? "▶" : "▼";
    };
  });
}

window.renderAdminList = renderAdminList;
