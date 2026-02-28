import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const btnSearch=document.getElementById("btnSearch");
const btnRefresh=document.getElementById("btnRefresh");
const resultDiv=document.getElementById("result");
const searchInput=document.getElementById("searchInput");

btnSearch.onclick=searchData;
btnRefresh.onclick=()=>{
  searchInput.value="";
  resultDiv.innerHTML="";
};

async function searchData(){

  const keyword=searchInput.value.trim().toLowerCase();
  resultDiv.innerHTML="";

  const snap=await getDocs(collection(db,"inventory"));

  let list=[];

  snap.forEach(doc=>{
    const item=doc.data();
    const code=(item.code||"").toLowerCase();
    const color=(item.color||"").toLowerCase();

    if(code.includes(keyword)||color.includes(keyword)){
      const reserved=Array.isArray(item.reservedList)
        ?item.reservedList.reduce((s,r)=>s+Number(r.qty||0),0)
        :0;

      list.push({...item,reserved});
    }
  });

  if(list.length===0){
    resultDiv.innerHTML="未找到库存";
    return;
  }

  resultDiv.innerHTML=`
    <div class="table-header">
      <div>图片</div>
      <div>编号</div>
      <div>规格</div>
      <div>色号</div>
      <div>数量</div>
      <div>仓库</div>
      <div>留货</div>
    </div>
  `;

  list.forEach(item=>{

    const imageUrl=
      window.location.origin+
      "/tile-images/images/"+item.code+".jpg";

    resultDiv.innerHTML+=`
      <div class="table-row">

        <div class="img-col"
          onclick="openModal('${imageUrl}')">
          <img src="${imageUrl}"
            loading="lazy"
            onerror="this.style.display='none'">
        </div>

        <div><b>编号：</b>${item.code}</div>
        <div><b>规格：</b>${item.spec||"-"}</div>
        <div><b>色号：</b>${item.color||"-"}</div>

        <div class="${item.stock<10?'low-stock':''}">
          <b>数量：</b>${item.stock}
        </div>

        <div><b>仓库：</b>${item.warehouse||"-"}</div>
        <div><b>留货：</b>${item.reserved}</div>

      </div>
    `;
  });
}
