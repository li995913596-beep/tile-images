import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const btnSearch = document.getElementById("btnSearch");
const btnRefresh = document.getElementById("btnRefresh");
const resultDiv = document.getElementById("result");
const searchInput = document.getElementById("searchInput");
const updateTime = document.getElementById("updateTime");

btnRefresh.onclick = () => location.reload();

btnSearch.addEventListener("click", async () => {

  const keyword = searchInput.value.trim().toLowerCase();
  resultDiv.innerHTML = "";

  if (!keyword) {
    resultDiv.innerHTML = "<p class='error'>请输入编号或色号</p>";
    return;
  }

  updateTime.innerText = "查询时间：" + new Date().toLocaleString();

  const snap = await getDocs(collection(db, "inventory"));
  let found = false;

  for (const docSnap of snap.docs) {

    const item = docSnap.data();

    if (
      item.code?.toLowerCase().includes(keyword) ||
      item.color?.toLowerCase().includes(keyword)
    ) {

      found = true;

      const stock = Number(item.stock || 0);
      const reservedTotal = (item.reservedList || [])
        .reduce((sum, r) => sum + Number(r.qty), 0);

      const imageUrl = `images/${item.code}.jpg`;

      // 查最后一次出库时间
      const logQuery = query(
        collection(db, "logs"),
        where("code", "==", item.code),
        where("type", "==", "出库"),
        orderBy("date", "desc"),
        limit(1)
      );

      const logSnap = await getDocs(logQuery);
      let lastOut = "无出库记录";
      if (!logSnap.empty) {
        lastOut = logSnap.docs[0].data().date;
      }

      resultDiv.innerHTML += `
        <div class="card">

          <img src="${imageUrl}" 
               onerror="this.style.display='none'">

          <div class="card-info">

            <div class="title">
              ${item.code}
              <span class="spec">${item.spec || ""}</span>
            </div>

            <div class="meta">
              色号：${item.color} | 仓库：${item.warehouse}
            </div>

            <div class="stock-line">
              库存：
              <span class="${stock<=10?'low':'normal'}">
                ${stock}
              </span>
              留货：${reservedTotal}
            </div>

            <div class="last-out">
              上次出库：${lastOut}
            </div>

          </div>
        </div>
      `;
    }

  }

  if (!found) {
    resultDiv.innerHTML = "<p class='error'>未找到库存</p>";
  }

});
