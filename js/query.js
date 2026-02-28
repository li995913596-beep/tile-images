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

  try {

    const snap = await getDocs(collection(db, "inventory"));
    let found = false;

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
          <div style="
            background:#fff;
            padding:15px;
            margin:15px 0;
            border-radius:10px;
            display:flex;
            gap:20px;
            align-items:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.1);
          ">

            <div style="
              width:130px;
              height:130px;
              background:#f2f2f2;
              border-radius:8px;
              overflow:hidden;
              display:flex;
              align-items:center;
              justify-content:center;
            ">
              <img 
                src="${imageUrl}"
                style="width:100%;height:100%;object-fit:cover;"
                onerror="this.style.display='none'"
              />
            </div>

            <div>
              <h3>${item.code} (${item.warehouse})</h3>
              规格: ${item.spec}<br>
              色号: ${item.color}<br>
              剩余库存: 
              <span style="color:${stock <= 10 ? "red" : "green"};font-weight:bold;">
                ${stock}
              </span>
              <br>
              留货: ${reservedTotal}
            </div>

          </div>
        `;
      }

    });

    if (!found) {
      resultDiv.innerHTML = "<p style='color:red'>未找到库存</p>";
    }

  } catch (e) {
    console.error(e);
    resultDiv.innerHTML = "<p style='color:red'>查询失败</p>";
  }

});
