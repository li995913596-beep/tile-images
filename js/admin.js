import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   登录控制
========================= */

const loginSection = document.getElementById("loginSection");
const adminSection = document.getElementById("adminSection");

document.getElementById("btnLogin").onclick = () => {
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;

  if (user === "kyson" && pass === "123456") {
    loginSection.style.display = "none";
    adminSection.style.display = "block";
  } else {
    alert("账号错误");
  }
};

document.getElementById("btnLogout").onclick = () => {
  location.reload();
};

/* =========================
   Excel 覆盖导入
========================= */

document.getElementById("excelFile").addEventListener("change", async (e) => {

  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = async (evt) => {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    const batch = writeBatch(db);
    const old = await getDocs(collection(db, "inventory"));
    old.forEach(d => batch.delete(d.ref));
    await batch.commit();

    for (const sheetName of workbook.SheetNames) {

      const sheet = XLSX.utils.sheet_to_json(
        workbook.Sheets[sheetName]
      );

      for (const row of sheet) {

        const id = `${row.编号}_${row.色号}_${row.所在仓库}`;

        await setDoc(doc(db, "inventory", id), {
          code: row.编号,
          spec: row.规格,
          color: row.色号,
          stock: Number(row.数量 || 0),
          warehouse: row.所在仓库,
          reservedList: []
        });
      }
    }

    alert("导入完成");
  };

  reader.readAsArrayBuffer(file);
});

/* =========================
   搜索库存
========================= */

const resultDiv = document.getElementById("searchResult");

document.getElementById("btnSearch").onclick = async () => {

  const keyword = document.getElementById("searchCode").value.trim();
  resultDiv.innerHTML = "";

  const snap = await getDocs(collection(db, "inventory"));

  snap.forEach(d => {
    const item = d.data();

    if (
      item.code.includes(keyword) ||
      item.color.includes(keyword)
    ) {

      const reservedTotal = (item.reservedList || [])
        .reduce((s, r) => s + Number(r.qty), 0);

      resultDiv.innerHTML += `
        <div style="background:#fff;padding:10px;margin:10px;">
          ${item.code} | ${item.color} | ${item.warehouse}
          <br>
          库存:${item.stock}
          <br>
          留货:${reservedTotal}
        </div>
      `;
    }
  });
};

/* =========================
   入库
========================= */

document.getElementById("btnIn").onclick = async () => {

  const code = document.getElementById("operateCode").value;
  const color = document.getElementById("operateColor").value;
  const warehouse = document.getElementById("operateWarehouse").value;
  const qty = Number(document.getElementById("operateQty").value);

  const id = `${code}_${color}_${warehouse}`;
  const ref = doc(db, "inventory", id);
  const snap = await getDoc(ref);

  if (snap.exists()) {

    const data = snap.data();
    await updateDoc(ref, {
      stock: data.stock + qty
    });

  } else {

    await setDoc(ref, {
      code,
      color,
      spec: "",
      warehouse,
      stock: qty,
      reservedList: []
    });
  }

  await logAction("入库", code, color, qty, warehouse);
  alert("入库完成");
};

/* =========================
   出库
========================= */

document.getElementById("btnOut").onclick = async () => {

  const code = document.getElementById("operateCode").value;
  const color = document.getElementById("operateColor").value;
  const warehouse = document.getElementById("operateWarehouse").value;
  const qty = Number(document.getElementById("operateQty").value);
  const customer = document.getElementById("customer").value;
  const paid = document.getElementById("paidStatus").value;

  const id = `${code}_${color}_${warehouse}`;
  const ref = doc(db, "inventory", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) return alert("库存不存在");

  const data = snap.data();
  if (qty > data.stock) return alert("库存不足");

  await updateDoc(ref, {
    stock: data.stock - qty
  });

  await logAction("出库", code, color, qty, warehouse, customer, paid);
  alert("出库完成");
};

/* =========================
   留货
========================= */

document.getElementById("btnReserve").onclick = async () => {

  const code = document.getElementById("operateCode").value;
  const color = document.getElementById("operateColor").value;
  const warehouse = document.getElementById("operateWarehouse").value;
  const qty = Number(document.getElementById("reserveQty").value);
  const customer = document.getElementById("reserveCustomer").value;

  const id = `${code}_${color}_${warehouse}`;
  const ref = doc(db, "inventory", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) return alert("库存不存在");

  const data = snap.data();
  if (qty > data.stock) return alert("库存不足");

  const list = data.reservedList || [];

  list.push({
    customer,
    qty,
    time: new Date().toLocaleString()
  });

  await updateDoc(ref, {
    stock: data.stock - qty,
    reservedList: list
  });

  alert("留货成功");
  loadReserveList();
};

/* =========================
   全局留货清单
========================= */

async function loadReserveList() {

  const div = document.getElementById("reserveList");
  div.innerHTML = "";

  const snap = await getDocs(collection(db, "inventory"));

  snap.forEach(d => {

    const item = d.data();

    (item.reservedList || []).forEach((r, index) => {

      div.innerHTML += `
        <div>
          ${item.code}|${item.color}|${r.customer}|${r.qty}
          <button onclick="deleteReserve('${d.id}',${index})">
            删除
          </button>
        </div>
      `;
    });
  });
}

window.deleteReserve = async (id, index) => {

  const ref = doc(db, "inventory", id);
  const snap = await getDoc(ref);
  const data = snap.data();

  data.reservedList.splice(index, 1);

  await updateDoc(ref, {
    reservedList: data.reservedList
  });

  loadReserveList();
};

/* =========================
   日志系统
========================= */

async function logAction(
  type,
  code,
  color,
  qty,
  warehouse,
  customer = "",
  paid = ""
) {

  await addDoc(collection(db, "logs"), {
    date: new Date().toLocaleString(),
    type,
    code,
    color,
    qty,
    warehouse,
    customer,
    paid
  });
}

/* =========================
   CSV 下载
========================= */

document.getElementById("btnDownloadLog").onclick = async () => {

  const snap = await getDocs(collection(db, "logs"));

  let csv = "日期,类型,编号,色号,数量,仓库,客户,付款\n";

  snap.forEach(d => {
    const l = d.data();
    csv += `${l.date},${l.type},${l.code},${l.color},${l.qty},${l.warehouse},${l.customer},${l.paid}\n`;
  });

  const blob = new Blob([csv]);
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "logs.csv";
  a.click();
};

loadReserveList();
