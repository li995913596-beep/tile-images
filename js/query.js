import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const btnSearch = document.getElementById("btnSearch");
const btnRefresh = document.getElementById("btnRefresh");
const resultDiv = document.getElementById("result");
const searchInput = document.getElementById("searchInput");

btnSearch.onclick = searchData;

btnRefresh.onclick = () => {
  searchInput.value = "";
  resultDiv.innerHTML = "";
};

async function searchData(){

  const keyword = searchInput.value.trim().toLowerCase();
  resultDiv.innerHTML = "";

  if(!keyword){
    resultDiv.innerHTML = "请输入编号或规格 / Please enter Code or Size";
    return;
  }

  const snap = await getDocs(collection(db,"inventory"));
  let list = [];

  snap.forEach(doc=>{
    const item = doc.data();

    const code = String(item.code || "").toLowerCase();
    const spec = String(item.spec || "").toLowerCase();

    // 只搜索编号 + 规格
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

  // 表头（保持你原结构）
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

    const imageUrl =
      window.location.origin +
      "/tile-images/images/" + item.code + ".jpg";

    const lowStock = item.stock < 10;

    resultDiv.innerHTML+=`
      <div class="table-row">

        <div class="img-col"
          data-label="Image"
          onclick="openModal('${imageUrl}')">
          <img src="${imageUrl}"
            loading="lazy"
            onerror="this.style.display='none'">
        </div>

        <div data-label="Code">${item.code}</div>
        <div data-label="Size">${item.spec||"-"}</div>
        <div data-label="Color">${item.color||"-"}</div>

        <div data-label="Stock"
             class="${lowStock?'low-stock':''}">
          ${item.stock}
        </div>

        <div data-label="Warehouse">${item.warehouse||"-"}</div>
        <div data-label="Reserved">${item.reserved}</div>

      </div>
    `;
  });

}
