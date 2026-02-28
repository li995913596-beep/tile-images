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
  updateDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { importExcel } from "./excel.js";

const loginSection = document.getElementById("loginSection");
const adminSection = document.getElementById("adminSection");

const btnLogin = document.getElementById("btnLogin");
const excelFile = document.getElementById("excelFile");

const searchCode = document.getElementById("searchCode");
const btnSearch = document.getElementById("btnSearch");
const searchResult = document.getElementById("searchResult");
const selectedInfo = document.getElementById("selectedInfo");

const operateQty = document.getElementById("operateQty");
const operateCustomer = document.getElementById("operateCustomer");
const operatePaid = document.getElementById("operatePaid");

const btnIn = document.getElementById("btnIn");
const btnOut = document.getElementById("btnOut");

const reserveCustomer = document.getElementById("reserveCustomer");
const reserveQty = document.getElementById("reserveQty");
const btnReserve = document.getElementById("btnReserve");
const reserveListDiv = document.getElementById("reserveList");

let selectedItem = null;

/* 登录 */
btnLogin.onclick = () => {
  signInWithEmailAndPassword(
    auth,
    document.getElementById("email").value,
    document.getElementById("password").value
  ).then(()=>alert("登录成功"))
   .catch(e=>alert(e.message));
};

onAuthStateChanged(auth,user=>{
  if(user){
    loginSection.style.display="none";
    adminSection.style.display="block";
    loadReserveList();
  }
});

/* Excel 导入 */
excelFile.addEventListener("change",async e=>{
  await importExcel(e.target.files[0]);
});

/* 搜索 */
btnSearch.onclick = async ()=>{

  const keyword = searchCode.value.trim().toLowerCase();
  const snap = await getDocs(collection(db,"inventory"));

  const list = snap.docs
    .map(d=>({id:d.id,...d.data()}))
    .filter(i=>i.code.toLowerCase().includes(keyword)
      || i.color.toLowerCase().includes(keyword));

  searchResult.innerHTML="";

  list.forEach(item=>{

    const reservedTotal = item.reservedList
      ? item.reservedList.reduce((s,r)=>s+r.qty,0)
      : 0;

    searchResult.innerHTML+=`
      <div style="border:1px solid #ccc;margin:5px;padding:5px;">
        ${item.code} | ${item.color} | ${item.warehouse}
        | 库存:${item.stock}
        | 留货:${reservedTotal}
        <button onclick="selectItem('${item.id}')">选择</button>
      </div>
    `;
  });

  window.selectItem=id=>{
    selectedItem=list.find(i=>i.id===id);
    selectedInfo.innerHTML=`已选: ${selectedItem.code}-${selectedItem.color}`;
  };
};

/* 入库 */
btnIn.onclick=async()=>{
  if(!selectedItem) return alert("请选择库存");
  const qty=Number(operateQty.value);
  const ref=doc(db,"inventory",selectedItem.id);
  const snap=await getDoc(ref);
  await updateDoc(ref,{stock:snap.data().stock+qty});
  alert("入库成功");
};

/* 出库 */
btnOut.onclick=async()=>{
  if(!selectedItem) return alert("请选择库存");
  const qty=Number(operateQty.value);
  const customer=operateCustomer.value.trim();
  const paid=operatePaid.value;
  const ref=doc(db,"inventory",selectedItem.id);
  const snap=await getDoc(ref);
  const data=snap.data();
  if(qty>data.stock) return alert("库存不足");
  await updateDoc(ref,{stock:data.stock-qty});
  await addDoc(collection(db,"logs"),{
    type:"out",
    code:data.code,
    color:data.color,
    warehouse:data.warehouse,
    qty,
    customer,
    paid,
    date:new Date()
  });
  alert("出库成功");
};

/* 留货 */
btnReserve.onclick=async()=>{
  if(!selectedItem) return alert("请选择库存");
  const qty=Number(reserveQty.value);
  const customer=reserveCustomer.value.trim();
  const ref=doc(db,"inventory",selectedItem.id);
  const snap=await getDoc(ref);
  const data=snap.data();
  if(qty>data.stock) return alert("库存不足");
  const newReserve={
    id:Date.now().toString(),
    customer,
    qty,
    date:new Date()
  };
  const list=data.reservedList||[];
  await updateDoc(ref,{
    stock:data.stock-qty,
    reservedList:[...list,newReserve]
  });
  alert("留货成功");
  loadReserveList();
};

/* 全局留货清单 */
async function loadReserveList(){
  const snap=await getDocs(collection(db,"inventory"));
  let html="";
  snap.docs.forEach(d=>{
    const item=d.data();
    if(item.reservedList){
      item.reservedList.forEach(r=>{
        html+=`
          <div style="border:1px solid #ccc;margin:4px;padding:4px;">
            ${item.code}|${item.color}|${item.warehouse}
            | 客户:${r.customer}
            | 数量:${r.qty}
          </div>
        `;
      });
    }
  });
  reserveListDiv.innerHTML=html;
}
