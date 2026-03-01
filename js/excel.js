import { db } from "./firebase.js";
import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function safe(text) {
  return String(text || "").replace(/[\/\s#]/g, "_");
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
      const color = row["色号"]?.toString().trim() || "";   // ✅ 允许为空
      const qty = Number(row["数量"] || 0);                 // 箱数
      const warehouse = row["所在仓库"]?.toString().trim();
      const reserved = Number(row["留货(库存已扣)"] || 0);
      const piecesPerBox = Number(row["每箱片数"] || 1);   // ✅ 新增字段

      // 只要求 编号 + 仓库
      if (!code || !warehouse) continue;

      // 色号为空用 NO_COLOR 防止冲突
      const safeColor = color || "NO_COLOR";

      const id = `${safe(code)}_${safe(safeColor)}_${safe(warehouse)}`;

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
        stock: Number(qty),                 // 箱数（支持小数）
        piecesPerBox: Number(piecesPerBox), // ✅ 新字段
        reservedList,
        lastUpdate: new Date()
      });
    }
  }

  alert("库存导入完成");
}
