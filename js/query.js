import { db } from "./firebase.js";
import { collection, getDocs } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const inventoryRef = collection(db, "inventory");

let inventoryData = [];
let currentPage = 1;
const pageSize = 10;

async function loadData() {
  const snap = await getDocs(inventoryRef);
  inventoryData = snap.docs.map(d => d.data());
}

function render() {
  const keyword = searchInput.value.toLowerCase();
  const filtered = inventoryData.filter(item =>
    item.code.toLowerCase().includes(keyword)
  );

  const start = (currentPage - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  inventoryList.innerHTML = "";

  pageData.forEach(item => {
    const remaining = item.stock - item.reserved;

    let stockClass = "stock-green";
    if (remaining < 10) stockClass = "stock-red";
    else if (remaining < 100) stockClass = "stock-orange";

    inventoryList.innerHTML += `
      <div class="card">
        <img src="images/${item.code}.jpg"
             onerror="this.src='images/default.jpg'">
        <div class="card-content">
          <div><b>${item.code}</b> (${item.warehouse})</div>
          <div>规格: ${item.spec} | 色号: ${item.color}</div>
          <div>剩余库存: <span class="${stockClass}">${remaining}</span></div>
          <div>留货: ${item.reserved}</div>
        </div>
      </div>
    `;
  });

  renderPagination(filtered.length);
}

function renderPagination(total) {
  const totalPages = Math.ceil(total / pageSize);
  pagination.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    pagination.innerHTML +=
      `<button onclick="goPage(${i})">${i}</button>`;
  }
}

window.goPage = function(page) {
  currentPage = page;
  render();
};

btnSearch.onclick = render;
btnRefresh.onclick = async () => {
  await loadData();
  render();
};

await loadData();
render();
