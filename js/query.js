import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const btnSearch = document.getElementById("btnSearch");
const resultDiv = document.getElementById("result");
const searchInput = document.getElementById("searchInput");

btnSearch.addEventListener("click", async () => {

  const keyword = searchInput.value.trim().toLowerCase();
  resultDiv.innerHTML = "";

  if (!keyword) {
    resultDiv.innerHTML = "<p style='color:red'>请输入编号或色号</p>";
    return;
  }

  const snap = await getDocs(collection(db, "inventory"));
  let found = false;

  // 表头
  resultDiv.innerHTML = `
    <div class="table-header">
      <div style="width:60px;"></div>
      <div>编号</div>
      <div>规格</div>
      <div>色号</div>
      <div>数量</div>
      <div>仓库</div>
      <div>留货</div>
    </div>
  `;

  snap.forEach(doc => {

    const item = doc.data();

    if (
      item.code?.toLowerCase().includes(keyword) ||
      item.color?.toLowerCase().includes(keyword)
    ) {

      found = true;

      const stock = Number(item.stock || 0);
      const reservedTotal = (item.reservedList || [])
        .reduce((sum, r) => sum + Number(r.qty), 0);

      const imageUrl = `images/${item.code}.jpg`;

      resultDiv.innerHTML += `
        <div class="table-row">

          <img 
            src="${imageUrl}"
            class="row-image"
            onerror="this.style.display='none'"
          />

          <div>${item.code}</div>
          <div>${item.spec || ""}</div>
          <div>${item.color}</div>
          <div style="color:${stock<=10?'red':'green'};">
            ${stock}
          </div>
          <div>${item.warehouse}</div>
          <div>${reservedTotal}</div>

        </div>
      `;
    }

  });

  if (!found) {
    resultDiv.innerHTML = "<p style='color:red'>未找到库存</p>";
  }

});
