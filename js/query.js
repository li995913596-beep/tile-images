import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

  let list = [];
  const seen = new Set();

  function addDocs(snap){
    snap.forEach(doc=>{
      if(seen.has(doc.id)) return;
      seen.add(doc.id);
      const item = doc.data();
      const reserved = Array.isArray(item.reservedList)
        ? item.reservedList.reduce((s,r)=>s+Number(r.qty||0),0)
        : 0;
      list.push({...item, reserved});
    });
  }

  // ① 快速通道：按编号 / 规格精确查询（读次数少、速度快）
  try {
    const variants = [...new Set([raw, keyword, raw.toUpperCase()])];

    for (const v of variants) {
      const qCode = query(collection(db, "inventory"), where("code", "==", v));
      addDocs(await getDocs(qCode));

      const qSpec = query(collection(db, "inventory"), where("spec", "==", v));
      addDocs(await getDocs(qSpec));
    }
  } catch (e) {
    console.error("精确查询失败，改走模糊搜索:", e);
  }

  // ② 精确没命中时：走原来的模糊搜索，保证色号/仓库/部分匹配仍可用
  if (list.length === 0) {
    const q = query(
      collection(db, "inventory"),
      limit(1000)
    );

    const snap = await getDocs(q);

    snap.forEach(doc=>{
      const item = doc.data();

      const fullId = doc.id.toLowerCase();
      const code = String(item.code || "").toLowerCase();
      const spec = String(item.spec || "").toLowerCase();
      const color = String(item.color || "").toLowerCase();
      const warehouse = String(item.warehouse || "").toLowerCase();

      if(
        fullId.includes(keyword) ||
        code.includes(keyword) ||
        spec.includes(keyword) ||
        color.includes(keyword) ||
        warehouse.includes(keyword)
      ){
        const reserved = Array.isArray(item.reservedList)
          ? item.reservedList.reduce((s,r)=>s+Number(r.qty||0),0)
          : 0;

        list.push({...item, reserved});
      }
    });
  }

  if(list.length===0){
    resultDiv.innerHTML="未找到库存 / No Inventory Found";
    return;
  }

  if(window.innerWidth <= 768){
    buildMobile(list);
  }else{
    buildDesktop(list);
  }
};

/* ================= 桌面版 ================= */

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
    const imageUrl = window.location.origin +
      "/images/" + item.code + ".jpg";

    resultDiv.innerHTML+=`
      <div class="table-row">
        <div class="img-col" onclick="openModal('${imageUrl}')">
          <img src="${imageUrl}" loading="lazy"
          onerror="this.style.display='none'">
        </div>
        <div>${item.code}</div>
        <div>${item.spec||"-"}</div>
        <div>${item.color||"-"}</div>
        <div class="${item.stock<10?'low-stock':''}">
          ${item.stock}
        </div>
        <div>${item.warehouse||"-"}</div>
        <div>${item.reserved}</div>
      </div>
    `;
  });
}

/* ================= 手机版 ================= */
function buildMobile(list){

  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML="";

  list.forEach(item=>{

    const imageUrl = window.location.origin +
      "/images/" + item.code + ".jpg";

    /* ===== 整卡仓库底色 ===== */

    let bgColor = "#f3f4f6";   // 默认浅灰

    if(item.warehouse === "k38"){
      bgColor = "#e8f1fb";    // 淡蓝
    }
    else if(item.warehouse === "k39"){
      bgColor = "#eaf7f1";    // 淡绿
    }
    else if(item.warehouse === "1"){
      bgColor = "#f3ecff";    // 淡橙
    }

    /* ===== 仓库标签颜色（轻量风格） ===== */

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

    /* ===== 库存颜色 ===== */

    let stockColor = "#22c55e";

    if(item.stock == 0){
      stockColor = "#ef4444";
    }
    else if(item.stock < 10){
      stockColor = "#f59e0b";
    }

    /* ===== 留货标签 ===== */

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
        <span style="
          font-size:11px;
          padding:3px 8px;
          border-radius:999px;
          background:#ef4444;
          color:#fff;
        ">
          留货 ${item.reserved}
        </span>
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

        <!-- 图片 -->
        <div onclick="openModal('${imageUrl}')">
          <img src="${imageUrl}"
            style="width:58px;height:58px;border-radius:8px;object-fit:cover;"
            onerror="this.style.display='none'">
        </div>

        <!-- 中间信息 -->
        <div style="flex:1;">

          <div style="font-weight:600;font-size:15px;">
            ${item.code}
          </div>

          <div style="font-size:13px;color:#555;margin-top:2px;">
            ${item.spec || "-"} | 色号 ${item.color}
          </div>

          <div style="margin-top:6px;">
            ${reserveHtml}
          </div>

        </div>

        <!-- 右侧 -->
        <div style="text-align:right;">

          <!-- 仓库标签 -->
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

          <!-- 库存 -->
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
/* ================= DOM 绑定 ================= */

document.addEventListener("DOMContentLoaded", () => {

  const btnSearch = document.getElementById("btnSearch");
  const btnRefresh = document.getElementById("btnRefresh");
  const searchInput = document.getElementById("searchInput");
  const resultDiv = document.getElementById("result");

  btnSearch.addEventListener("click", window.searchData);

  btnRefresh.addEventListener("click", () => {
    searchInput.value = "";
    resultDiv.innerHTML = "";
  });

});
