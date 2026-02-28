import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function safeId(text) {
  return String(text)
    .replace(/\//g, "_")
    .replace(/\s+/g, "")
    .replace(/#/g, "");
}

export async function importExcel(file) {

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);

  for (let sheetName of workbook.SheetNames) {

    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet);

    for (let row of json) {

      const code = String(row["编号"] || "").trim();
      const spec = String(row["规格"] || "").trim();
      const color = String(row["色号"] || "").trim();
      const qty = Number(row["数量"] || 0);
      const warehouse = String(row["所在仓库"] || "").trim();
      const reserved = Number(row["留货(库存已扣)"] || 0);

      if (!code || !spec || !color || !warehouse) continue;

      const safeCode = safeId(code);
      const safeColor = safeId(color);
      const safeWarehouse = safeId(warehouse);

      const docId = `${safeCode}_${safeColor}_${safeWarehouse}`;

      const ref = doc(db, "inventory", docId);
      const snap = await getDoc(ref);

      if (snap.exists()) {

        await updateDoc(ref, {
          stock: qty,
          reserved: reserved
        });

      } else {

        await setDoc(ref, {
          code,
          spec,
          color,
          warehouse,
          stock: qty,
          reserved: reserved
        });
      }
    }
  }

  alert("库存导入完成");
}
