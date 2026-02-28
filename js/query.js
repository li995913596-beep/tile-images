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

async function loadData(keyword = "") {

  resultDiv.innerHTML = "";

  const snap = await getDocs(collection(db, "inventory"));

  let found = false;

  snap.forEach(doc => {

    const item = doc.data();

    const code = (item.code || "").toString().toLowerCase();
    const color = (item.color || "").toString().toLowerCase();

    if (
      keyword === "" ||
      code.includes(keyword) ||
      color.includes(keyword)
    ) {

      found = true;

      const stock = Number(item.stock || 0);
      const reserved = Array.isArray(item.reservedList)
        ? item.reservedList.reduce((s, r) => s + Number(r.qty || 0), 0)
        : Number(item.reserved || 0);

      resultDiv.innerHTML += `
        <div class="row">
          <div>
            < img src="images/${item.code}.jpg"
                 onerror="this.style.display='none'">
          </div>
          <div>${item.code}</div>
          <div>${item.color}</div>
          <div>
            <div class="qty ${stock > 10 ? 'green' : 'red'}">
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
    resultDiv.innerHTML = "<div style='padding:20px;color:#999'>未找到库存</div>";
  }

  updateTime.innerText = new Date().toLocaleString();
}

btnSearch.onclick = () => {
  const keyword = searchInput.value.trim().toLowerCase();
  loadData(keyword);
};

btnRefresh.onclick = () => {
  searchInput.value = "";
  loadData();
};

// 页面加载自动显示全部库存
loadData();
