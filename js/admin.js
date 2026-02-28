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
  setDoc,
  updateDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { importExcel } from "./excel.js";

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

const new_code = document.getElementById("new_code");
const new_spec = document.getElementById("new_spec");
const new_color = document.getElementById("new_color");
const new_warehouse = document.getElementById("new_warehouse");
const new_qty = document.getElementById("new_qty");
const btnCreate = document.getElementById("btnCreate");

const reserveCustomer = document.getElementById("reserveCustomer");
const reserveQty = document.getElementById("reserveQty");
const btnReserve = document.getElementById("btnReserve");
const reserveListDiv = document.getElementById("reserveList");

const excelFile = document.getElementById("excelFile");

let selectedItem = null;

/* 登录 */
btnLogin.onclick = () => {
  signInWithEmailAndPassword(
    auth,
    document.getElementById("email").value,
    document.getElementById("password").value
  )
    .then(() => alert("登录成功"))
    .catch(e => alert(e.message));
};

btnLogout.onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  if (user) {
    loginSection.style.display = "none";
    adminSection.style.display = "block";
    loadReserveList();
  } else {
    loginSection.style.display = "block";
    adminSection.style.display = "none";
  }
});

/* Excel 导入 */
excelFile.addEventListener("change", async (e) => {
  if (!confirm("确定导入库存？")) return;
  await importExcel(e.target.files[0]);
});

/* 搜索 */
btnSearch.onclick = async () => {

  const keyword = searchCode.value.trim().toLowerCase();
  const snap = await getDocs(collection(db, "inventory"));

  const list = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(i =>
      i.code.toLowerCase().includes(keyword) ||
      i.color.toLowerCase().includes(keyword)
    );

  searchResult.innerHTML = "";

  list.forEach(item => {

    const reservedTotal = item.reservedList
      ? item.reservedList.reduce((s,r)=>s+r.qty,0)
      : 0;

    searchResult.innerHTML += `
      <div style="border:1px solid #ccc;margin:5px;padding:8px;">
        编号:${item.code} |
        色号:${item.color} |
        仓库:${item.warehouse} |
        库存:${item.stock} |
        留货:${reservedTotal}
        <button onclick="selectItem('${item.id}')">选择</button>
      </div>
    `;
  });

  window.selectItem = (id) => {
    selectedItem = list.find(i => i.id === id);
    selectedInfo.innerHTML =
      `已选择：${selectedItem.code} - ${selectedItem.color} (${selectedItem.warehouse})`;
  };
};

/* 入库 */
btnIn.onclick = async () => {
  if (!selectedItem) return alert("请选择库存");
  const qty = Number(operateQty.value);
  if (!qty) return;

  const ref = doc(db, "inventory", selectedItem.id);
  const snap = await getDoc(ref);
  const data = snap.data();

  await updateDoc(ref, { stock: data.stock + qty });
  alert("入库成功");
};

/* 出库 */
btnOut.onclick = async () => {
  if (!selectedItem) return alert("请选择库存");
  const qty = Number(operateQty.value);
  const customer = operateCustomer.value.trim();
  const paid = operatePaid.value;

  if (!qty || !customer || !paid) return alert("填写完整信息");

  const ref = doc(db, "inventory", selectedItem.id);
  const snap = await getDoc(ref);
  const data = snap.data();

  if (qty > data.stock) return alert("库存不足");

  await updateDoc(ref, { stock: data.stock - qty });

  await addDoc(collection(db, "logs"), {
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

/* 新增库存 */
btnCreate.onclick = async () => {

  const code = new_code.value.trim();
  const spec = new_spec.value.trim();
  const color = new_color.value.trim();
  const warehouse = new_warehouse.value.trim();
  const qty = Number(new_qty.value);

  if (!code || !spec || !color || !warehouse || !qty)
    return alert("填写完整信息");

  const docId = `${code.replace(/\//g,"_")}_${color}_${warehouse}`;
  const ref = doc(db,"inventory",docId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    await updateDoc(ref,{ stock:data.stock + qty });
  } else {
    await setDoc(ref,{
      code,
      spec,
      color,
      warehouse,
      stock:qty,
      reservedList:[]
    });
  }

  alert("新增成功");
};

/* 留货 */
btnReserve.onclick = async () => {

  if (!selectedItem) return alert("请选择库存");

  const qty = Number(reserveQty.value);
  const customer = reserveCustomer.value.trim();

  if (!qty || !customer) return alert("填写完整信息");

  const ref = doc(db,"inventory",selectedItem.id);
  const snap = await getDoc(ref);
  const data = snap.data();

  if (qty > data.stock) return alert("库存不足");

  const newReserve = {
    id:Date.now().toString(),
    customer,
    qty,
    date:new Date()
  };

  const list = data.reservedList || [];

  await updateDoc(ref,{
    stock:data.stock - qty,
    reservedList:[...list,newReserve]
  });

  alert("留货成功");
  loadReserveList();
};

/* 全局留货清单 */
async function loadReserveList(){

  const snap = await getDocs(collection(db,"inventory"));
  let html = "";

  snap.docs.forEach(d=>{

    const item = d.data();

    if(item.reservedList && item.reservedList.length>0){

      item.reservedList.forEach(r=>{

        html += `
          <div style="border:1px solid #ccc;margin:5px;padding:6px;">
            ${item.code} | ${item.color} | ${item.warehouse}
            | 客户:${r.customer}
            | 数量:${r.qty}
          </div>
        `;
      });
    }
  });

  reserveListDiv.innerHTML = html;
}
