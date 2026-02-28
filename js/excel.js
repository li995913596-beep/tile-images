import { db } from "./firebase.js";
import {
  doc,
  setDoc
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

      const docId = `${safeId(code)}_${safeId(color)}_${safeId(warehouse)}`;

      const reservedList = reserved > 0 ? [
        {
          id: "imported",
          customer: "历史留货",
          qty: reserved,
          date: new Date()
        }
      ] : [];

      await setDoc(doc(db,"inventory",docId),{
        code,
        spec,
        color,
        warehouse,
        stock: qty,
        reservedList
      });
    }
  }

  alert("库存导入完成");
}
