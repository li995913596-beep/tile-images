/**
 * 在途扩展：整票/整柜批量改状态 + 多人预定提示
 */
import { db } from "./firebase.js";
import {
  doc, serverTimestamp, collection, getDocs, query, limit, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { renderAdminList as _renderAdminList } from "https://cdn.jsdelivr.net/gh/li995913596-beep/tile-images@a7bada2d9e9882e0960eca890472bc2faa534503/js/transit_render.js";

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

window.updateTransitStatusByBL = async function(blNo, status){
  try {
    status = String(status || "").trim();
    if(!status) return alert("请选择状态");
    if(!confirm("确定把提单「" + blNo + "」下全部编号状态改为「" + status + "」？\n将批量更新该票所有瓷砖。")) return;
    var ids = await collectIdsByBL(blNo);
    if(!ids.length) return alert("没有找到该提单的记录");
    await updateByIds(ids, { status: status, updatedAt: serverTimestamp() });
    alert("已更新提单「" + blNo + "」共 " + ids.length + " 条 → " + status);
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } catch(e){
    console.error(e);
    alert("更新失败：" + ((e && e.message) || e));
  }
};

window.updateTransitStatusByContainer = async function(blNo, containerNo, status){
  try {
    status = String(status || "").trim();
    if(!status) return alert("请选择状态");
    if(!confirm("确定把提单「" + blNo + "」柜号「" + (containerNo || "(空)") + "」下全部编号改为「" + status + "」？")) return;
    var snap = await getDocs(query(collection(db, "in_transit"), limit(2000)));
    var ids = [];
    snap.forEach(function(d){
      var data = d.data();
      var bl = (data.blNo && String(data.blNo).trim()) ? String(data.blNo).trim() : "(无提单号)";
      var c = String(data.containerNo || "");
      if(bl === blNo && c === String(containerNo || "")) ids.push(d.id);
    });
    if(!ids.length) return alert("没有找到该柜的记录");
    await updateByIds(ids, { status: status, updatedAt: serverTimestamp() });
    alert("已更新柜号「" + (containerNo || "(空)") + "」共 " + ids.length + " 条 → " + status);
    if(window.reloadTransitAdmin) window.reloadTransitAdmin();
  } catch(e){
    console.error(e);
    alert("更新失败：" + ((e && e.message) || e));
  }
};

function injectBulkStatusUI(){
  var box = document.getElementById("transitList");
  if(!box) return;

  box.querySelectorAll(".ta-head").forEach(function(head){
    if(head.querySelector(".status-batch")) return;
    var title = head.querySelector(".ta-title");
    if(!title) return;
    var blText = (title.textContent || "").replace(/^提单\s*/, "").trim();
    if(!blText) return;
    var actions = head.querySelector(".ta-head-actions");
    if(!actions) return;
    var wrap = document.createElement("span");
    wrap.style.cssText = "display:inline-flex;gap:4px;align-items:center;";
    wrap.innerHTML =
      '<select class="status-batch" style="padding:4px 6px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;color:#1f2937;background:#fff;">' +
      '<option value="">整票改状态…</option>' +
      '<option value="已到港">→ 已到港</option>' +
      '<option value="已入库">→ 已入库</option>' +
      '<option value="取消">→ 取消</option>' +
      '<option value="在途">→ 在途</option>' +
      '</select>' +
      '<button type="button" class="btn-status-bl" style="padding:5px 10px;border-radius:6px;border:1px solid #93c5fd;background:#dbeafe;color:#1e40af;cursor:pointer;font-size:12px;font-weight:600;">应用状态</button>';
    var delBtn = actions.querySelector(".btn-del-bl");
    if(delBtn) actions.insertBefore(wrap, delBtn);
    else actions.appendChild(wrap);
    wrap.querySelector(".btn-status-bl").onclick = function(e){
      e.stopPropagation();
      var sel = wrap.querySelector(".status-batch");
      window.updateTransitStatusByBL(blText, sel && sel.value);
    };
    wrap.querySelector(".status-batch").onclick = function(e){ e.stopPropagation(); };
  });

  box.querySelectorAll(".ta-cno").forEach(function(td){
    if(td.querySelector(".c-status-batch")) return;
    var delC = td.querySelector(".btn-del-c");
    if(!delC) return;
    var cNo = "";
    for(var i = 0; i < td.childNodes.length; i++){
      var n = td.childNodes[i];
      if(n.nodeType === 3){
        var t = (n.textContent || "").trim();
        if(t){ cNo = t; break; }
      }
    }
    var sec = td.closest(".ta-bl");
    var blTitle = sec && sec.querySelector(".ta-title");
    var blNo = blTitle ? (blTitle.textContent || "").replace(/^提单\s*/, "").trim() : "";
    if(!blNo) return;
    var wrap = document.createElement("span");
    wrap.innerHTML =
      ' <select class="c-status-batch" style="padding:2px 4px;font-size:11px;border:1px solid #d1d5db;border-radius:4px;color:#1f2937;background:#fff;max-width:90px;">' +
      '<option value="">整柜…</option>' +
      '<option value="已到港">已到港</option>' +
      '<option value="已入库">已入库</option>' +
      '<option value="取消">取消</option>' +
      '<option value="在途">在途</option>' +
      '</select>' +
      ' <button type="button" class="btn-status-c" style="padding:2px 6px;font-size:11px;background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:4px;cursor:pointer;">应用</button>';
    td.insertBefore(wrap, delC);
    wrap.querySelector(".btn-status-c").onclick = function(e){
      e.stopPropagation();
      var sel = wrap.querySelector(".c-status-batch");
      window.updateTransitStatusByContainer(blNo, cNo === "-" ? "" : cNo, sel && sel.value);
    };
    wrap.querySelector(".c-status-batch").onclick = function(e){ e.stopPropagation(); };
  });
}

function enhanceReserveUI(){
  var box = document.getElementById("transitList");
  if(!box) return;
  box.querySelectorAll("[id^='res_box_']").forEach(function(resBox){
    if(resBox.__enhanced) return;
    resBox.__enhanced = true;
    var parent = resBox.parentNode;
    if(!parent) return;
    if(!parent.querySelector(".res-hint")){
      var hint = document.createElement("div");
      hint.className = "res-hint";
      hint.style.cssText = "font-size:12px;color:#64748b;margin:0 0 6px;";
      hint.textContent = "支持多人预定：点「+ 添加预定」继续加客户，全部填完后点「保存预定」。";
      parent.insertBefore(hint, resBox);
    }
    resBox.querySelectorAll("[data-res-row]").forEach(function(row, i){
      if(row.querySelector(".res-idx")) return;
      var sp = document.createElement("span");
      sp.className = "res-idx";
      sp.style.cssText = "font-size:11px;color:#64748b;min-width:36px;";
      sp.textContent = "#" + (i + 1);
      row.style.alignItems = "center";
      row.insertBefore(sp, row.firstChild);
    });
    if(!resBox.querySelector("[data-res-row]")){
      var id = (resBox.id || "").replace("res_box_", "");
      if(id && window.addResRow) window.addResRow(id);
    }
  });
  box.querySelectorAll(".btn-add-res").forEach(function(btn){
    if(btn.__styled) return;
    btn.__styled = true;
    btn.style.cssText = (btn.style.cssText || "") + ";background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:5px 12px;border-radius:6px;font-weight:600;cursor:pointer;";
    if(!(btn.textContent || "").includes("多人")){
      btn.textContent = "+ 添加预定（多人）";
    }
  });
}

function renderAdminList(list){
  _renderAdminList(list);
  setTimeout(function(){ injectBulkStatusUI(); enhanceReserveUI(); }, 0);
  setTimeout(function(){ injectBulkStatusUI(); enhanceReserveUI(); }, 200);
}
window.renderAdminList = renderAdminList;
export { renderAdminList };

console.log("transit_status.js ready: bulk status + multi reserve");
