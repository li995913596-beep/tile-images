/**
 * 在途后台表格渲染（按提单分组）
 */
import { db } from "./firebase.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    ".ta-body{overflow-x:auto;}" +
    ".ta-table{width:100%;border-collapse:collapse;font-size:13px;min-width:720px;}" +
    ".ta-table th{text-align:left;padding:8px 10px;background:#f1f5f9;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0;white-space:nowrap;}" +
    ".ta-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#334155;}" +
    ".ta-table tr:hover td{background:#fafafa;}" +
    ".ta-qty{font-weight:800;font-size:16px;color:#166534;background:#dcfce7!important;text-align:right;min-width:64px;}" +
    ".ta-code{font-weight:600;}" +
    ".ta-cno{color:#64748b;font-size:12px;white-space:nowrap;}" +
    ".ta-edit{padding:10px 12px;background:#f8fafc;border-top:1px dashed #e2e8f0;display:none;}" +
    ".ta-edit.open{display:block;}" +
    ".ta-actions button{margin-right:6px;margin-top:4px;padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-size:12px;}" +
    ".ta-actions .btn-primary{background:#2f7dd1;color:#fff;border:none;}" +
    ".ta-actions .btn-danger{background:#dc2626;color:#fff;border:none;}" +
    ".ta-actions .btn-ok{background:#16a34a;color:#fff;border:none;}";
  document.head.appendChild(st);
}

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
    for(var i = 0; i < items.length; i++){
      if(items[i].eta){ eta = items[i].eta; break; }
    }

    var sec = document.createElement("div");
    sec.className = "ta-bl";
    var open = (gi === 0);

    var head = document.createElement("div");
    head.className = "ta-head" + (open ? " open" : "");
    head.innerHTML =
      '<span class="ta-toggle">' + (open ? "▼" : "▶") + "</span>" +
      '<span class="ta-title">提单 ' + esc(g.blNo) + "</span>" +
      '<span class="ta-meta">' + Object.keys(containers).length + " 柜 · " + items.length + " 行" +
      (eta ? " · 预计到港 " + esc(eta) : "") + "</span>";

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
      tr.innerHTML =
        '<td class="ta-cno">' + (showC ? esc(cNo || "-") : "") + "</td>" +
        '<td class="ta-code">' + esc(item.code || "") + "</td>" +
        "<td>" + esc(item.color || "") + "</td>" +
        "<td>" + esc(item.spec || "") + "</td>" +
        '<td class="ta-qty">' + (item.qty != null && item.qty !== "" ? item.qty : "-") + "</td>" +
        "<td>" + esc(item.status || "在途") +
        (resText ? '<div style="font-size:11px;color:#9a3412;margin-top:2px;">订:' + resText + "</div>" : "") +
        "</td>" +
        '<td class="ta-actions">' +
        '<button type="button" class="btn-edit">编辑</button>' +
        '<button type="button" class="btn-danger btn-del">删除</button>' +
        "</td>";
      tbody.appendChild(tr);

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
        '<label style="font-size:12px;">到港 <input data-field="eta" value="' + esc(item.eta || "") + '" style="width:110px;padding:4px 6px;"></label>' +
        '<label style="font-size:12px;">备注 <input data-field="remark" value="' + esc(item.remark || "") + '" style="min-width:120px;padding:4px 6px;"></label>' +
        '<button type="button" class="btn-primary btn-save-fields">保存</button>' +
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
          '<button type="button" style="padding:4px 8px;">删</button>';
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
            eta: tdEdit.querySelector('[data-field="eta"]').value.trim(),
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

    head.onclick = function(){
      var isOpen = body.style.display !== "none";
      body.style.display = isOpen ? "none" : "block";
      head.classList.toggle("open", !isOpen);
      head.querySelector(".ta-toggle").textContent = isOpen ? "▶" : "▼";
    };
  });
}

window.renderAdminList = renderAdminList;
