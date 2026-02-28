import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const btnSearch = document.getElementById("btnSearch");
const btnRefresh = document.getElementById("btnRefresh");
const resultDiv = document.getElementById("result");
const searchInput = document.getElementById("searchInput");
const updateTime = document.getElementById("updateTime");

async function searchData() {

  const keyword = searchInput.value.trim().toLowerCase();

  resultDiv.innerHTML = "";

  if (!keyword) {
    resultDiv.innerHTML =
      "<div style='padding:20px;color:#999'>请输入编号或色号</div>";
    return;
  }

  const snap = await getDocs(collection(db, "inventory"));

  let found = false;

  snap.forEach(doc => {

    const item = doc.data();

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
        : Number(item.reserved || 0);

      const imageUrl = `/tile-images/images/${item.code}.jpg`;

      resultDiv.innerHTML += `
        <div class="row">
          <div>
            < img 
              src="${imageUrl}"
              loading="lazy"
              onerror="this.style.display='none'"
            >
          </div>
          <div>${item.code}</div>
          <div>${item.color}</div>
          <div>
            <div class="qty ${stock > 10 ? "green" : "red"}">
              ${stock}
            </div>
          </div>
          <div>${item.warehouse}</div>
          <div>${reserved}</div>
        </div>
      `;
    }

  });

  if (!found) {
    resultDiv.innerHTML =
      "<div style='padding:20px;color:#999'>未找到库存</div>";
  }

  updateTime.innerText = new Date().toLocaleString();
}

btnSearch.onclick = searchData;

btnRefresh.onclick = () => {
  searchInput.value = "";
  resultDiv.innerHTML =
    "<div style='padding:20px;color:#999'>请输入编号或色号</div>";
};
