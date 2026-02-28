import { db, auth } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* 登录 */

btnLogin.onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
    alert("登录成功");
  } catch {
    alert("登录失败");
  }
};

btnLogout.onclick = async () => {
  await signOut(auth);
};

onAuthStateChanged(auth, user => {
  if (user) {
    loginSection.style.display = "none";
    adminSection.style.display = "block";
    initTabs();
  } else {
    loginSection.style.display = "block";
    adminSection.style.display = "none";
  }
});

/* 页面切换 */

window.showTab = (name) => {
  document.querySelectorAll(".tab").forEach(t => t.style.display="none");
  document.getElementById("tab_"+name).style.display="block";
};

/* 初始化 */

function initTabs(){
  buildInPage();
  buildOutPage();
  buildReservePage();
  buildLogPage();
}

/* 入库 */

function buildInPage(){
  tab_in.innerHTML = `
    <h3>入库</h3>
    <input id="in_search" placeholder="搜索编号">
    <button onclick="searchIn()">搜索</button>
    <div id="in_result"></div>
    <h4>新增库存</h4>
    编号<input id="new_code">
    规格<input id="new_spec">
    色号<input id="new_color">
    仓库<input id="new_warehouse">
    数量<input id="new_qty">
    <button onclick="addNewStock()">新增</button>
  `;
}

window.searchIn = async ()=>{
  const snap = await getDocs(collection(db,"inventory"));
  in_result.innerHTML="";
  snap.forEach(d=>{
    const i=d.data();
    if(i.code.includes(in_search.value)){
      in_result.innerHTML+=`
        <div>
          ${i.code}|${i.color}|库存:${i.stock}
          数量<input id="in_qty_${d.id}">
          <button onclick="inStock('${d.id}')">入库</button>
        </div>`;
    }
  });
};

window.inStock = async (id)=>{
  const ref=doc(db,"inventory",id);
  const snap=await getDoc(ref);
  const data=snap.data();
  const qty=Number(document.getElementById("in_qty_"+id).value);
  await updateDoc(ref,{stock:data.stock+qty});
  await log("入库",data,qty);
  alert("完成");
};

window.addNewStock = async ()=>{
  const id=`${new_code.value}_${new_color.value}_${new_warehouse.value}`;
  await setDoc(doc(db,"inventory",id),{
    code:new_code.value,
    spec:new_spec.value,
    color:new_color.value,
    warehouse:new_warehouse.value,
    stock:Number(new_qty.value),
    reservedList:[]
  });
  alert("新增成功");
};

/* 出库 */

function buildOutPage(){
  tab_out.innerHTML=`
    <h3>出库</h3>
    <input id="out_search" placeholder="搜索编号">
    <button onclick="searchOut()">搜索</button>
    <div id="out_result"></div>
  `;
}

window.searchOut=async()=>{
  const snap=await getDocs(collection(db,"inventory"));
  out_result.innerHTML="";
  snap.forEach(d=>{
    const i=d.data();
    if(i.code.includes(out_search.value)){
      out_result.innerHTML+=`
        <div>
          ${i.code}|${i.color}|库存:${i.stock}
          客户<input id="out_c_${d.id}">
          数量<input id="out_q_${d.id}">
          <select id="out_p_${d.id}">
            <option>已付款</option>
            <option>未付款</option>
          </select>
          <button onclick="outStock('${d.id}')">出库</button>
        </div>`;
    }
  });
};

window.outStock=async(id)=>{
  const ref=doc(db,"inventory",id);
  const snap=await getDoc(ref);
  const data=snap.data();
  const qty=Number(document.getElementById("out_q_"+id).value);
  if(qty>data.stock)return alert("库存不足");
  await updateDoc(ref,{stock:data.stock-qty});
  await log("出库",data,qty,
    document.getElementById("out_c_"+id).value,
    document.getElementById("out_p_"+id).value);
  alert("完成");
};

/* 留货 */

function buildReservePage(){
  tab_reserve.innerHTML=`
    <h3>留货</h3>
    <input id="re_search" placeholder="搜索编号">
    <button onclick="searchReserve()">搜索</button>
    <div id="re_result"></div>
    <h4>留货清单</h4>
    <div id="reserveList"></div>
  `;
  loadReserve();
}

window.searchReserve=async()=>{
  const snap=await getDocs(collection(db,"inventory"));
  re_result.innerHTML="";
  snap.forEach(d=>{
    const i=d.data();
    if(i.code.includes(re_search.value)){
      re_result.innerHTML+=`
        <div>
          ${i.code}|${i.color}|库存:${i.stock}
          客户<input id="re_c_${d.id}">
          数量<input id="re_q_${d.id}">
          <button onclick="reserveStock('${d.id}')">留货</button>
        </div>`;
    }
  });
};

window.reserveStock=async(id)=>{
  const ref=doc(db,"inventory",id);
  const snap=await getDoc(ref);
  const data=snap.data();
  const qty=Number(document.getElementById("re_q_"+id).value);
  if(qty>data.stock)return alert("库存不足");
  const list=data.reservedList||[];
  list.push({customer:document.getElementById("re_c_"+id).value,qty});
  await updateDoc(ref,{stock:data.stock-qty,reservedList:list});
  loadReserve();
};

async function loadReserve(){
  const snap=await getDocs(collection(db,"inventory"));
  reserveList.innerHTML="";
  snap.forEach(d=>{
    const i=d.data();
    (i.reservedList||[]).forEach((r,index)=>{
      reserveList.innerHTML+=`
        <div>
          ${i.code}|${r.customer}|${r.qty}
          <button onclick="deleteReserve('${d.id}',${index})">删</button>
        </div>`;
    });
  });
}

window.deleteReserve=async(id,index)=>{
  const ref=doc(db,"inventory",id);
  const snap=await getDoc(ref);
  const data=snap.data();
  data.reservedList.splice(index,1);
  await updateDoc(ref,{reservedList:data.reservedList});
  loadReserve();
};

/* 日志 */

function buildLogPage(){
  tab_log.innerHTML=`
    <h3>日志</h3>
    <button onclick="downloadLogs()">下载CSV</button>
  `;
}

async function log(type,data,qty,customer="",paid=""){
  await addDoc(collection(db,"logs"),{
    date:new Date().toLocaleString(),
    type,
    code:data.code,
    color:data.color,
    warehouse:data.warehouse,
    qty,
    customer,
    paid
  });
}

window.downloadLogs=async()=>{
  const snap=await getDocs(collection(db,"logs"));
  let csv="日期,类型,编号,色号,仓库,数量,客户,付款\n";
  snap.forEach(d=>{
    const l=d.data();
    csv+=`${l.date},${l.type},${l.code},${l.color},${l.warehouse},${l.qty},${l.customer},${l.paid}\n`;
  });
  const blob=new Blob([csv]);
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="logs.csv";
  a.click();
};
