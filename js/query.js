import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const btnSearch=document.getElementById("btnSearch");
const btnRefresh=document.getElementById("btnRefresh");
const resultDiv=document.getElementById("result");
const searchInput=document.getElementById("searchInput");

let dataList=[];
let sortAsc=false;

btnSearch.onclick=searchData;
btnRefresh.onclick=()=>{
  searchInput.value="";
  resultDiv.innerHTML="";
};

async function searchData(){

  const keyword=searchInput.value.trim().toLowerCase();
  resultDiv.innerHTML="";
  dataList=[];

  const snap=await getDocs(collection(db,"inventory"));

  snap.forEach(doc=>{
    const item=doc.data();
    const code=(item.code||"").toLowerCase();
    const color=(item.color||"").toLowerCase();

    if(code.includes(keyword)||color.includes(keyword)){
      const reserved=Array.isArray(item.reservedList)
        ?item.reservedList.reduce((s,r)=>s+Number(r.qty||0),0)
        :0;

      dataList.push({
        ...item,
        stock:Number(item.stock||0),
        reserved
      });
    }
  });

  renderTable();
}

function renderTable(){

  dataList.sort((a,b)=>{
    return sortAsc?a.stock-b.stock:b.stock-a.stock;
  });

  resultDiv.innerHTML=`
    <div class="table-header">
      <div class="col img-col">图片</div>
      <div class="col">编号</div>
      <div class="col">规格</div>
      <div class="col">色号</div>
      <div class="col" onclick="toggleSort()">数量</div>
      <div class="col">仓库</div>
      <div class="col">留货</div>
    </div>
  `;

  dataList.forEach(item=>{

    const imageUrl=
      window.location.origin+
      "/tile-images/images/"+item.code+".jpg";

    resultDiv.innerHTML+=`
      <div class="table-row">

        <div class="col img-col"
          onclick="openModal('${imageUrl}')">
          <img src="${imageUrl}"
          loading="lazy"
          onerror="this.style.display='none'">
        </div>

        <div class="col">${item.code}</div>
        <div class="col">${item.spec||"-"}</div>
        <div class="col">${item.color||"-"}</div>

        <div class="col ${item.stock<10?'low-stock':''}">
          ${item.stock}
        </div>

        <div class="col">${item.warehouse||"-"}</div>
        <div class="col">${item.reserved}</div>

      </div>
    `;
  });
}

window.toggleSort=function(){
  sortAsc=!sortAsc;
  renderTable();
};
