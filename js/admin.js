import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { importExcel } from "./excel.js";

let selectedItem=null;

/* 登录 */
btnLogin.onclick=()=>{
  signInWithEmailAndPassword(auth,email.value,password.value)
  .then(()=>alert("登录成功"))
  .catch(e=>alert(e.message));
};

onAuthStateChanged(auth,user=>{
  if(user){
    loginSection.style.display="none";
    adminSection.style.display="block";
    loadReserveList();
  }
});

/* Excel */
excelFile.onchange=e=>importExcel(e.target.files[0]);

/* 搜索 */
btnSearch.onclick=async()=>{
  const key=searchCode.value.trim().toLowerCase();
  const snap=await getDocs(collection(db,"inventory"));

  searchResult.innerHTML="";

  snap.docs.forEach(d=>{
    const item=d.data();
    if(item.code.toLowerCase().includes(key) || item.color.toLowerCase().includes(key)){

      const reservedTotal=(item.reservedList||[])
      .reduce((s,r)=>s+Number(r.qty||0),0);

      searchResult.innerHTML+=`
      <div class="card">
      ${item.code}|${item.color}|${item.warehouse}
      库存:${item.stock}
      留货:${reservedTotal}
      <button onclick="selectItem('${d.id}')">选择</button>
      </div>`;
    }
  });

  window.selectItem=id=>{
    selectedItem=id;
    selectedInfo.innerText="已选择:"+id;
  };
};

/* 留货 */
btnReserve.onclick=async()=>{
  if(!selectedItem) return alert("请选择库存");

  const qty=Number(reserveQty.value);
  const customer=reserveCustomer.value.trim();

  const ref=doc(db,"inventory",selectedItem);
  const snap=await getDoc(ref);
  const data=snap.data();

  if(qty>data.stock) return alert("库存不足");

  const list=data.reservedList||[];

  list.push({
    id:Date.now().toString(),
    customer,
    qty,
    date:new Date()
  });

  await updateDoc(ref,{
    stock:data.stock-qty,
    reservedList:list
  });

  loadReserveList();
};

/* 全局留货清单 + 编辑 */
async function loadReserveList(){

  const snap=await getDocs(collection(db,"inventory"));
  reserveList.innerHTML="";

  snap.docs.forEach(d=>{
    const item=d.data();

    (item.reservedList||[]).forEach(r=>{

      reserveList.innerHTML+=`
      <div class="card">
      ${item.code}|${item.color}|${item.warehouse}
      客户:${r.customer}
      数量:<input type="number" value="${r.qty}" 
      onchange="editReserve('${d.id}','${r.id}',this.value)">
      <button onclick="deleteReserve('${d.id}','${r.id}',${r.qty})">
      删除</button>
      </div>`;
    });
  });
}

/* 编辑 */
window.editReserve=async(invId,resId,newQty)=>{
  const ref=doc(db,"inventory",invId);
  const snap=await getDoc(ref);
  const data=snap.data();

  const list=data.reservedList;
  const item=list.find(i=>i.id===resId);

  const diff=newQty-item.qty;
  item.qty=Number(newQty);

  await updateDoc(ref,{
    stock:data.stock-diff,
    reservedList:list
  });

  loadReserveList();
};

/* 删除 */
window.deleteReserve=async(invId,resId,qty)=>{
  const ref=doc(db,"inventory",invId);
  const snap=await getDoc(ref);
  const data=snap.data();

  const list=data.reservedList.filter(i=>i.id!==resId);

  await updateDoc(ref,{
    stock:data.stock+qty,
    reservedList:list
  });

  loadReserveList();
};
