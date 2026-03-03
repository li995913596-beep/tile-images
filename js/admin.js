console.log("admin.js 开始执行");
import { db, auth } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================= 登录 ================= */

btnLogin.onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
    alert("登录成功");
  } catch {
    alert("登录失败");
  }
};

btnLogout.onclick = async () => {
  await signOut(auth);
};

onAuthStateChanged(auth, user => {
  if (user) {
    loginSection.style.display = "none";
    adminSection.style.display = "block";
    initTabs();
  } else {
    loginSection.style.display = "block";
    adminSection.style.display = "none";
  }
});

/* ================= 页面切换 ================= */

window.showTab = (name) => {
  document.querySelectorAll(".tab").forEach(t => t.style.display="none");
  document.getElementById("tab_"+name).style.display="block";
};

/* ================= 初始化 ================= */

function initTabs(){
  buildInPage();
  buildOutPage();
  buildReservePage();
  buildLogPage();
  buildStatsPage();
}

/* ================= 入库 ================= */

function buildInPage(){
  tab_in.innerHTML = `
    <h3>入库</h3>

    <input id="in_search" placeholder="搜索编号">
    <button onclick="searchIn()">搜索</button>
    <div id="in_result"></div>

    <h4 style="margin-top:25px;">新增库存</h4>

    <div>编号</div>
    <input id="new_code">

    <div>规格</div>
    <input id="new_spec">

    <div>色号</div>
    <input id="new_color">

    <div>仓库</div>
    <input id="new_warehouse">

    <div>每箱片数（可空）</div>
    <input id="new_piecesPerBox" type="number">

    <div>数量（箱）</div>
    <input id="new_qty" type="number" step="0.01">

    <br><br>
    <button onclick="addNewStock()">新增</button>
  `;
}

window.searchIn = async ()=>{

  const keyword = in_search.value.trim().toLowerCase();

  if(!keyword){
    alert("请输入编号");
    return;
  }

  // 🔥 读取最多 500 条
  const q = query(
    collection(db,"inventory"),
    limit(500)
  );

  const snap = await getDocs(q);

  in_result.innerHTML="";

  let found = false;

  snap.forEach(d=>{
    const i = d.data();

    const fullId = d.id.toLowerCase();      // NB3610_250920_k38
    const code = (i.code || "").toLowerCase();  // NB3610

    if(
      fullId.includes(keyword) ||
      code.includes(keyword)
    ){
      found = true;

    in_result.innerHTML += `
  <div style="margin-bottom:15px;padding:10px;border:1px solid #ccc;border-radius:6px;">
    <div><b>编号：</b>${i.code}</div>
    <div><b>色号：</b>${i.color}</div>
    <div><b>规格：</b>${i.spec || "-"}</div>
    <div><b>仓库：</b>${i.warehouse}</div>
    <div><b>库存：</b>${i.stock}</div>

    <div style="margin-top:8px;">
      数量：
      <input id="in_qty_${d.id}" type="number" step="0.01" style="width:100px;">
      <button onclick="inStock('${d.id}')">入库</button>
    </div>
  </div>`;
    }
  });

  if(!found){
    in_result.innerHTML = "未找到库存";
  }
};
window.inStock = async (id)=>{
  const ref=doc(db,"inventory",id);
  const snap=await getDoc(ref);
  const data=snap.data();
  const qty=Number(document.getElementById("in_qty_"+id).value);

  if(!qty || qty<=0) return alert("请输入正确数量");

  await updateDoc(ref,{
    stock:Number((data.stock+qty).toFixed(4)),
    lastUpdate: serverTimestamp()
  });

  await log("入库",data,qty);
  alert("完成");
};

window.addNewStock = async ()=>{
  const id=`${new_code.value}_${new_color.value}_${new_warehouse.value}`;

  await setDoc(doc(db,"inventory",id),{
    code:new_code.value,
    spec:new_spec.value,
    color:new_color.value,
    warehouse:new_warehouse.value,
    stock:Number(new_qty.value),
    piecesPerBox: new_piecesPerBox.value ? Number(new_piecesPerBox.value) : null,
    reservedList:[],
    lastUpdate: serverTimestamp()
  });

  alert("新增成功");
};
/* ================= 出库 ================= */

function buildOutPage(){
  tab_out.innerHTML=`
    <h3>出库</h3>
    <input id="out_search" placeholder="搜索编号">
    <button onclick="searchOut()">搜索</button>
    <div id="out_result"></div>
  `;
}

/* 🔥 优化后的低读次数搜索 */

window.searchOut = async ()=>{

  const keyword = out_search.value.trim().toLowerCase();

  if(!keyword){
    alert("请输入编号");
    return;
  }

  const q = query(
    collection(db,"inventory"),
    limit(500)
  );

  const snap = await getDocs(q);

  out_result.innerHTML="";
  let found = false;

  snap.forEach(d=>{
    const i = d.data();

    const fullId = d.id.toLowerCase();
    const code = (i.code || "").toLowerCase();
    const spec = (i.spec || "").toLowerCase();
    const color = (i.color || "").toLowerCase();
    const warehouse = (i.warehouse || "").toLowerCase();

    if(
      fullId.includes(keyword) ||
      code.includes(keyword) ||
      spec.includes(keyword) ||
      color.includes(keyword) ||
      warehouse.includes(keyword)
    ){

      found = true;

      out_result.innerHTML += `
        <div style="margin-bottom:15px;padding:10px;border:1px solid #ccc;border-radius:6px;">
          <div><b>编号：</b>${i.code}</div>
          <div><b>色号：</b>${i.color}</div>
          <div><b>规格：</b>${i.spec || "-"}</div>
          <div><b>仓库：</b>${i.warehouse}</div>
          <div><b>库存：</b>${i.stock}</div>

          <div style="margin-top:8px;">
            客户：
            <input id="out_c_${d.id}" style="width:120px;">

            数量：
            <input id="out_q_${d.id}" type="number" step="0.01" style="width:100px;">

            <select id="out_unit_${d.id}">
              <option value="箱">箱</option>
              <option value="片">片</option>
            </select>

            <button onclick="outStock('${d.id}')">出库</button>
          </div>
        </div>`;
    }
  });

  if(!found){
    out_result.innerHTML = "未找到库存";
  }
};
window.outStock=async(id)=>{
  const ref=doc(db,"inventory",id);
  const snap=await getDoc(ref);
  const data=snap.data();

  const qtyInput=Number(document.getElementById("out_q_"+id).value);
  const unit=document.getElementById("out_unit_"+id).value;

  if(!qtyInput || qtyInput<=0) return alert("请输入正确数量");

  let finalQty=qtyInput;

  if(unit==="片"){
    if(!data.piecesPerBox){
      return alert("未设置每箱片数，无法按片出库");
    }
    finalQty=qtyInput/data.piecesPerBox;
  }

  if(finalQty>data.stock) return alert("库存不足");

  await updateDoc(ref,{
    stock:Number((data.stock-finalQty).toFixed(4)),
    lastUpdate: serverTimestamp()
  });

  await log("出库",data,finalQty,
    document.getElementById("out_c_"+id).value
  );

  alert("完成");
};

/* ================= 留货 ================= */

function buildReservePage(){
  tab_reserve.innerHTML=`
    <h3>留货</h3>
    <input id="re_search" placeholder="搜索编号">
    <button onclick="searchReserve()">搜索</button>
    <div id="re_result"></div>
    <h4>留货清单</h4>
    <div id="reserveList"></div>
  `;
  loadReserve();
}

/* 🔥 优化后的搜索（低读次数） */

window.searchReserve = async ()=>{

  const keyword = re_search.value.trim().toLowerCase();

  if(!keyword){
    alert("请输入编号");
    return;
  }

  const q = query(
    collection(db,"inventory"),
    limit(500)
  );

  const snap = await getDocs(q);

  re_result.innerHTML="";
  let found = false;

  snap.forEach(d=>{
    const i = d.data();

    const fullId = d.id.toLowerCase();
    const code = (i.code || "").toLowerCase();
    const spec = (i.spec || "").toLowerCase();
    const color = (i.color || "").toLowerCase();
    const warehouse = (i.warehouse || "").toLowerCase();

    if(
      fullId.includes(keyword) ||
      code.includes(keyword) ||
      spec.includes(keyword) ||
      color.includes(keyword) ||
      warehouse.includes(keyword)
    ){

      found = true;

      re_result.innerHTML += `
        <div style="margin-bottom:15px;padding:10px;border:1px solid #ccc;border-radius:6px;">
          <div><b>编号：</b>${i.code}</div>
          <div><b>色号：</b>${i.color}</div>
          <div><b>规格：</b>${i.spec || "-"}</div>
          <div><b>仓库：</b>${i.warehouse}</div>
          <div><b>库存：</b>${i.stock}</div>

          <div style="margin-top:8px;">
            客户：
            <input id="re_c_${d.id}" style="width:120px;">
            数量：
            <input id="re_q_${d.id}" type="number" style="width:100px;">
            <button onclick="reserveStock('${d.id}')">留货</button>
          </div>
        </div>`;
    }
  });

  if(!found){
    re_result.innerHTML = "未找到库存";
  }
};
window.reserveStock=async(id)=>{
  const ref=doc(db,"inventory",id);
  const snap=await getDoc(ref);
  const data=snap.data();
  const qty=Number(document.getElementById("re_q_"+id).value);
  const customer=document.getElementById("re_c_"+id).value;

  if(!qty || qty<=0) return alert("请输入正确数量");
  if(qty>data.stock) return alert("库存不足");

  const list=data.reservedList||[];
  list.push({customer,qty});

  await updateDoc(ref,{
    stock:data.stock-qty,
    reservedList:list,
    lastUpdate: serverTimestamp()
  });

  await log("留货",data,qty,customer);

  loadReserve();
};

/* 🔥 优化后的留货清单加载（只加载有留货的） */

async function loadReserve(){

  const q = query(
    collection(db,"inventory"),
    where("reservedList","!=", [])
  );

  const snap = await getDocs(q);

  reserveList.innerHTML="";

  snap.forEach(d=>{
    const i=d.data();

    (i.reservedList||[]).forEach((r,index)=>{
      reserveList.innerHTML+=`
        <div>
          ${i.code}|${r.customer}|${r.qty}
          <button onclick="deleteReserve('${d.id}',${index})">删</button>
        </div>`;
    });
  });
}

window.deleteReserve=async(id,index)=>{
  const ref=doc(db,"inventory",id);
  const snap=await getDoc(ref);
  const data=snap.data();

  const removed=data.reservedList[index];
  data.reservedList.splice(index,1);

  await updateDoc(ref,{
    reservedList:data.reservedList,
    stock:data.stock + removed.qty,
    lastUpdate: serverTimestamp()
  });

  await log("取消留货",data,removed.qty,removed.customer);

  loadReserve();
};
/* ================= 日志 ================= */

function buildLogPage(){
  tab_log.innerHTML=`
    <h3>日志</h3>
    <button onclick="downloadLogs()">下载CSV</button>
    <table border="1" width="100%" style="margin-top:15px;border-collapse:collapse">
      <thead>
        <tr>
          <th>时间</th>
          <th>类型</th>
          <th>编号</th>
          <th>规格</th>
          <th>色号</th>
          <th>数量</th>
          <th>仓库</th>
          <th>客户</th>
        </tr>
      </thead>
      <tbody id="logTable"></tbody>
    </table>
  `;
  loadLogs();
}

async function loadLogs(){

  const q = query(
    collection(db,"logs"),
    orderBy("timestamp","desc"), // 按时间倒序
    limit(100)                   // 只显示100条
  );

  const snap = await getDocs(q);

  logTable.innerHTML="";

  snap.forEach(d=>{
    const l=d.data();
    const time=l.timestamp ? l.timestamp.toDate().toLocaleString() : "";

    logTable.innerHTML+=`
      <tr>
        <td>${time}</td>
        <td>${l.type}</td>
        <td>${l.code}</td>
        <td>${l.spec||""}</td>
        <td>${l.color||""}</td>
        <td>${l.qty}</td>
        <td>${l.warehouse}</td>
        <td>${l.customer||""}</td>
      </tr>`;
  });
}

window.downloadLogs = async () => {

  const q = query(
    collection(db,"logs"),
    orderBy("timestamp","desc") // 按时间排序
  );

  const snap = await getDocs(q);

  let csv="时间,类型,编号,规格,色号,数量,仓库,客户\n";

  snap.forEach(d=>{
    const l=d.data();
    const time=l.timestamp ? l.timestamp.toDate().toLocaleString() : "";
    csv+=`${time},${l.type},${l.code},${l.spec||""},${l.color||""},${l.qty},${l.warehouse},${l.customer||""}\n`;
  });

  const blob=new Blob([csv]);
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="logs.csv";
  a.click();
};

/* ================= 统计 ================= */

function buildStatsPage(){
  tab_stats.innerHTML = `
    <h3>出库统计（按编号 + 日期）</h3>
    <div style="margin-bottom:20px;">
      编号：
      <input id="stats_code" placeholder="输入编号">
      开始日期：
      <input type="date" id="stats_start">
      结束日期：
      <input type="date" id="stats_end">
      <button onclick="runStats()">查询</button>
    </div>
    <div id="statsResult" style="font-size:18px;font-weight:bold;"></div>
  `;
}
console.log("准备注册 handleImport");

/* ================= 出库统计函数 ================= */

window.runStats = async function(){

  const code = document.getElementById("stats_code").value.trim();
  const startValue = document.getElementById("stats_start").value;
  const endValue = document.getElementById("stats_end").value;

  if(!code || !startValue || !endValue){
    alert("请填写完整条件");
    return;
  }

  const startDate = new Date(startValue);
  startDate.setHours(0,0,0,0);

  const endDate = new Date(endValue);
  endDate.setHours(23,59,59,999);

  const q = query(
    collection(db,"logs"),
    where("type","==","出库"),
    where("code","==", code),
    where("timestamp",">=", startDate),
    where("timestamp","<=", endDate),
    orderBy("timestamp","desc")
  );

  const snap = await getDocs(q);

  let total = 0;

  snap.forEach(doc=>{
    total += Number(doc.data().qty || 0);
  });

  document.getElementById("statsResult").innerText =
    `编号 ${code} 在所选时间段内出库总量：${total}`;
};
/* ================= 日志写入 ================= */

async function log(type,data,qty,customer=""){
  await addDoc(collection(db,"logs"),{
    timestamp: serverTimestamp(),
    type,
    code:data.code,
    spec:data.spec||"",
    color:data.color,
    warehouse:data.warehouse,
    qty,
    customer
  });
}
/* ================= Excel 导入（支持多个工作表） ================= */

window.handleImport = async function () {

  const fileInput = document.getElementById("excelFile");
  const file = fileInput.files[0];

  if (!file) {
    alert("请选择文件");
    return;
  }

  alert("开始导入，请稍等...");

  const reader = new FileReader();

  reader.onload = async function (e) {

    try {

      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      let successCount = 0;

      // 🔥 遍历所有工作表
      for (let sheetName of workbook.SheetNames) {

        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);

for (let row of json) {

  const safeWarehouse = (row["所在仓库"] || "")
    .toString()
    .replaceAll("/", "_")
    .replaceAll("\\", "_")
    .replaceAll(" ", "")
    .trim();

  const safeCode = (row["编号"] || "")
    .toString()
    .replaceAll("/", "_")
    .replaceAll("\\", "_")
    .replaceAll(" ", "")
    .trim();

  const safeColor = (row["色号"] || "默认")
    .toString()
    .replaceAll("/", "_")
    .replaceAll("\\", "_")
    .replaceAll(" ", "")
    .trim();

  if (!safeCode || !safeWarehouse) continue;

  const id = `${safeCode}_${safeColor}_${safeWarehouse}`;

  await setDoc(
    doc(db, "inventory", id),
    {
      code: safeCode,
      spec: (row["规格"] || "").toString(),
      color: safeColor,
      warehouse: safeWarehouse,
      stock: Number(row["数量"]) || 0,
      piecesPerBox: row["每箱片数"]
        ? Number(row["每箱片数"])
        : null,
      reservedList: [],
      lastUpdate: serverTimestamp()
    }
  );
}
      }

      alert(`导入完成 ✅ 共导入 ${successCount} 条数据`);

    } catch (error) {

      console.error("导入错误:", error);
      alert("导入失败 ❌ 请打开控制台查看错误");

    }

  };

  reader.readAsArrayBuffer(file);
};
window.exportInventory = async function(){

  const snap = await getDocs(collection(db,"inventory"));

  let warehouseMap = {};

  snap.forEach(doc=>{
    const i = doc.data();

    if(i.hidden) return;

    let reserved = 0;

    // 🔥 兼容数组和对象两种情况
    if(i.reservedList){

      if(Array.isArray(i.reservedList)){
        i.reservedList.forEach(r=>{
          reserved += Number(r.qty || 0);
        });
      } else if(typeof i.reservedList === "object"){
        Object.values(i.reservedList).forEach(r=>{
          reserved += Number(r.qty || 0);
        });
      }

    }

    const row = {
      "编号": i.code || "",
      "规格": i.spec || "",
      "色号": i.color || "",
      "数量": Number(i.stock || 0),
      "所在仓库": i.warehouse || "",
      "留货": reserved,
      "每箱片数": i.piecesPerBox || ""
    };

    const w = i.warehouse || "未分类";

    if(!warehouseMap[w]){
      warehouseMap[w] = [];
    }

    warehouseMap[w].push(row);
  });

  const wb = XLSX.utils.book_new();

  for(const warehouse in warehouseMap){
    const ws = XLSX.utils.json_to_sheet(warehouseMap[warehouse]);
    XLSX.utils.book_append_sheet(wb, ws, warehouse);
  }

  const today = new Date().toISOString().split("T")[0];

  XLSX.writeFile(wb, `当前库存_${today}.xlsx`);
};
