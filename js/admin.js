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

/* ===== DOM ===== */

const loginSection = document.getElementById("loginSection");
const adminSection = document.getElementById("adminSection");

const email = document.getElementById("email");
const password = document.getElementById("password");
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

let selectedItemId = null;

/* ===== 登录 ===== */

btnLogin.onclick = () => {
  signInWithEmailAndPassword(auth, email.value, password.value)
    .then(() => alert("登录成功"))
    .catch(e => alert(e.message));
};

onAuthStateChanged(auth, user => {
  if (user) {
    loginSection.style.display = "none";
    adminSection.style.display = "block";
    loadReserveList();
  }
});

/* ===== Excel 导入 ===== */

excelFile.onchange = async e => {
  await importExcel(e.target.files[0]);
  alert("库存导入完成");
};

/* ===== 搜索库存 ===== */

btnSearch.onclick = async () => {

  const key = searchCode.value.trim().toLowerCase();
  const snap = await getDocs(collection(db, "inventory"));

  searchResult.innerHTML = "";
  selectedItemId = null;
  selectedInfo.innerText = "";

  snap.docs.forEach(d => {

    const item = d.data();

    if (
      item.code?.toLowerCase().includes(key) ||
      item.color?.toLowerCase().includes(key)
    ) {

      const stock = Number(item.stock || 0);

      const reservedList = Array.isArray(item.reservedList)
        ? item.reservedList
        : [];

      const reservedTotal = reservedList.reduce(
        (sum, r) => sum + Number(r.qty || 0),
        0
      );

      searchResult.innerHTML += `
        <div style="border:1px solid #ccc;margin:8px;padding:10px;border-radius:6px;">
          <b>${item.code} (${item.warehouse})</b><br>
          规格: ${item.spec} | 色号: ${item.color}<br>
          剩余库存: ${stock}<br>
          留货: ${reservedTotal}<br>
          <button onclick="window.selectItem('${d.id}')">选择</button>
        </div>
      `;
    }
  });

  window.selectItem = id => {
    selectedItemId = id;
    selectedInfo.innerText = "已选择: " + id;
  };
};

/* ===== 入库 ===== */

btnIn.onclick = async () => {
  if (!selectedItemId) return alert("请选择库存");

  const qty = Number(operateQty.value);
  if (!qty) return alert("请输入数量");

  const ref = doc(db, "inventory", selectedItemId);
  const snap = await getDoc(ref);
  const data = snap.data();

  await updateDoc(ref, {
    stock: Number(data.stock || 0) + qty
  });

  alert("入库成功");
};

/* ===== 出库 ===== */

btnOut.onclick = async () => {
  if (!selectedItemId) return alert("请选择库存");

  const qty = Number(operateQty.value);
  if (!qty) return alert("请输入数量");

  const ref = doc(db, "inventory", selectedItemId);
  const snap = await getDoc(ref);
  const data = snap.data();

  if (qty > Number(data.stock || 0)) {
    return alert("库存不足");
  }

  await updateDoc(ref, {
    stock: Number(data.stock || 0) - qty
  });

  alert("出库成功");
};

/* ===== 留货 ===== */

btnReserve.onclick = async () => {

  if (!selectedItemId) return alert("请选择库存");

  const qty = Number(reserveQty.value);
  const customer = reserveCustomer.value.trim();

  if (!qty || !customer) return alert("填写完整信息");

  const ref = doc(db, "inventory", selectedItemId);
  const snap = await getDoc(ref);
  const data = snap.data();

  if (qty > Number(data.stock || 0)) {
    return alert("库存不足");
  }

  const list = Array.isArray(data.reservedList)
    ? data.reservedList
    : [];

  list.push({
    id: Date.now().toString(),
    customer,
    qty,
    date: new Date()
  });

  await updateDoc(ref, {
    stock: Number(data.stock || 0) - qty,
    reservedList: list
  });

  reserveQty.value = "";
  reserveCustomer.value = "";

  loadReserveList();
};

/* ===== 全局留货清单 ===== */

async function loadReserveList() {

  const snap = await getDocs(collection(db, "inventory"));
  reserveListDiv.innerHTML = "";

  snap.docs.forEach(d => {

    const item = d.data();
    const list = Array.isArray(item.reservedList)
      ? item.reservedList
      : [];

    list.forEach(r => {

      reserveListDiv.innerHTML += `
        <div style="border:1px solid #ccc;margin:5px;padding:8px;">
          ${item.code} | ${item.color} | ${item.warehouse}<br>
          客户: ${r.customer}<br>
          数量: ${r.qty}
        </div>
      `;
    });
  });
}
