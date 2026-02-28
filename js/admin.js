import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 登录 */

document.getElementById("btnLogin").onclick = () => {
  const u = username.value;
  const p = password.value;
  if (u === "kyson" && p === "123456") {
    loginSection.style.display = "none";
    adminSection.style.display = "block";
  } else {
    alert("错误");
  }
};

/* 切换 */

window.showTab = (name) => {
  document.querySelectorAll(".tab").forEach(t => t.style.display="none");
  document.getElementById("tab_"+name).style.display="block";
};

/* 搜索 */

window.searchInventory = async (mode) => {

  const keyword =
    document.getElementById(mode+"_search").value;

  const div =
    document.getElementById(mode+"_result");

  div.innerHTML = "";

  const snap = await getDocs(collection(db,"inventory"));

  snap.forEach(d=>{
    const item = d.data();
    if(
      item.code.includes(keyword) ||
      item.color.includes(keyword)
    ){

      if(mode==="in"){
        div.innerHTML+=`
        <div>
          ${item.code}|${item.color}|库存:${item.stock}
          数量<input id="in_qty_${d.id}">
          <button onclick="inStock('${d.id}')">入库</button>
        </div>`;
      }

      if(mode==="out"){
        div.innerHTML+=`
        <div>
          ${item.code}|${item.color}|库存:${item.stock}
          客户<input id="out_c_${d.id}">
          数量<input id="out_q_${d.id}">
          <select id="out_p_${d.id}">
            <option>已付款</option>
            <option>未付款</option>
          </select>
          <button onclick="outStock('${d.id}')">出库</button>
        </div>`;
      }

      if(mode==="reserve"){
        div.innerHTML+=`
        <div>
          ${item.code}|${item.color}|库存:${item.stock}
          客户<input id="re_c_${d.id}">
          数量<input id="re_q_${d.id}">
          <button onclick="reserveStock('${d.id}')">留货</button>
        </div>`;
      }

    }
  });
};

/* 入库 */

window.inStock = async (id)=>{
  const qty = Number(document.getElementById("in_qty_"+id).value);
  const ref = doc(db,"inventory",id);
  const snap = await getDoc(ref);
  const data = snap.data();
  await updateDoc(ref,{
    stock:data.stock+qty
  });
  await log("入库",data,qty);
  alert("完成");
};

/* 新增 */

window.addNewStock = async ()=>{
  const id = `${new_code.value}_${new_color.value}_${new_warehouse.value}`;
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

window.outStock = async (id)=>{
  const ref = doc(db,"inventory",id);
  const snap = await getDoc(ref);
  const data = snap.data();

  const qty = Number(document.getElementById("out_q_"+id).value);
  if(qty>data.stock) return alert("库存不足");

  await updateDoc(ref,{
    stock:data.stock-qty
  });

  await log("出库",data,qty,
    document.getElementById("out_c_"+id).value,
    document.getElementById("out_p_"+id).value
  );

  alert("完成");
};

/* 留货 */

window.reserveStock = async (id)=>{
  const ref = doc(db,"inventory",id);
  const snap = await getDoc(ref);
  const data = snap.data();

  const qty = Number(document.getElementById("re_q_"+id).value);
  if(qty>data.stock) return alert("库存不足");

  const list = data.reservedList||[];
  list.push({
    customer:document.getElementById("re_c_"+id).value,
    qty
  });

  await updateDoc(ref,{
    stock:data.stock-qty,
    reservedList:list
  });

  loadReserve();
};

/* 留货清单 */

async function loadReserve(){
  reserveList.innerHTML="";
  const snap = await getDocs(collection(db,"inventory"));
  snap.forEach(d=>{
    const item = d.data();
    (item.reservedList||[]).forEach((r,i)=>{
      reserveList.innerHTML+=`
        <div>
          ${item.code}|${r.customer}|${r.qty}
          <button onclick="deleteReserve('${d.id}',${i})">删</button>
        </div>
      `;
    });
  });
}

window.deleteReserve = async(id,index)=>{
  const ref = doc(db,"inventory",id);
  const snap = await getDoc(ref);
  const data = snap.data();
  data.reservedList.splice(index,1);
  await updateDoc(ref,{reservedList:data.reservedList});
  loadReserve();
};

/* 日志 */

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

window.downloadLogs = async ()=>{
  const snap = await getDocs(collection(db,"logs"));
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

loadReserve();
