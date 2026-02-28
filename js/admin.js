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
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { importExcel } from "./excel.js";

/* ===== DOM ===== */
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const email = document.getElementById("email");
const password = document.getElementById("password");

const loginSection = document.getElementById("loginSection");
const adminSection = document.getElementById("adminSection");

const excelFile = document.getElementById("excelFile");

/* 入库 */
const in_code = document.getElementById("in_code");
const in_warehouse = document.getElementById("in_warehouse");
const in_qty = document.getElementById("in_qty");
const in_spec = document.getElementById("in_spec");
const in_color = document.getElementById("in_color");
const btnIn = document.getElementById("btnIn");

/* 出库 */
const out_code = document.getElementById("out_code");
const out_warehouse = document.getElementById("out_warehouse");
const out_qty = document.getElementById("out_qty");
const out_customer = document.getElementById("out_customer");
const out_paid = document.getElementById("out_paid");
const btnOut = document.getElementById("btnOut");

/* 日志区 */
const logList = document.getElementById("logList");

/* ===== 登录 ===== */
btnLogin.onclick = () => {
  signInWithEmailAndPassword(auth, email.value, password.value)
    .then(() => alert("登录成功"))
    .catch(err => alert("登录失败: " + err.message));
};

btnLogout.onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  if (user) {
    loginSection.style.display = "none";
    adminSection.style.display = "block";
    loadLogs();
  } else {
    loginSection.style.display = "block";
    adminSection.style.display = "none";
  }
});

/* ===== Excel ===== */
excelFile.addEventListener("change", async (e) => {
  if (!confirm("确定覆盖库存？")) return;
  await importExcel(e.target.files[0]);
  alert("导入成功");
});

/* ===== 入库（严格规则） ===== */
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

    if (data.warehouse === warehouse) {
      await updateDoc(ref, {
        stock: data.stock + qty
      });
    }

  } else {

    const spec = in_spec.value.trim();
    const color = in_color.value.trim();

    if (!spec || !color) {
      alert("新入库必须填写规格和色号");
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
  loadLogs();
};

/* ===== 出库 ===== */
btnOut.onclick = async () => {

  const code = out_code.value.trim();
  const warehouse = out_warehouse.value.trim();
  const qty = Number(out_qty.value);
  const customer = out_customer.value.trim();
  const paid = out_paid.checked;

  if (!code || !warehouse || !qty || !customer) {
    alert("请填写完整信息");
    return;
  }

  const safeCode = code.replaceAll("/", "-");
  const docId = `${safeCode}_${warehouse}`;
  const ref = doc(db, "inventory", docId);

  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("库存不存在");
    return;
  }

  const data = snap.data();
  const available = data.stock - data.reserved;

  if (qty > available) {
    alert("库存不足，可用库存：" + available);
    return;
  }

  await updateDoc(ref, {
    stock: data.stock - qty
  });

  await addDoc(collection(db, "logs"), {
    type: "out",
    code,
    warehouse,
    qty,
    customer,
    paid,
    date: new Date(),
    reverted: false
  });

  alert("出库成功");
  loadLogs();
};

/* ===== 加载日志 ===== */
async function loadLogs() {

  const snap = await getDocs(collection(db, "logs"));
  logList.innerHTML = "";

  snap.docs.forEach(docItem => {

    const data = docItem.data();
    const id = docItem.id;

    logList.innerHTML += `
      <div>
        ${data.type} | ${data.code} | ${data.qty}
        ${data.reverted ? "(已撤销)" : ""}
        ${!data.reverted ? `<button onclick="revertLog('${id}')">撤销</button>` : ""}
      </div>
    `;
  });
}

/* ===== 撤销 ===== */
window.revertLog = async function(id) {

  const logRef = doc(db, "logs", id);
  const snap = await getDoc(logRef);
  const log = snap.data();

  if (log.reverted) return;

  const safeCode = log.code.replaceAll("/", "-");
  const invRef = doc(db, "inventory", `${safeCode}_${log.warehouse}`);
  const invSnap = await getDoc(invRef);
  const inv = invSnap.data();

  if (log.type === "in") {
    await updateDoc(invRef, {
      stock: inv.stock - log.qty
    });
  }

  if (log.type === "out") {
    await updateDoc(invRef, {
      stock: inv.stock + log.qty
    });
  }

  await updateDoc(logRef, { reverted: true });

  alert("已撤销");
  loadLogs();
};
