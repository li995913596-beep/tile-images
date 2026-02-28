import { db, auth } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================= 登录 ================= */

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

/* ================= 页面切换 ================= */

window.showTab = (name) => {
  document.querySelectorAll(".tab").forEach(t => t.style.display="none");
  document.getElementById("tab_"+name).style.display="block";
};

/* ================= 初始化 ================= */

function initTabs(){
  buildInPage();
  buildOutPage();
  buildReservePage();
  buildLogPage();
  buildStatsPage();
}

/* ================= 入库 ================= */

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

  if(!qty || qty<=0) return alert("请输入正确数量");

  await updateDoc(ref,{
    stock:data.stock+qty,
    lastUpdate: serverTimestamp()
  });

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
    reservedList:[],
    lastUpdate: serverTimestamp()
  });

  alert("新增成功");
};

/* ================= 出库 ================= */

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

  if(!qty || qty<=0) return alert("请输入正确数量");
  if(qty>data.stock) return alert("库存不足");

  await updateDoc(ref,{
    stock:data.stock-qty,
    lastUpdate: serverTimestamp()
  });

  await log("出库",data,qty,
    document.getElementById("out_c_"+id).value,
    document.getElementById("out_p_"+id).value
  );

  alert("完成");
};

/* ================= 留货 ================= */

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
  const customer=document.getElementById("re_c_"+id).value;

  if(qty>data.stock) return alert("库存不足");

  const list=data.reservedList||[];
  list.push({customer,qty});

  await updateDoc(ref,{
    stock:data.stock-qty,
    reservedList:list,
    lastUpdate: serverTimestamp()
  });

  await log("留货",data,qty,customer,"");
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

  const removed=data.reservedList[index];
  data.reservedList.splice(index,1);

  await updateDoc(ref,{
    reservedList:data.reservedList,
    lastUpdate: serverTimestamp()
  });

  if(removed){
    await log("取消留货",data,removed.qty,removed.customer,"");
  }

  loadReserve();
};

/* ================= 日志 ================= */

function buildLogPage(){
  tab_log.innerHTML=`
    <h3>日志</h3>
    <div id="logList"></div>
  `;
  loadLogs();
}

async function loadLogs(){
  const snap=await getDocs(collection(db,"logs"));
  logList.innerHTML="";
  snap.forEach(d=>{
    const l=d.data();
    const time=l.timestamp ? l.timestamp.toDate().toLocaleString() : "";
    logList.innerHTML+=`
      <div style="padding:8px 0;border-bottom:1px solid #eee">
        ${time} | ${l.type} | ${l.code} | ${l.qty}
      </div>`;
  });
}

/* ================= 统计 ================= */

function buildStatsPage(){
  tab_stats.innerHTML=`
    <h3>数据统计</h3>
    <div>今日出库数量：<span id="todayOut">计算中...</span></div>
  `;
  loadStats();
}

async function loadStats(){
  const snap=await getDocs(collection(db,"logs"));
  const today=new Date().toDateString();
  let todayOut=0;

  snap.forEach(doc=>{
    const l=doc.data();
    if(!l.timestamp) return;
    const date=l.timestamp.toDate();
    if(l.type==="出库" && date.toDateString()===today){
      todayOut+=Number(l.qty||0);
    }
  });

  document.getElementById("todayOut").innerText=todayOut;
}

/* ================= 日志写入 ================= */

async function log(type,data,qty,customer="",paid=""){
  await addDoc(collection(db,"logs"),{
    timestamp: serverTimestamp(),
    type,
    code:data.code,
    color:data.color,
    warehouse:data.warehouse,
    qty,
    customer,
    paid
  });
}
