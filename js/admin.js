import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
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

/* DOM */
const loginSection = document.getElementById("loginSection");
const adminSection = document.getElementById("adminSection");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");

const searchCode = document.getElementById("searchCode");
const btnSearch = document.getElementById("btnSearch");
const searchResult = document.getElementById("searchResult");
const selectedInfo = document.getElementById("selectedInfo");

const operateQty = document.getElementById("operateQty");
const operateCustomer = document.getElementById("operateCustomer");
const operatePaid = document.getElementById("operatePaid");

const btnIn = document.getElementById("btnIn");
const btnOut = document.getElementById("btnOut");
const logList = document.getElementById("logList");

let selectedItem = null;

/* 登录 */
btnLogin.onclick = () => {
  signInWithEmailAndPassword(auth,
    document.getElementById("email").value,
    document.getElementById("password").value
  ).then(()=>alert("登录成功"))
   .catch(e=>alert(e.message));
};

btnLogout.onclick = ()=>signOut(auth);

onAuthStateChanged(auth,user=>{
  if(user){
    loginSection.style.display="none";
    adminSection.style.display="block";
    loadLogs();
  }else{
    loginSection.style.display="block";
    adminSection.style.display="none";
  }
});

/* 搜索 */
btnSearch.onclick = async ()=>{
  const keyword = searchCode.value.trim().toLowerCase();
  if(!keyword) return;

  const snap = await getDocs(collection(db,"inventory"));
  const list = snap.docs.map(d=>({id:d.id,...d.data()}))
    .filter(i=>i.code.toLowerCase().includes(keyword));

  if(list.length===0){
    alert("未找到库存");
    searchResult.innerHTML="";
    return;
  }

  searchResult.innerHTML="";
  list.forEach(item=>{
    const available = item.stock - item.reserved;
    searchResult.innerHTML += `
      <div style="border:1px solid #ccc;padding:10px;margin:5px;">
        编号:${item.code} |
        规格:${item.spec} |
        色号:${item.color} |
        仓库:${item.warehouse} |
        总库存:${item.stock} |
        留货:${item.reserved} |
        可用:${available}
        <button onclick="selectItem('${item.id}')">选择</button>
      </div>
    `;
  });

  window.selectItem = (id)=>{
    selectedItem = list.find(i=>i.id===id);
    selectedInfo.innerHTML =
      `已选择：${selectedItem.code} (${selectedItem.warehouse})`;
  };
};

/* 入库 */
btnIn.onclick = async ()=>{
  if(!selectedItem){ alert("请先选择库存"); return;}
  const qty = Number(operateQty.value);
  if(!qty) return;

  const ref = doc(db,"inventory",selectedItem.id);
  await updateDoc(ref,{
    stock: selectedItem.stock + qty
  });

  await addDoc(collection(db,"logs"),{
    type:"in",
    code:selectedItem.code,
    warehouse:selectedItem.warehouse,
    qty,
    date:new Date(),
    reverted:false
  });

  alert("入库成功");
  operateQty.value="";
};

/* 出库 */
btnOut.onclick = async ()=>{
  if(!selectedItem){ alert("请先选择库存"); return;}
  const qty = Number(operateQty.value);
  const customer = operateCustomer.value.trim();
  const paid = operatePaid.checked;

  if(!qty || !customer){ alert("填写完整"); return;}

  const available = selectedItem.stock - selectedItem.reserved;
  if(qty>available){
    alert("库存不足，可用："+available);
    return;
  }

  const ref = doc(db,"inventory",selectedItem.id);
  await updateDoc(ref,{
    stock: selectedItem.stock - qty
  });

  await addDoc(collection(db,"logs"),{
    type:"out",
    code:selectedItem.code,
    warehouse:selectedItem.warehouse,
    qty,
    customer,
    paid,
    date:new Date(),
    reverted:false
  });

  alert("出库成功");
  operateQty.value="";
};

/* 日志 */
async function loadLogs(){
  const snap = await getDocs(collection(db,"logs"));
  logList.innerHTML="";
  snap.docs.forEach(d=>{
    const log=d.data();
    logList.innerHTML+=`
      <div>
        ${log.type} | ${log.code} | ${log.qty}
      </div>
    `;
  });
}
