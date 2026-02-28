import { auth } from "./firebase.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { updateStock } from "./inventory.service.js";
import { importExcel } from "./excel.service.js";

btnLogin.onclick=()=>signInWithEmailAndPassword(auth,email.value,password.value);
btnLogout.onclick=()=>signOut(auth);

onAuthStateChanged(auth,user=>{
adminSection.style.display=user?"block":"none";
});

btnIn.onclick=()=>updateStock("in",{
code:inCode.value,
spec:inSpec.value,
color:inColor.value,
warehouse:inWarehouse.value,
qty:Number(inQty.value)
});

btnOut.onclick=()=>updateStock("out",{
code:outCode.value,
warehouse:outWarehouse.value,
qty:Number(outQty.value)
});

btnReserve.onclick=()=>updateStock("reserve",{
code:resCode.value,
warehouse:resWarehouse.value,
qty:Number(resQty.value)
});

excelFile.addEventListener("change",e=>{
importExcel(e.target.files[0]);
});