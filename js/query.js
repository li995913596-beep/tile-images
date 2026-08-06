import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 汇总留货数量 + 客户明细 */
function getReserveInfo(item){
  const list = Array.isArray(item.reservedList) ? item.reservedList : [];
  const total = list.reduce((s, r) => s + Number(r.qty || 0), 0);
  const detail = list
    .filter(r => r && (r.customer || r.qty))
    .map(r => {
      const name = (r.customer || "未填客户").toString();
      const qty = Number(r.qty || 0);
      return `${name}(${qty})`;
    })
    .join("、");
  return { total, detail };
}

function formatPackLine(item){
  var parts = [];
  if(item.piecesPerBox != null && item.piecesPerBox !== "" && Number(item.piecesPerBox) > 0){
    parts.push(Number(item.piecesPerBox) + "片/箱");
  }
  if(item.boxWeight != null && item.boxWeight !== "" && Number(item.boxWeight) > 0){
    parts.push(Number(item.boxWeight) + "kg");
  }
  var pack = (item.packaging || "").toString().trim();
  if(pack) parts.push(pack);
  return parts.length ? parts.join(" · ") : "";
}

/* ================= 搜索函数 ================= */

window.searchData = async function(){

  const searchInput = document.getElementById("searchInput");
  const resultDiv = document.getElementById("result");

  console.log("searchData 开始执行");

  const raw = searchInput.value.trim();
  const keyword = raw.toLowerCase();
  resultDiv.innerHTML = "";

  if(!raw){
    resultDiv.innerHTML = "请输入编号或规格 / Please enter Code or Size";
    return;
  }

  resultDiv.innerHTML = "<div style='padding:16px;color:#666;font-size:14px;'>搜索中…</div>";

  let list = [];
  const seen = new Set();

  function addItem(docSnap){
    if(seen.has(docSnap.id)) return;
    seen.add(docSnap.id);
    const item = docSnap.data();
    if(item.hidden) return;
    const { total, detail } = getReserveInfo(item);
    list.push({...item, _id: docSnap.id, reserved: total, reserveDetail: detail});
  }

  // 1) 精确匹配编号 / 规格
  try {
    const variants = [...new Set([raw, keyword, raw.toUpperCase()])];
    for (const v of variants) {
      const qCode = query(collection(db, "inventory"), where("code", "==", v));
      (await getDocs(qCode)).forEach(addItem);
      const qSpec = query(collection(db, "inventory"), where("spec", "==", v));
      (await getDocs(qSpec)).forEach(addItem);
    }
  } catch (e) {
    console.error("精确查询失败:", e);
  }

  // 2) 始终做模糊匹配：编号/规格/色号/仓库/文档ID 包含关键词
  //    分页拉全量，避免只扫前 1000 条漏掉 NB62206 这类
  try {
    let lastDoc = null;
    const pageSize = 500;
    let pages = 0;
    const maxPages = 40; // 最多约 20000 条，防止异常死循环
    while (pages < maxPages) {
      pages++;
      const qAll = lastDoc
        ? query(collection(db, "inventory"), limit(pageSize), startAfter(lastDoc))
        : query(collection(db, "inventory"), limit(pageSize));
      const snap = await getDocs(qAll);
      if (snap.empty) break;
      snap.forEach(docSnap => {
        const item = docSnap.data();
        const fullId = docSnap.id.toLowerCase();
        const code = String(item.code || "").toLowerCase();
        const spec = String(item.spec || "").toLowerCase();
        const color = String(item.color || "").toLowerCase();
        const warehouse = String(item.warehouse || "").toLowerCase();
        if (
          fullId.includes(keyword) ||
          code.includes(keyword) ||
          spec.includes(keyword) ||
          color.includes(keyword) ||
          warehouse.includes(keyword)
        ) {
          addItem(docSnap);
        }
      });
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < pageSize) break;
    }
  } catch (e) {
    console.error("模糊搜索失败:", e);
  }

  if(list.length===0){
    resultDiv.innerHTML="未找到库存 / No Inventory Found";
    return;
  }

  // 排序：编号完全相等 > 编号包含关键词 > 其它；同组按编号
  list.sort((a, b) => {
    const ca = String(a.code || "").toLowerCase();
    const cb = String(b.code || "").toLowerCase();
    const score = (c) => {
      if (c === keyword || c === raw.toLowerCase()) return 0;
      if (c.includes(keyword)) return 1;
      return 2;
    };
    const sa = score(ca), sb = score(cb);
    if (sa !== sb) return sa - sb;
    return ca.localeCompare(cb, "zh-CN");
  });

  if(window.innerWidth <= 768){
    buildMobile(list);
  }else{
    buildDesktop(list);
  }
};

function buildDesktop(list){

  const resultDiv = document.getElementById("result");

  resultDiv.innerHTML=`
    <div class="table-header">
      <div>图片<br>Image</div>
      <div>编号<br>Code</div>
      <div>规格<br>Size</div>
      <div>色号<br>Color</div>
      <div>数量<br>Stock</div>
      <div>仓库<br>Warehouse</div>
      <div>留货<br>Reserved</div>
    </div>
  `;

  list.forEach(item=>{
    const imageUrl = window.location.origin + "/images/" + (item.code || "") + ".jpg";

    const reserveText = item.reserved > 0
      ? `${item.reserved}${item.reserveDetail ? "<br><span style=\"font-size:12px;color:#c0392b;\">" + item.reserveDetail + "</span>" : ""}`
      : "0";

    resultDiv.innerHTML+=`
      <div class="table-row">
        <div class="img-col" onclick="openModal('${imageUrl}')">
          <img src="${imageUrl}" loading="lazy" onerror="this.style.display='none'">
        </div>
        <div>${item.code}${formatPackLine(item) ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${formatPackLine(item)}</div>` : ""}</div>
        <div>${item.spec||"-"}</div>
        <div>${item.color||"-"}</div>
        <div class="${item.stock<10?'low-stock':''}">
          ${item.stock}
        </div>
        <div>${item.warehouse||"-"}</div>
        <div>${reserveText}</div>
      </div>
    `;
  });
}

function buildMobile(list){

  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML="";

  list.forEach(item=>{

    const imageUrl = window.location.origin + "/images/" + (item.code || "") + ".jpg";

    let bgColor = "#f3f4f6";

    if(item.warehouse === "k38"){
      bgColor = "#e8f1fb";
    }
    else if(item.warehouse === "k39"){
      bgColor = "#eaf7f1";
    }
    else if(item.warehouse === "1"){
      bgColor = "#f3ecff";
    }

    let warehouseBg = "#e5e7eb";
    let warehouseColor = "#555";

    if(item.warehouse === "k38"){
      warehouseBg = "#dbeafe";
      warehouseColor = "#2563eb";
    }
    else if(item.warehouse === "k39"){
      warehouseBg = "#dcfce7";
      warehouseColor = "#16a34a";
    }
    else if(item.warehouse === "1"){
      warehouseBg = "#ffedd5";
      warehouseColor = "#ea580c";
    }

    let stockColor = "#22c55e";

    if(item.stock == 0){
      stockColor = "#ef4444";
    }
    else if(item.stock < 10){
      stockColor = "#f59e0b";
    }

    let reserveHtml = `
      <span style="
        font-size:11px;
        padding:3px 8px;
        border-radius:999px;
        background:#e5e7eb;
        color:#666;
      ">
        留货 0
      </span>
    `;

    if(item.reserved > 0){
      reserveHtml = `
        <div style="margin-top:2px;">
          <span style="
            font-size:11px;
            padding:3px 8px;
            border-radius:999px;
            background:#ef4444;
            color:#fff;
          ">
            留货 ${item.reserved}
          </span>
          ${item.reserveDetail ? `
            <div style="
              margin-top:4px;
              font-size:12px;
              color:#c0392b;
              line-height:1.4;
            ">客户：${item.reserveDetail}</div>
          ` : ""}
        </div>
      `;
    }

    resultDiv.innerHTML += `
      <div style="
        background:${bgColor};
        padding:12px;
        border-radius:14px;
        margin-bottom:12px;
        display:flex;
        align-items:center;
        gap:12px;
      ">

        <div onclick="openModal('${imageUrl}')">
          <img src="${imageUrl}"
            style="width:58px;height:58px;border-radius:8px;object-fit:cover;"
            onerror="this.style.display='none'">
        </div>

        <div style="flex:1;">

          <div style="font-weight:600;font-size:15px;">
            ${item.code}
          </div>

          <div style="font-size:13px;color:#555;margin-top:2px;">
            ${item.spec || "-"} | 色号 ${item.color}
          </div>
          ${formatPackLine(item) ? `<div style="font-size:12px;color:#64748b;margin-top:3px;">${formatPackLine(item)}</div>` : ""}

          <div style="margin-top:6px;">
            ${reserveHtml}
          </div>

        </div>

        <div style="text-align:right;">

          <div style="
            display:inline-block;
            font-size:11px;
            padding:4px 10px;
            border-radius:999px;
            background:${warehouseBg};
            color:${warehouseColor};
            font-weight:500;
            margin-bottom:6px;
          ">
            ${item.warehouse}
          </div>

          <div style="
            font-size:16px;
            font-weight:700;
            padding:6px 12px;
            border-radius:10px;
            background:${stockColor};
            color:#fff;
          ">
            ${item.stock}
          </div>

        </div>

      </div>
    `;
  });
}

document.addEventListener("DOMContentLoaded", () => {

  const btnSearch = document.getElementById("btnSearch");
  const btnRefresh = document.getElementById("btnRefresh");
  const searchInput = document.getElementById("searchInput");
  const resultDiv = document.getElementById("result");

  btnSearch.addEventListener("click", window.searchData);

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      window.searchData();
    }
  });

  btnRefresh.addEventListener("click", () => {
    searchInput.value = "";
    resultDiv.innerHTML = "";
  });

});
