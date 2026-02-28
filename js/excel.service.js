import { db } from "./firebase.js";
import {
collection,
doc,
writeBatch,
getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function importExcel(file){

const inventoryRef=collection(db,"inventory");
const batch=writeBatch(db);
const data=await file.arrayBuffer();
const wb=XLSX.read(data);

const old=await getDocs(inventoryRef);
old.forEach(d=>batch.delete(d.ref));

for(let sheetName of wb.SheetNames){
const sheet=wb.Sheets[sheetName];
const json=XLSX.utils.sheet_to_json(sheet);

for(let row of json){

const code=String(row["编号"]).trim();
if(!code) continue;

const stockValue=Number(row["库存"]||0);
const reservedValue=Number(row["留货(库存已扣)"]||0);
const realStock=stockValue+reservedValue;

batch.set(doc(db,"inventory",`${code}_${sheetName}`),{
code,
spec:row["规格"]||"",
color:row["色号"]||"",
warehouse:sheetName,
stock:realStock,
reserved:reservedValue,
updatedAt:new Date()
});
}
}

await batch.commit();
alert("导入完成");
}