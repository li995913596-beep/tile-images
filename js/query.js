import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const btnSearch = document.getElementById("btnSearch");
const searchInput = document.getElementById("searchInput");
const resultDiv = document.getElementById("result");

btnSearch.addEventListener("click", async () => {

  const keyword = searchInput.value.trim().toLowerCase();
  resultDiv.innerHTML = "";

  if (!keyword) {
    resultDiv.innerHTML = "<p style='color:red;'>请输入编号或色号</p>";
    return;
  }

  try {

    const snapshot = await getDocs(collection(db, "inventory"));

    let found = false;

    snapshot.forEach(doc => {

      const item = doc.data();

      if (
        item.code?.toLowerCase().includes(keyword) ||
        item.color?.toLowerCase().includes(keyword)
      ) {

        found = true;

        const stock = Number(item.stock || 0);

        const reservedTotal = Array.isArray(item.reservedList)
          ? item.reservedList.reduce(
              (sum, r) => sum + Number(r.qty || 0),
              0
            )
          : 0;

        const imageUrl = `images/${item.code}.jpg`;

        resultDiv.innerHTML += `
          <div style="
            background:#fff;
            padding:15px;
            margin:10px 0;
            border-radius:8px;
            display:flex;
            gap:15px;
            align-items:center;
          ">
            
            <img 
              src="${imageUrl}" 
              style="width:120px;height:120px;object-fit:cover;border-radius:6px;"
              onerror="this.src='https://li995913596-beep.github.io/tile-images/image/default.jpg'"
            />

            <div>
              <b>${item.code} (${item.warehouse})</b><br>
              规格: ${item.spec} | 色号: ${item.color}<br>
              剩余库存: 
                <span style="color:${stock <= 10 ? "red" : "green"};font-weight:bold">
                  ${stock}
                </span><br>
              留货: ${reservedTotal}
            </div>

          </div>
        `;
      }
    });

    if (!found) {
      resultDiv.innerHTML = "<p style='color:red;'>未找到库存</p>";
    }

  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = "<p style='color:red;'>查询失败，请查看控制台</p>";
  }

});
