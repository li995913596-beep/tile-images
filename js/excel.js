import { db } from "./firebase.js";
import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function safe(text) {
  return String(text || "")
    .replace(/[\/\s#]/g, "_")
    .trim();
}

export async function importExcel(file) {

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);

  for (let sheetName of workbook.SheetNames) {

    const ws = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws);

    for (let row of json) {

      const code = row["编号"]?.toString().trim();
      const spec = row["规格"]?.toString().trim() || "";
      const color = row["色号"]?.toString().trim() || "";
      const qty = Number(row["数量"] || 0);
      const warehouse = row["所在仓库"]?.toString().trim();
      const reserved = Number(row["留货(库存已扣)"] || 0);
      const piecesPerBox = Number(row["每箱片数"] || 1);

      // 只要求 编号 + 仓库
      if (!code || !warehouse) continue;

      const safeCode = safe(code);
      const safeSpec = safe(spec);              // ✅ 新增
      const safeColor = safe(color || "NO_COLOR");
      const safeWarehouse = safe(warehouse);

      // ✅ 关键修复：加入规格防止覆盖
      const id = `${safeCode}_${safeSpec}_${safeColor}_${safeWarehouse}`;

      const reservedList = reserved > 0 ? [
        {
          id: "imported",
          customer: "历史留货",
          qty: reserved,
          date: new Date()
        }
      ] : [];

      await setDoc(doc(db, "inventory", id), {
        code,
        spec,
        color,
        warehouse,
        stock: Number(qty),
        piecesPerBox: Number(piecesPerBox),
        reservedList,
        lastUpdate: new Date()
      });

    }
  }

  alert("库存导入完成");
}
