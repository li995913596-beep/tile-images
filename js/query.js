import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const btnSearch = document.getElementById("btnSearch");
const btnRefresh = document.getElementById("btnRefresh");
const resultDiv = document.getElementById("result");
const searchInput = document.getElementById("searchInput");


window.searchData = async function(){
  console.log("searchData 开始执行");
  const keyword = searchInput.value.trim().toLowerCase();
  resultDiv.innerHTML = "";

  if(!keyword){
    resultDiv.innerHTML = "请输入编号或规格 / Please enter Code or Size";
    return;
  }

  const q = query(
  collection(db, "inventory"),
  where("code", ">=", keyword),
  where("code", "<=", keyword + "\uf8ff")
);

const snap = await getDocs(q);
  let list = [];

  snap.forEach(doc=>{
    const item = doc.data();
    const code = String(item.code || "").toLowerCase();
    const spec = String(item.spec || "").toLowerCase();

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
}
btnSearch.addEventListener("click", window.searchData);
btnRefresh.addEventListener("click", () => {
searchInput.value = "";
resultDiv.innerHTML = "";
});
/* ===== 桌面版 ===== */

function buildDesktop(list){

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

/* ===== 手机高级卡片版 ===== */

function buildMobile(list){

  resultDiv.innerHTML="";

  list.forEach(item=>{

    const imageUrl = window.location.origin +
      "/images/" + item.code + ".jpg";

    const stockClass =
      item.stock==0 ? "stock-zero" :
      item.stock<10 ? "stock-low" :
      "stock-ok";

    resultDiv.innerHTML+=`
      <div class="mobile-card">

        <div class="mobile-left"
          onclick="openModal('${imageUrl}')">
          <img src="${imageUrl}" loading="lazy"
          onerror="this.style.display='none'">
        </div>

        <div class="mobile-right">

          <div class="row">
            <span class="label">编号 Code</span>
            <span>${item.code}</span>
          </div>

          <div class="row">
            <span class="label">规格 Size</span>
            <span>${item.spec||"-"}</span>
          </div>

          <div class="row">
            <span class="label">色号 Color</span>
            <span>${item.color||"-"}</span>
          </div>

          <div class="row">
            <span class="label">仓库 Warehouse</span>
            <span>${item.warehouse||"-"}</span>
          </div>

          <div class="row">
            <span class="label">留货 Reserved</span>
            <span>${item.reserved}</span>
          </div>

          <div class="row">
            <span class="label">数量 Stock</span>
            <span class="stock-badge ${stockClass}">
              ${item.stock}
            </span>
          </div>

        </div>
      </div>
    `;
  });
}
