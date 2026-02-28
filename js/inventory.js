import { db } from "./firebase.js";
import { collection, getDocs } from 
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const inventoryRef = collection(db,"inventory");
let inventoryData = [];
let currentPage = 1;
const pageSize = 10;

async function loadData(){
  const snap = await getDocs(inventoryRef);
  inventoryData = snap.docs.map(d=>d.data());
}

function render(){
  const keyword = searchInput.value.toLowerCase();
  const filtered = inventoryData.filter(i =>
    i.code.toLowerCase().includes(keyword)
  );

  const start = (currentPage-1)*pageSize;
  const pageData = filtered.slice(start,start+pageSize);

  inventoryList.innerHTML = "";

  pageData.forEach(item=>{
    const remaining = item.stock-item.reserved;
    let colorClass = "green";
    if(remaining < 10) colorClass="red";
    else if(remaining < 100) colorClass="orange";

    inventoryList.innerHTML += `
      <div class="card">
        <b>${item.code}</b> (${item.warehouse})<br>
        规格: ${item.spec} | 色号: ${item.color}<br>
        剩余库存: <span class="${colorClass}">${remaining}</span><br>
        留货: ${item.reserved}
      </div>
    `;
  });

  renderPagination(filtered.length);
}

function renderPagination(total){
  const totalPages = Math.ceil(total/pageSize);
  pagination.innerHTML="";
  for(let i=1;i<=totalPages;i++){
    pagination.innerHTML+=
    `<button onclick="goPage(${i})">${i}</button>`;
  }
}

window.goPage=(p)=>{
  currentPage=p;
  render();
}

btnSearch.onclick=render;

await loadData();
render();
