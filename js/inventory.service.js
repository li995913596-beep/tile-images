import { db } from "./firebase.js";
import {
doc,
runTransaction,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function updateStock(type,data){

const docId = `${data.code}_${data.warehouse}`;
const ref = doc(db,"inventory",docId);

await runTransaction(db,async(transaction)=>{
const snap = await transaction.get(ref);

if(!snap.exists()){
if(type==="in"){
transaction.set(ref,{
code:data.code,
spec:data.spec,
color:data.color,
warehouse:data.warehouse,
stock:data.qty,
reserved:0,
updatedAt:serverTimestamp()
});
return;
}else{
throw "库存不存在";
}
}

const current = snap.data();
const remaining = current.stock-current.reserved;

if(type==="out" && data.qty>remaining)
throw "库存不足";

if(type==="reserve" && data.qty>remaining)
throw "库存不足";

let newStock=current.stock;
let newReserved=current.reserved;

if(type==="in") newStock+=data.qty;
if(type==="out") newStock-=data.qty;
if(type==="reserve") newReserved+=data.qty;
if(type==="cancelReserve") newReserved-=data.qty;

transaction.update(ref,{
stock:newStock,
reserved:newReserved,
updatedAt:serverTimestamp()
});
});
}