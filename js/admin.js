import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { importExcel } from "./excel.js";

/* ===== 获取 DOM ===== */
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const email = document.getElementById("email");
const password = document.getElementById("password");

const loginSection = document.getElementById("loginSection");
const adminSection = document.getElementById("adminSection");

const excelFile = document.getElementById("excelFile");

const in_code = document.getElementById("in_code");
const in_warehouse = document.getElementById("in_warehouse");
const in_qty = document.getElementById("in_qty");
const in_spec = document.getElementById("in_spec");
const in_color = document.getElementById("in_color");
const btnIn = document.getElementById("btnIn");

/* ===== 登录 ===== */
btnLogin.onclick = () => {
  signInWithEmailAndPassword(auth, email.value, password.value)
    .then(() => {
      alert("登录成功");
    })
    .catch(err => {
      alert("登录失败: " + err.message);
    });
};

/* ===== 退出 ===== */
btnLogout.onclick = () => {
  signOut(auth);
};

/* ===== 监听登录状态 ===== */
onAuthStateChanged(auth, user => {
  if (user) {
    loginSection.style.display = "none";
    adminSection.style.display = "block";
  } else {
    loginSection.style.display = "block";
    adminSection.style.display = "none";
  }
});

/* ===== Excel 导入 ===== */
excelFile.addEventListener("change", async (e) => {
  if (!confirm("确定覆盖库存？")) return;

  try {
    await importExcel(e.target.files[0]);
    alert("导入成功");
  } catch (err) {
    alert("导入失败: " + err);
  }
});

/* ===== 入库功能 ===== */
btnIn.onclick = async () => {

  const code = in_code.value.trim();
  const warehouse = in_warehouse.value.trim();
  const qty = Number(in_qty.value);

  if (!code || !warehouse || !qty) {
    alert("请填写完整信息");
    return;
  }

  const safeCode = code.replaceAll("/", "-");
  const docId = `${safeCode}_${warehouse}`;
  const ref = doc(db, "inventory", docId);

  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    await updateDoc(ref, {
      stock: data.stock + qty
    });
  } else {

    const spec = in_spec.value.trim();
    const color = in_color.value.trim();

    if (!spec || !color) {
      alert("新建库存必须填写规格和色号");
      return;
    }

    await setDoc(ref, {
      code,
      spec,
      color,
      warehouse,
      stock: qty,
      reserved: 0
    });
  }

  await addDoc(collection(db, "logs"), {
    type: "in",
    code,
    warehouse,
    qty,
    date: new Date(),
    reverted: false
  });

  alert("入库成功");

  in_code.value = "";
  in_qty.value = "";
};
