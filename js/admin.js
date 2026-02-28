import { auth } from "./firebase.js";
import { signInWithEmailAndPassword, signOut } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { importExcel } from "./excel.js";

btnLogin.onclick=()=>{
  signInWithEmailAndPassword(auth,email.value,password.value)
  .then(()=>alert("登录成功"))
  .catch(e=>alert("登录失败"));
};

btnLogout.onclick=()=>signOut(auth);

excelFile.addEventListener("change", async(e)=>{
  if(!confirm("确定覆盖库存？")) return;
  try{
    await importExcel(e.target.files[0]);
    alert("导入成功");
  }catch(err){
    alert("导入失败:"+err);
  }
});
