import { db, auth } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit
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
  buildStatsPage();
}

/* ================== 入库 / 出库 / 留货 原逻辑保持不变 ================== */
/* 你原来的代码我不删，只改 log 函数为时间戳版本 */

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

/* ================== 统计页面 ================== */

function buildStatsPage(){
  tab_stats.innerHTML=`
    <h3>数据统计</h3>

    <div style="margin-bottom:20px;font-size:18px">
      今日出库数量：<span id="todayOut">计算中...</span>
    </div>

    <canvas id="trendChart" height="100"></canvas>
    <br>
    <canvas id="monthlyChart" height="100"></canvas>
  `;

  loadStats();
}

async function loadStats(){

  const snap=await getDocs(collection(db,"logs"));

  const today=new Date();
  const todayStr=today.toDateString();

  let todayOut=0;

  const dailyMap={};
  const monthlyMap={};

  snap.forEach(doc=>{
    const l=doc.data();
    if(!l.timestamp) return;

    const date=l.timestamp.toDate();

    if(l.type==="出库" && date.toDateString()===todayStr){
      todayOut+=Number(l.qty||0);
    }

    const dayKey=date.toISOString().slice(0,10);
    if(!dailyMap[dayKey]){
      dailyMap[dayKey]={in:0,out:0};
    }

    if(l.type==="入库"){
      dailyMap[dayKey].in+=Number(l.qty||0);
    }else{
      dailyMap[dayKey].out+=Number(l.qty||0);
    }

    const monthKey=date.getFullYear()+"-"+(date.getMonth()+1);
    if(!monthlyMap[monthKey]){
      monthlyMap[monthKey]=0;
    }

    if(l.type==="入库"){
      monthlyMap[monthKey]+=Number(l.qty||0);
    }else{
      monthlyMap[monthKey]-=Number(l.qty||0);
    }
  });

  document.getElementById("todayOut").innerText=todayOut;

  buildTrendChart(dailyMap);
  buildMonthlyChart(monthlyMap);
}

function buildTrendChart(data){

  const labels=Object.keys(data).sort();
  const inData=labels.map(d=>data[d].in);
  const outData=labels.map(d=>data[d].out);

  new Chart(document.getElementById("trendChart"),{
    type:"line",
    data:{
      labels,
      datasets:[
        {
          label:"入库",
          data:inData,
          borderColor:"#2ecc71",
          fill:false
        },
        {
          label:"出库",
          data:outData,
          borderColor:"#e74c3c",
          fill:false
        }
      ]
    }
  });
}

function buildMonthlyChart(data){

  const labels=Object.keys(data).sort();
  const values=labels.map(m=>data[m]);

  new Chart(document.getElementById("monthlyChart"),{
    type:"bar",
    data:{
      labels,
      datasets:[
        {
          label:"月度库存净变化",
          data:values,
          backgroundColor:"#3498db"
        }
      ]
    }
  });
}
