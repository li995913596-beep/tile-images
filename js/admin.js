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

let selectedItem = null;

/* 登录 */
btnLogin.onclick = () => {
  signInWithEmailAndPassword(
    auth,
    document.getElementById("email").value,
    document.getElementById("password").value
  ).then(() => alert("登录成功"))
   .catch(e => alert(e.message));
};

btnLogout.onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  if (user) {
    loginSection.style.display = "none";
    adminSection.style.display = "block";
  } else {
    loginSection.style.display = "block";
    adminSection.style.display = "none";
  }
});

/* 🔍 搜索 */
btnSearch.onclick = async () => {

  const keyword = searchCode.value.trim().toLowerCase();
  if (!keyword) return;

  const snap = await getDocs(collection(db, "inventory"));

  const list = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(i =>
      i.code.toLowerCase().includes(keyword) ||
      i.color.toLowerCase().includes(keyword)
    );

  if (list.length === 0) {
    alert("未找到库存");
    searchResult.innerHTML = "";
    return;
  }

  searchResult.innerHTML = "";

  list.forEach(item => {

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

  window.selectItem = (id) => {
    selectedItem = list.find(i => i.id === id);
    selectedInfo.innerHTML =
      `已选择：${selectedItem.code} - ${selectedItem.color} (${selectedItem.warehouse})`;
  };
};

/* ➕ 新增库存（自动累加） */
btnCreate.onclick = async () => {

  const code = new_code.value.trim();
  const spec = new_spec.value.trim();
  const color = new_color.value.trim();
  const warehouse = new_warehouse.value.trim();
  const qty = Number(new_qty.value);

  if (!code || !spec || !color || !warehouse || !qty) {
    alert("填写完整信息");
    return;
  }

  const docId = `${code}_${color}_${warehouse}`;
  const ref = doc(db, "inventory", docId);
  const snap = await getDoc(ref);

  if (snap.exists()) {

    const data = snap.data();

    await updateDoc(ref, {
      stock: data.stock + qty
    });

    alert("库存已存在，已自动累加");

  } else {

    await setDoc(ref, {
      code,
      spec,
      color,
      warehouse,
      stock: qty,
      reserved: 0
    });

    alert("新增成功");
  }
};

/* ➕ 入库 */
btnIn.onclick = async () => {

  if (!selectedItem) {
    alert("请先选择库存");
    return;
  }

  const qty = Number(operateQty.value);
  if (!qty) return;

  const ref = doc(db, "inventory", selectedItem.id);
  const snap = await getDoc(ref);
  const latest = snap.data();

  await updateDoc(ref, {
    stock: latest.stock + qty
  });

  alert("入库成功");
};

/* ➖ 出库 */
btnOut.onclick = async () => {

  if (!selectedItem) {
    alert("请先选择库存");
    return;
  }

  const qty = Number(operateQty.value);
  const customer = operateCustomer.value.trim();
  const paid = operatePaid.value;

  if (!qty || !customer || !paid) {
    alert("填写完整信息");
    return;
  }

  const ref = doc(db, "inventory", selectedItem.id);
  const snap = await getDoc(ref);
  const latest = snap.data();

  const available = latest.stock - latest.reserved;

  if (qty > available) {
    alert("库存不足，可用：" + available);
    return;
  }

  await updateDoc(ref, {
    stock: latest.stock - qty
  });

  alert("出库成功");
};
