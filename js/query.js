import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const btnSearch = document.getElementById("btnSearch");
const btnRefresh = document.getElementById("btnRefresh");
const resultDiv = document.getElementById("result");
const searchInput = document.getElementById("searchInput");

async function searchData() {

  const keyword = searchInput.value.trim().toLowerCase();
  resultDiv.innerHTML = "";

  if (!keyword) {
    resultDiv.innerHTML = `<div class="empty">请输入编号或色号</div>`;
    return;
  }

  const snap = await getDocs(collection(db, "inventory"));
  let found = false;

  snap.forEach(docSnap => {

    const item = docSnap.data();
    const code = String(item.code || "").toLowerCase();
    const color = String(item.color || "").toLowerCase();

    if (code.includes(keyword) || color.includes(keyword)) {

      found = true;

      const stock = Number(item.stock || 0);

      const reserved = Array.isArray(item.reservedList)
        ? item.reservedList.reduce(
            (sum, r) => sum + Number(r.qty || 0),
            0
          )
        : 0;

      const imageUrl =
        `${window.location.origin}/tile-images/images/${item.code}.jpg`;

      let updateText = "";

      if (item.lastUpdate && item.lastUpdate.toDate) {
        const date = item.lastUpdate.toDate();
        updateText = `
          <div class="update-time">
            最近操作时间：${date.toLocaleString()}
          </div>
        `;
      }

      resultDiv.innerHTML += `
        <div class="card">
          <div class="card-row">

            <div class="img-box" onclick="openModal('${imageUrl}')">
              <img
                src="${imageUrl}"
                loading="lazy"
                onerror="this.style.display='none'"
              />
            </div>

            <div class="info">
              <div class="title">${item.code}</div>
              <div class="sub">
                规格：${item.spec || "-"}　
                色号：${item.color || "-"}
              </div>
              ${updateText}
            </div>

            <div class="right">
              <div class="qty ${stock > 10 ? "green" : "red"}">
                ${stock}
              </div>
              <div class="sub">
                仓库：${item.warehouse || "-"}
              </div>
              <div class="sub">
                留货：${reserved}
              </div>
            </div>

          </div>
        </div>
      `;
    }

  });

  if (!found) {
    resultDiv.innerHTML = `<div class="empty">未找到库存</div>`;
  }
}

btnSearch.onclick = searchData;

btnRefresh.onclick = () => {
  searchInput.value = "";
  resultDiv.innerHTML = `<div class="empty">请输入编号或色号</div>`;
};
