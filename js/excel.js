import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
      const warehouse = String(row["仓库"] || "").trim();
      const qty = Number(row["数量"] || 0);

      if (!code || !spec || !color || !warehouse) continue;

      const docId = `${code}_${color}_${warehouse}`;
      const ref = doc(db, "inventory", docId);
      const snap = await getDoc(ref);

      if (snap.exists()) {

        const old = snap.data();

        await updateDoc(ref, {
          stock: old.stock + qty
        });

      } else {

        await setDoc(ref, {
          code,
          spec,
          color,
          warehouse,
          stock: qty,
          reserved: 0
        });
      }
    }
  }

  alert("库存导入完成");
}
