import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { importExcel } from "./excel.js";

/* 登录 */
btnLogin.onclick = () => {
  signInWithEmailAndPassword(auth, email.value, password.value)
    .then(() => {
      alert("登录成功");
    })
    .catch(err => {
      alert("登录失败: " + err.message);
    });
};

/* 退出 */
btnLogout.onclick = () => {
  signOut(auth);
};

/* 监听登录状态 */
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("adminSection").style.display = "block";
  } else {
    document.getElementById("loginSection").style.display = "block";
    document.getElementById("adminSection").style.display = "none";
  }
});

/* Excel 导入 */
excelFile.addEventListener("change", async (e) => {
  if (!confirm("确定覆盖库存？")) return;

  try {
    await importExcel(e.target.files[0]);
    alert("导入成功");
  } catch (err) {
    alert("导入失败: " + err);
  }
});
