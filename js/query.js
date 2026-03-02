import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= 搜索函数 ================= */

window.searchData = async function(){

  const searchInput = document.getElementById("searchInput");
  const resultDiv = document.getElementById("result");

  console.log("searchData 开始执行");

  const keyword = searchInput.value.trim().toLowerCase();
  resultDiv.innerHTML = "";

  if(!keyword){
    resultDiv.innerHTML = "请输入编号或规格 / Please enter Code or Size";
    return;
  }

  // 🔥 限制最多读取 300 条，防止爆读
  const q = query(
    collection(db, "inventory"),
    limit(300)
  );

  const snap = await getDocs(q);
  let list = [];

  snap.forEach(doc=>{
    const item = doc.data();

    const code = String(item.code || "").toLowerCase();
    const spec = String(item.spec || "").toLowerCase();

    // 🔥 真正模糊包含
    if(code.includes(keyword) || spec.includes(keyword)){

      const reserved = Array.isArray(item.reservedList)
        ? item.reservedList.reduce((s,r)=>s+Number(r.qty||0),0)
        : 0;

      list.push({...item,reserved});
    }
  });

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

    /* ===== 仓库颜色区分 ===== */

    let bgColor = "#eef3ff"; // 默认蓝

    if(item.warehouse === "k38"){
      bgColor = "#e6f0ff";   // 浅蓝
    }
    else if(item.warehouse === "k39"){
      bgColor = "#e9f7ef";   // 浅绿
    }
    else if(item.warehouse === "k40"){
      bgColor = "#fff4e6";   // 浅橙
    }

    /* ===== 库存颜色 ===== */

    let stockColor = "#2ecc71"; // 正常绿色

    if(item.stock == 0){
      stockColor = "#e74c3c"; // 红
    }
    else if(item.stock < 10){
      stockColor = "#f39c12"; // 橙
    }

    resultDiv.innerHTML += `
      <div style="
        background:${bgColor};
        padding:10px;
        border-radius:12px;
        margin-bottom:10px;
        display:flex;
        align-items:center;
        gap:10px;
      ">

        <!-- 左侧图片 -->
        <div onclick="openModal('${imageUrl}')">
          <img src="${imageUrl}"
            style="width:65px;height:65px;border-radius:6px;object-fit:cover;"
            onerror="this.style.display='none'">
        </div>

        <!-- 中间信息 -->
        <div style="flex:1;">

          <div style="font-weight:bold;font-size:15px;">
            ${item.code}
          </div>

          <div style="font-size:13px;color:#555;">
            ${item.spec || "-"} | 色号 ${item.color}
          </div>

          <div style="margin-top:6px;font-size:13px;">
            留货 ${item.reserved}
          </div>

        </div>

        <!-- 右侧区域 -->
        <div style="text-align:right;">

          <div style="
            font-size:12px;
            padding:3px 8px;
            border-radius:20px;
            background:#333;
            color:#fff;
            margin-bottom:6px;
          ">
            ${item.warehouse}
          </div>

          <div style="
            font-size:16px;
            font-weight:bold;
            padding:6px 10px;
            border-radius:8px;
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
