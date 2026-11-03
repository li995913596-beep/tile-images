/**
 * 出货计划（后台 tab_ship + 前台 ship.html）
 * 搜索优先用与前台相同的本地 8 小时缓存，尽量不读 Firebase
 * 本系统 stock=可售；留货在 reservedList。可出(不碰留货)=可售
 */
import { db } from "./firebase.js";
import {
  collection, getDocs, query, limit, startAfter
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

var planLines = [];
var CACHE_TTL_MS = 8 * 60 * 60 * 1000;
var CACHE_KEY = "tile_inv_cache_v1";

function todayStr(){
  var d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function esc(s){
  return String(s == null ? "" : s);
}

function normalizeSpec(s){
  s = String(s == null ? "" : s).trim();
  if(!s) return "";
  s = s.replace(/[＊×✕✖*]/g, "x").replace(/X/g, "x").replace(/\s+/g, "");
  var parts = s.split("x").filter(function(p){ return p !== ""; });
  if(parts.length >= 2) return parts[0] + "x" + parts[1];
  return s;
}

function reservedTotal(item){
  var list = Array.isArray(item.reservedList) ? item.reservedList : [];
  var t = 0;
  for(var i = 0; i < list.length; i++) t += Number((list[i] && list[i].qty) || 0);
  return t;
}

function reserveDetail(item){
  var list = Array.isArray(item.reservedList) ? item.reservedList : [];
  var parts = [];
  for(var i = 0; i < list.length; i++){
    var r = list[i];
    if(!r) continue;
    var rq = Number(r.qty || 0);
    if(rq <= 0 && !r.customer) continue;
    parts.push((r.customer || "未填客户") + "(" + rq + ")");
  }
  return parts.join("、");
}

function toPlanItem(item, id){
  var stock = Number(item.stock || 0);
  var reserved = item.reserved != null ? Number(item.reserved) : reservedTotal(item);
  var available = Math.max(0, stock);
  return {
    id: id || item._id || "",
    code: item.code || "",
    spec: item.spec || "",
    color: item.color || "",
    warehouse: item.warehouse || "",
    stock: stock,
    reserved: reserved,
    reserveDetail: item.reserveDetail || reserveDetail(item),
    available: available
  };
}

function loadLocalCacheItems(){
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if(!raw) return null;
    var obj = JSON.parse(raw);
    if(!obj || !Array.isArray(obj.items) || !obj.loadedAt) return null;
    if((Date.now() - Number(obj.loadedAt)) >= CACHE_TTL_MS) return null;
    return obj.items;
  } catch(e){
    return null;
  }
}

function saveLocalCacheItems(items){
  try {
    var slim = (items || []).map(function(item){
      var o = {};
      Object.keys(item).forEach(function(k){
        if(k === "lastUpdate") return;
        o[k] = item[k];
      });
      if(Array.isArray(item.reservedList)){
        o.reservedList = item.reservedList.map(function(r){
          if(!r) return r;
          return { customer: r.customer || "", qty: Number(r.qty || 0), at: r.at || null };
        });
      }
      return o;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify({ loadedAt: Date.now(), items: slim }));
  } catch(e){
    console.warn("出货计划写本地缓存失败", e);
  }
}

async function fetchAllInventory(){
  var pageSize = 500;
  var items = [];
  var lastDoc = null;
  for(var pages = 0; pages < 40; pages++){
    var qAll = lastDoc
      ? query(collection(db, "inventory"), limit(pageSize), startAfter(lastDoc))
      : query(collection(db, "inventory"), limit(pageSize));
    var snap = await getDocs(qAll);
    if(snap.empty) break;
    snap.forEach(function(docSnap){
      var item = docSnap.data();
      if(item.hidden) return;
      var rlist = Array.isArray(item.reservedList) ? item.reservedList : [];
      var reserved = 0;
      var detailParts = [];
      for(var i = 0; i < rlist.length; i++){
        var r = rlist[i];
        if(!r) continue;
        var rq = Number(r.qty || 0);
        reserved += rq;
        if(r.customer || rq) detailParts.push((r.customer || "未填客户") + "(" + rq + ")");
      }
      items.push({
        ...item,
        _id: docSnap.id,
        reserved: reserved,
        reserveDetail: detailParts.join("、"),
        _code: String(item.code || "").toLowerCase(),
        _spec: normalizeSpec(item.spec || "").toLowerCase(),
        _color: String(item.color || "").toLowerCase(),
        _warehouse: String(item.warehouse || "").toLowerCase(),
        _fullId: String(docSnap.id).toLowerCase()
      });
    });
    lastDoc = snap.docs[snap.docs.length - 1];
    if(snap.size < pageSize) break;
  }
  return items;
}

async function getAllItemsPreferCache(){
  var local = loadLocalCacheItems();
  if(local && local.length){
    console.log("出货计划：使用本地缓存", local.length, "条");
    return local;
  }
  console.log("出货计划：本地无缓存，从服务器拉取…");
  var items = await fetchAllInventory();
  saveLocalCacheItems(items);
  return items;
}

async function searchInventoryLikeFrontend(raw){
  var keyword = String(raw || "").trim().toLowerCase();
  if(!keyword) return [];
  var kwSpec = normalizeSpec(raw).toLowerCase();
  var all = await getAllItemsPreferCache();
  var list = [];
  for(var i = 0; i < all.length; i++){
    var item = all[i];
    var code = String(item._code || item.code || "").toLowerCase();
    var spec = String(item._spec || normalizeSpec(item.spec || "")).toLowerCase();
    var color = String(item._color || item.color || "").toLowerCase();
    var wh = String(item._warehouse || item.warehouse || "").toLowerCase();
    var fullId = String(item._fullId || item._id || "").toLowerCase();
    if(
      fullId.indexOf(keyword) >= 0 ||
      code.indexOf(keyword) >= 0 ||
      spec.indexOf(keyword) >= 0 ||
      (kwSpec && spec.indexOf(kwSpec) >= 0) ||
      color.indexOf(keyword) >= 0 ||
      wh.indexOf(keyword) >= 0
    ){
      list.push(toPlanItem(item, item._id));
    }
  }
  list.sort(function(a, b){
    var ca = String(a.code || "").toLowerCase();
    var cb = String(b.code || "").toLowerCase();
    var ea = ca === keyword ? 0 : (ca.indexOf(keyword) === 0 ? 1 : 2);
    var eb = cb === keyword ? 0 : (cb.indexOf(keyword) === 0 ? 1 : 2);
    if(ea !== eb) return ea - eb;
    return ca.localeCompare(cb, "zh-CN");
  });
  return list;
}

function warehouseStyle(w){
  return "display:inline-block;font-size:11px;padding:3px 8px;border-radius:999px;background:#eef3f8;color:#2c3e50;";
}

function isShipFront(){ return !!$("shipFrontRoot"); }
function LF(zh, th, en){
  if(window.I18N && window.I18N.pick) return window.I18N.pick(zh, en || zh, th);
  return zh;
}

function renderSearchResults(items){
  var box = $("sp_search_result");
  if(!box) return;
  if(!items.length){
    box.innerHTML = '<div style="padding:12px;color:#888;">' + LF("未找到库存", "ไม่พบสต็อก") + "</div>";
    return;
  }
  box.innerHTML = items.map(function(it, idx){
    var avColor = it.available > 0 ? "#16a34a" : "#b91c1c";
    var resHtml = it.reserved > 0
      ? '<div style="font-size:12px;color:#b45309;margin-top:4px;">' + LF("留货", "จอง") + " " + it.reserved + (it.reserveDetail ? "：" + esc(it.reserveDetail) : "") + "</div>"
      : '<div style="font-size:12px;color:#94a3b8;margin-top:4px;">' + LF("留货", "จอง") + " 0</div>";
    return (
      '<div style="padding:12px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;background:#fff;">' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
          '<span style="font-weight:700;">' + esc(it.code) + "</span>" +
          '<span style="color:#64748b;">' + esc(it.spec || "-") + "</span>" +
          '<span>' + LF("色号", "สี") + " " + esc(it.color || "-") + "</span>" +
          '<span style="' + warehouseStyle(it.warehouse) + '">' + esc(it.warehouse || "-") + "</span>" +
        "</div>" +
        '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:13px;">' +
          '<span>' + LF("可售", "พร้อมขาย") + " <b>" + it.stock + "</b></span>" +
          '<span style="color:' + avColor + ';">' + LF("可出", "ส่งได้") + " <b>" + it.available + "</b></span>" +
          resHtml +
        "</div>" +
        '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
          '<label style="font-size:13px;">' + LF("数量", "จำนวน") + ' <input type="number" min="0.01" step="0.01" value="" data-sp-qty="' + idx + '" style="width:90px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;"></label>' +
          '<button type="button" data-sp-add="' + idx + '" style="padding:6px 14px;border:none;border-radius:8px;background:#0f766e;color:#fff;cursor:pointer;font-weight:600;">' + LF("加入计划", "เพิ่มแผน") + "</button>" +
        "</div>" +
      "</div>"
    );
  }).join("");

  box._spItems = items;
  box.querySelectorAll("[data-sp-add]").forEach(function(btn){
    btn.onclick = function(){
      var i = Number(btn.getAttribute("data-sp-add"));
      var it = box._spItems[i];
      if(!it) return;
      var inp = box.querySelector('[data-sp-qty="' + i + '"]');
      var qty = Number(inp && inp.value);
      if(!qty || qty <= 0) return alert("请输入数量");
      if(qty > it.available){
        if(!confirm("数量 " + qty + " 超过可出 " + it.available + "（可售，不含他人留货）。仍要加入？")) return;
      }
      planLines.push({
        code: it.code,
        spec: it.spec,
        color: it.color,
        warehouse: it.warehouse,
        qty: qty,
        stock: it.stock,
        reserved: it.reserved,
        available: it.available
      });
      renderPlanLines();
    };
  });
}

function renderPlanLines(){
  var box = $("sp_plan_list");
  if(!box) return;
  if(!planLines.length){
    box.innerHTML = '<div style="padding:8px;color:#94a3b8;font-size:13px;">' + LF("尚未加入瓷砖", "ยังไม่มีรายการ") + "</div>";
    return;
  }
  box.innerHTML = planLines.map(function(line, idx){
    return (
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;">' +
        '<span style="color:#64748b;">' + (idx + 1) + ".</span>" +
        '<span style="font-weight:600;">' + esc(line.code) + "</span>" +
        '<span style="color:#64748b;">' + esc(line.spec || "-") + "</span>" +
        '<span>' + LF("色号", "สี") + " <b>" + esc(line.color || "-") + "</b></span>" +
        '<span style="font-size:12px;padding:2px 8px;border-radius:999px;background:#e5e7eb;color:#374151;">' + esc(line.warehouse || "-") + "</span>" +
        '<span style="font-weight:700;color:#0f766e;">× ' + line.qty + "</span>" +
        (line.reserved > 0 ? '<span style="font-size:12px;color:#b45309;">(' + LF("留货", "จอง") + line.reserved + "/" + LF("可出", "ส่งได้") + line.available + ")</span>" : "") +
        '<button type="button" data-sp-del="' + idx + '" style="margin-left:auto;padding:4px 10px;border:1px solid #fecaca;background:#fee2e2;color:#b91c1c;border-radius:6px;cursor:pointer;">' + LF("移除", "ลบ") + "</button>" +
      "</div>"
    );
  }).join("");
  box.querySelectorAll("[data-sp-del]").forEach(function(btn){
    btn.onclick = function(){
      planLines.splice(Number(btn.getAttribute("data-sp-del")), 1);
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
  var vehicle = (($("sp_vehicle") && $("sp_vehicle").value) || "").trim();
  var note = (($("sp_note") && $("sp_note").value) || "").trim();
  var lines = [];
  if(vehicle){
    vehicle.split(/\r?\n/).forEach(function(row){
      var t = row.trim();
      if(t) lines.push(t);
    });
  }
  if(lines.length) lines.push("");
  lines.push(buildCustomerLine());
  lines.push("");
  planLines.forEach(function(line, idx){
    if(idx > 0) lines.push("");
    lines.push((idx + 1) + ".ကုဒ်နိပတ်/编号：" + (line.code || ""));
    lines.push("အလျားအနံ/规格：" + (line.spec || ""));
    lines.push("အရောင်ကုဒ်色号：" + (line.color || ""));
    lines.push("အရေအတွက်/数量：" + line.qty);
    lines.push("ဂိုဒေါင်/仓库：" + (line.warehouse || ""));
  });
  lines.push("");
  if(note) lines.push(note);
  else lines.push("送货单一起带过去");
  var pallet = $("sp_pallet") && $("sp_pallet").checked;
  if(pallet) lines.push("打托ဖာ့လစ်နဲ့တင်မယ်");
  return lines.join("\n");
}

window.spSearch = async function(){
  var input = $("sp_search");
  var raw = (input && input.value || "").trim();
  var box = $("sp_search_result");
  if(!raw) return alert(LF("请输入编号或规格", "กรุณาใส่รหัสหรือขนาด"));
  if(box) box.innerHTML = '<div style="padding:12px;color:#666;">' + LF("搜索中…", "กำลังค้นหา") + "</div>";
  try {
    var items = await searchInventoryLikeFrontend(raw);
    renderSearchResults(items);
  } catch(e){
    console.error(e);
    if(box) box.innerHTML = '<div style="padding:12px;color:#b91c1c;">' + LF("搜索失败", "ค้นหาไม่สำเร็จ") + "</div>";
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

function shipPlanInnerHTML(){
  var front = !!$("shipFrontRoot");
  function L(zh, th){ return front ? (zh + " / " + th) : zh; }
  return (
    '<div id="sp_quote_wrap" style="position:sticky;top:0;z-index:30;margin:0 0 10px;">' +
      '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:8px 10px;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span style="font-weight:700;color:#92400e;font-size:14px;">报价单</span>' +
          '<label style="margin-left:auto;padding:6px 10px;border:1px solid #f59e0b;border-radius:8px;background:#fff;color:#92400e;cursor:pointer;font-size:13px;">选图<input id="sp_quote_file" type="file" accept="image/*" style="display:none;"></label>' +
          '<button type="button" id="sp_quote_clear" style="padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#64748b;cursor:pointer;font-size:13px;">清除</button>' +
        '</div>' +
        '<img id="sp_quote_img" alt="" style="display:none;margin-top:8px;width:100%;height:92px;object-fit:cover;object-position:top;border-radius:8px;background:#fff;cursor:zoom-in;">' +
      '</div>' +
    '</div>' +
    '<div id="sp_quote_viewer" style="display:none;position:fixed;inset:0;z-index:80;background:rgba(15,23,42,0.92);">' +
      '<button type="button" id="sp_quote_close" style="position:absolute;top:12px;right:12px;z-index:2;padding:8px 12px;border:none;border-radius:8px;background:#fff;color:#111;font-weight:700;">关闭</button>' +
      '<div style="height:100%;overflow:auto;-webkit-overflow-scrolling:touch;padding:52px 8px 16px;">' +
        '<img id="sp_quote_full" alt="" style="width:100%;display:block;">' +
      '</div>' +
    '</div>' +
    '<p style="font-size:13px;color:#666;margin:0 0 14px;line-height:1.5;">' + L("搜索与库存查询共用本地缓存（约 8 小时）。显示可售 / 留货 / 可出。只生成文本，不扣库存。", "ค้นหาสต็อก แสดงพร้อมขาย / จอง สร้างข้อความอย่างเดียว ไม่หักสต็อก") + '</p>' +
    '<div style="display:grid;gap:12px;margin-bottom:14px;">' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">' +
        '<label style="font-size:13px;">' + L("日期", "วันที่") + ' <input id="sp_date" value="' + todayStr() + '" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;width:130px;"></label>' +
        '<label style="font-size:13px;">' + L("客户", "ลูกค้า") + ' <input id="sp_customer" placeholder="' + L("客户名称", "ชื่อลูกค้า") + '" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;min-width:140px;"></label>' +
        '<label style="font-size:13px;">' + L("付款", "ชำระเงิน") + ' <select id="sp_pay" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;">' +
          '<option value="已付款">' + L("已付款", "จ่ายแล้ว") + '</option><option value="未付款">' + L("未付款", "ยังไม่จ่าย") + '</option><option value="">（不写）</option></select></label>' +
        '<label style="font-size:13px;">' + L("账户", "บัญชี") + ' <select id="sp_account" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;">' +
          '<option value="公账">公账</option><option value="私账">私账</option><option value="">（不写）</option></select></label>' +
        '<label style="font-size:13px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;">' +
          '<input type="checkbox" id="sp_pallet" style="width:16px;height:16px;cursor:pointer;"> ' + L("打托", "พาเลท") + '</label>' +
      "</div>" +
      '<div><label style="font-size:13px;display:block;margin-bottom:4px;">' + L("车辆信息（可直接粘贴，可空）", "ข้อมูลรถ (วางว่างได้)") + '</label>' +
        '<textarea id="sp_vehicle" rows="3" placeholder="' + L("粘贴车牌/电话等", "ป้ายทะเบียน / เบอร์โทร") + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;"></textarea></div>' +
      '<div><label style="font-size:13px;display:block;margin-bottom:4px;">' + L("备注（可空）", "หมายเหตุ") + '</label>' +
        '<input id="sp_note" placeholder="' + L("默认：送货单一起带过去", "ค่าเริ่มต้น: เอาใบส่งของไปด้วย") + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;"></div>' +
    "</div>" +
    '<div style="padding:14px;border-radius:12px;background:#f0fdfa;border:1px solid #99f6e4;margin-bottom:14px;">' +
      '<div style="font-weight:600;margin-bottom:8px;color:#0f766e;">' + L("搜索瓷砖并加入", "ค้นหาและเพิ่มกระเบื้อง") + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
        '<input id="sp_search" placeholder="' + L("输入编号或规格，如 3610 / NB3610", "ใส่รหัสหรือขนาด") + '" style="flex:1;min-width:180px;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;">' +
        '<button type="button" id="sp_btn_search" style="padding:8px 16px;border:none;border-radius:8px;background:#0f766e;color:#fff;cursor:pointer;font-weight:600;">' + L("搜索", "ค้นหา") + '</button>' +
      "</div>" +
      '<div id="sp_search_result"></div>' +
    "</div>" +
    '<div style="padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:14px;">' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">' +
        '<div style="font-weight:600;color:#1f2937;">' + L("计划明细", "รายการแผน") + '</div>' +
        '<button type="button" id="sp_btn_clear" style="margin-left:auto;padding:4px 10px;border:1px solid #d1d5db;background:#fff;color:#374151;cursor:pointer;font-size:12px;font-weight:600;">' + L("清空明细", "ล้างรายการ") + '</button>' +
      "</div>" +
      '<div id="sp_plan_list"></div>' +
    "</div>" +
    '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;">' +
      '<button type="button" id="sp_btn_gen" style="padding:10px 18px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;font-weight:600;">' + L("生成出货计划", "สร้างแผนส่งของ") + '</button>' +
      '<button type="button" id="sp_btn_copy" style="padding:10px 18px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;font-weight:600;">' + L("一键复制", "คัดลอก") + '</button>' +
    "</div>" +
    '<textarea id="sp_output" readonly rows="14" style="display:none;width:100%;box-sizing:border-box;padding:12px;border:1px solid #d1d5db;border-radius:10px;font-size:13px;line-height:1.5;font-family:ui-monospace,monospace;"></textarea>'
  );
}

function bindShipPlanButtons(){
  var btnSearch = $("sp_btn_search");
  if(btnSearch) btnSearch.onclick = function(){ window.spSearch(); };
  var searchInput = $("sp_search");
  if(searchInput && !searchInput.__spEnter){
    searchInput.__spEnter = true;
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
  var quoteFile = $("sp_quote_file");
  if(quoteFile) quoteFile.onchange = function(){
    var f = quoteFile.files && quoteFile.files[0];
    if(!f) return;
    var reader = new FileReader();
    reader.onload = function(){
      var img = $("sp_quote_img");
      var full = $("sp_quote_full");
      if(img){ img.src = reader.result; img.style.display = "block"; }
      if(full) full.src = reader.result;
    };
    reader.readAsDataURL(f);
  };
  var quoteImg = $("sp_quote_img");
  if(quoteImg) quoteImg.onclick = function(){
    if(!quoteImg.src) return;
    var viewer = $("sp_quote_viewer");
    if(viewer) viewer.style.display = "block";
  };
  var quoteClose = $("sp_quote_close");
  if(quoteClose) quoteClose.onclick = function(){
    var viewer = $("sp_quote_viewer");
    if(viewer) viewer.style.display = "none";
  };
  var quoteClear = $("sp_quote_clear");
  if(quoteClear) quoteClear.onclick = function(){
    var img = $("sp_quote_img");
    var full = $("sp_quote_full");
    if(img){ img.src = ""; img.style.display = "none"; }
    if(full) full.src = "";
    if(quoteFile) quoteFile.value = "";
    var viewer = $("sp_quote_viewer");
    if(viewer) viewer.style.display = "none";
  };
  renderPlanLines();
}

function buildShipPlanUI(){
  var tab = $("tab_ship");
  if(tab){
    if(!(tab.dataset.built === "1" && tab.querySelector("#sp_search"))){
      tab.dataset.built = "1";
      tab.innerHTML = '<h3 style="margin:0 0 12px;font-size:16px;color:#1f2937;">出货计划</h3>' + shipPlanInnerHTML();
      bindShipPlanButtons();
    }
  }
  var front = $("shipFrontRoot");
  if(front){
    if(!(front.dataset.built === "1" && front.querySelector("#sp_search"))){
      front.dataset.built = "1";
      front.innerHTML = shipPlanInnerHTML();
      bindShipPlanButtons();
    }
  }
}

function hookShowTab(){
  if(typeof window.showTab !== "function") return false;
  if(window.showTab.__shipPlanHooked) return true;
  var orig = window.showTab;
  window.showTab = function(name){
    orig.apply(this, arguments);
    if(name === "ship") buildShipPlanUI();
  };
  window.showTab.__shipPlanHooked = true;
  return true;
}

function ensureShipVisible(){
  var tab = $("tab_ship");
  if(tab){
    var shown = tab.style.display === "block" || (tab.offsetParent !== null && tab.style.display !== "none");
    if(shown && !tab.querySelector("#sp_search")){
      tab.dataset.built = "";
      buildShipPlanUI();
    }
  }
}

function boot(){
  hookShowTab();
  buildShipPlanUI();
  var n = 0;
  var t = setInterval(function(){
    n++;
    hookShowTab();
    ensureShipVisible();
    if($("shipFrontRoot") && !$("shipFrontRoot").querySelector("#sp_search")) buildShipPlanUI();
    if(n > 80) clearInterval(t);
  }, 250);
  setInterval(ensureShipVisible, 800);
  console.log("ship_plan.js ready v20261103a (quote sticky while editing)");
}

window.addEventListener("tile-lang-change", function(){
  var tab = $("tab_ship"); if(tab) tab.dataset.built = "";
  var front = $("shipFrontRoot"); if(front) front.dataset.built = "";
  buildShipPlanUI();
});
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
