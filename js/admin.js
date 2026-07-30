console.log("admin.js 开始执行");
import { db, auth } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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

/* ================= 0库存清理（有留货的保留） ================= */

function hasActiveReserve(reservedList){
  if(!reservedList) return false;
  if(Array.isArray(reservedList)){
    return reservedList.some(r => r && Number(r.qty || r.quantity || 0) > 0);
  }
  if(typeof reservedList === "object"){
    return Object.values(reservedList).some(r => r && Number(r.qty || r.quantity || 0) > 0);
  }
  return false;
}

/** 库存<=0 且没有有效留货时删除该文档 */
async function removeIfEmpty(id, stock, reservedList){
  if(Number(stock) > 0) return false;
  if(hasActiveReserve(reservedList)) return false;
  await deleteDoc(doc(db, "inventory", id));
  return true;
}

/** 登录后静默清理历史 0 库存（无留货） */
async function cleanupZeroStock(){
  try {
    const snap = await getDocs(collection(db, "inventory"));
    let removed = 0;
    for (const d of snap.docs) {
      const i = d.data();
      if(Number(i.stock || 0) > 0) continue;
      if(hasActiveReserve(i.reservedList)) continue;
      await deleteDoc(d.ref);
      removed++;
    }
    if(removed > 0){
      console.log("已清理 0 库存记录:", removed, "条");
    }
  } catch (e) {
    console.error("清理 0 库存失败:", e);
  }
}

/* ================= 初始化 ================= */

function initTabs(){
  buildInPage();
  buildOutPage();
  buildReservePage();
  buildLogPage();
  buildStatsPage();
  cleanupZeroStock();
}

/* ================= 搜索结果卡片（样式对齐前台） ================= */

function buildAdminCard(d, i, actionsHtml){
  const w = String(i.warehouse || "").toLowerCase();

  let bgColor = "#f3f4f6";
  let warehouseBg = "#e5e7eb";
  let warehouseColor = "#555";

  if(w === "k38"){
    bgColor = "#e8f1fb";
    warehouseBg = "#dbeafe";
    warehouseColor = "#2563eb";
  } else if(w === "k39"){
    bgColor = "#eaf7f1";
    warehouseBg = "#dcfce7";
    warehouseColor = "#16a34a";
  } else if(w === "1"){
    bgColor = "#f3ecff";
    warehouseBg = "#ffedd5";
    warehouseColor = "#ea580c";
  }

  let stockColor = "#22c55e";
  const stockNum = Number(i.stock || 0);
  if(stockNum === 0) stockColor = "#ef4444";
  else if(stockNum < 10) stockColor = "#f59e0b";

  const reserved = Array.isArray(i.reservedList)
    ? i.reservedList.reduce((s,r)=>s+Number(r.qty||0),0)
    : 0;

  const imageUrl = window.location.origin + "/images/" + (i.code || "") + ".jpg";

  const reserveHtml = reserved > 0
    ? `<span style="font-size:11px;padding:3px 8px;border-radius:999px;background:#ef4444;color:#fff;">留货 ${reserved}</span>`
    : `<span style="font-size:11px;padding:3px 8px;border-radius:999px;background:#e5e7eb;color:#666;">留货 0</span>`;

  return `
    <div style="
      background:${bgColor};
      padding:12px;
      border-radius:14px;
      margin-bottom:12px;
    ">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="${imageUrl}"
          style="width:58px;height:58px;border-radius:8px;object-fit:cover;background:#fff;"
          onerror="this.style.display='none'">

        <div style="flex:1;">
          <div style="font-weight:600;font-size:15px;">${i.code || ""}</div>
          <div style="font-size:13px;color:#555;margin-top:2px;">
            ${i.spec || "-"} | 色号 ${i.color || "-"}
          </div>
          <div style="margin-top:6px;">${reserveHtml}</div>
        </div>

        <div style="text-align:right;">
          <div style="
            display:inline-block;
            font-size:11px;
            padding:4px 10px;
            border-radius:999px;
            background:${warehouseBg};
            color:${warehouseColor};
            font-weight:500;
            margin-bottom:6px;
          ">${i.warehouse || "-"}</div>
          <div style="
            font-size:16px;
            font-weight:700;
            padding:6px 12px;
            border-radius:10px;
            background:${stockColor};
            color:#fff;
          ">${i.stock}</div>
        </div>
      </div>

      <div style="
        margin-top:10px;
        padding-top:10px;
        border-top:1px solid rgba(0,0,0,0.06);
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        align-items:center;
      ">
        ${actionsHtml}
      </div>
    </div>`;
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

  const q = query(
    collection(db,"inventory"),
    limit(5000)
  );

  const snap = await getDocs(q);

  in_result.innerHTML="";

  let found = false;

  snap.forEach(d=>{
    const i = d.data();

    const fullId = d.id.toLowerCase();
    const code = (i.code || "").toLowerCase();

    if(
      fullId.includes(keyword) ||
      code.includes(keyword)
    ){
      found = true;

      const actions = `
        数量：
        <input id="in_qty_${d.id}" type="number" step="0.01" style="width:100px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;">
        <button onclick="inStock('${d.id}')" style="padding:6px 14px;border:none;border-radius:8px;background:#3498db;color:#fff;cursor:pointer;">入库</button>
      `;

      in_result.innerHTML += buildAdminCard(d, i, actions);
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

window.searchOut = async ()=>{

  const keyword = out_search.value.trim().toLowerCase();

  if(!keyword){
    alert("请输入编号");
    return;
  }

  const q = query(
    collection(db,"inventory"),
    limit(5000)
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

      const actions = `
        客户：
        <input id="out_c_${d.id}" style="width:100px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;">
        数量：
        <input id="out_q_${d.id}" type="number" step="0.01" style="width:80px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;">
        <select id="out_unit_${d.id}" style="padding:6px 8px;border:1px solid #ddd;border-radius:8px;">
          <option value="箱">箱</option>
          <option value="片">片</option>
        </select>
        <button onclick="outStock('${d.id}')" style="padding:6px 14px;border:none;border-radius:8px;background:#e67e22;color:#fff;cursor:pointer;">出库</button>
      `;

      out_result.innerHTML += buildAdminCard(d, i, actions);
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

  const newStock = Number((data.stock-finalQty).toFixed(4));

  if(newStock <= 0 && !hasActiveReserve(data.reservedList)){
    await deleteDoc(ref);
  } else {
    await updateDoc(ref,{
      stock: newStock,
      lastUpdate: serverTimestamp()
    });
  }

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

    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:25px;margin-bottom:12px;flex-wrap:wrap;gap:10px;">
      <h4 style="margin:0;">留货清单</h4>
      <button type="button" onclick="exportReserve()">导出留货信息</button>
    </div>

    <p style="margin:0 0 10px;font-size:13px;color:#666;">
      提示：可直接在清单里对留货「出库」，支持只出一部分，剩余继续留货。
    </p>

    <div style="overflow-x:auto;">
      <table id="reserveTable" width="100%" style="border-collapse:collapse;min-width:560px;">
        <thead>
          <tr style="background:linear-gradient(90deg,#3a8dde,#2f7dd1);color:#fff;">
            <th style="padding:10px 12px;text-align:left;">编号</th>
            <th style="padding:10px 12px;text-align:left;">规格</th>
            <th style="padding:10px 12px;text-align:left;">留货数量</th>
            <th style="padding:10px 12px;text-align:left;">客户名</th>
            <th style="padding:10px 12px;text-align:left;">本次出库</th>
            <th style="padding:10px 12px;text-align:left;">操作</th>
          </tr>
        </thead>
        <tbody id="reserveList"></tbody>
      </table>
    </div>
  `;
  loadReserve();
}

window.searchReserve = async ()=>{

  const keyword = re_search.value.trim().toLowerCase();

  if(!keyword){
    alert("请输入编号");
    return;
  }

  const q = query(
    collection(db,"inventory"),
    limit(5000)
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

      const actions = `
        客户：
        <input id="re_c_${d.id}" style="width:100px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;">
        数量：
        <input id="re_q_${d.id}" type="number" style="width:80px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;">
        <button onclick="reserveStock('${d.id}')" style="padding:6px 14px;border:none;border-radius:8px;background:#9b59b6;color:#fff;cursor:pointer;">留货</button>
      `;

      re_result.innerHTML += buildAdminCard(d, i, actions);
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

async function loadReserve(){

  const q = query(
    collection(db,"inventory"),
    where("reservedList","!=", [])
  );

  const snap = await getDocs(q);

  const tbody = document.getElementById("reserveList");
  if(!tbody) return;

  tbody.innerHTML="";
  let hasRow = false;

  snap.forEach(d=>{
    const i=d.data();

    (i.reservedList||[]).forEach((r,index)=>{
      hasRow = true;
      const inputId = `ship_q_${d.id}_${index}`;
      tbody.innerHTML+=`
        <tr style="border-bottom:1px solid #eef2f6;">
          <td style="padding:10px 12px;">${i.code || ""}</td>
          <td style="padding:10px 12px;">${i.spec || "-"}</td>
          <td style="padding:10px 12px;">${r.qty}</td>
          <td style="padding:10px 12px;">${r.customer || ""}</td>
          <td style="padding:10px 12px;">
            <input id="${inputId}" type="number" step="0.01" value="${r.qty}"
              style="width:80px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;"
              title="默认全部，可改成部分数量">
          </td>
          <td style="padding:10px 12px;white-space:nowrap;">
            <button type="button" onclick="shipReserve('${d.id}',${index})"
              style="padding:6px 12px;background:#e67e22;color:#fff;margin-right:6px;">出库</button>
            <button type="button" onclick="deleteReserve('${d.id}',${index})"
              style="padding:6px 12px;background:#fdecea;color:#e74c3c;box-shadow:none;">取消留货</button>
          </td>
        </tr>`;
    });
  });

  if(!hasRow){
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:16px 12px;color:#888;text-align:center;">暂无留货记录</td>
      </tr>`;
  }
}

/**
 * 从留货直接出库（支持部分出库）
 * - 不把数量加回可售库存（留货时已扣过）
 * - 只减少留货数量；剩多少继续留
 * - 记一条「出库」日志，客户用留货客户名
 */
window.shipReserve = async function(id, index){
  const ref = doc(db, "inventory", id);
  const snap = await getDoc(ref);
  if(!snap.exists()) return alert("记录不存在");

  const data = snap.data();
  const list = Array.isArray(data.reservedList) ? [...data.reservedList] : [];
  const item = list[index];
  if(!item) return alert("留货记录不存在");

  const maxQty = Number(item.qty || 0);
  const inputEl = document.getElementById(`ship_q_${id}_${index}`);
  let shipQty = inputEl ? Number(inputEl.value) : maxQty;

  if(!shipQty || shipQty <= 0) return alert("请输入正确的出库数量");
  if(shipQty > maxQty) return alert(`不能超过留货数量 ${maxQty}`);

  shipQty = Number(shipQty.toFixed(4));
  const remain = Number((maxQty - shipQty).toFixed(4));

  if(remain > 0){
    list[index] = { ...item, qty: remain };
  } else {
    list.splice(index, 1);
  }

  // 库存不变：留货时已经扣过；出库只是把「留货」变成真正发出
  if(Number(data.stock || 0) <= 0 && !hasActiveReserve(list)){
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, {
      reservedList: list,
      lastUpdate: serverTimestamp()
    });
  }

  await log("出库", data, shipQty, item.customer || "");

  alert(remain > 0
    ? `已出库 ${shipQty}，剩余留货 ${remain}`
    : `已全部出库 ${shipQty}`);

  loadReserve();
};

window.deleteReserve=async(id,index)=>{
  const ref=doc(db,"inventory",id);
  const snap=await getDoc(ref);
  const data=snap.data();

  const removed=data.reservedList[index];
  data.reservedList.splice(index,1);

  const newStock = data.stock + removed.qty;

  if(newStock <= 0 && !hasActiveReserve(data.reservedList)){
    await deleteDoc(ref);
  } else {
    await updateDoc(ref,{
      reservedList:data.reservedList,
      stock:newStock,
      lastUpdate: serverTimestamp()
    });
  }

  await log("取消留货",data,removed.qty,removed.customer);

  loadReserve();
};

/* 导出留货信息（与表格列一致） */
window.exportReserve = async function(){
  try {
    const q = query(
      collection(db,"inventory"),
      where("reservedList","!=", [])
    );

    const snap = await getDocs(q);
    const rows = [];

    snap.forEach(d=>{
      const i = d.data();
      (i.reservedList || []).forEach(r=>{
        rows.push({
          "编号": i.code || "",
          "规格": i.spec || "",
          "留货数量": Number(r.qty || 0),
          "客户名": r.customer || ""
        });
      });
    });

    if(rows.length === 0){
      alert("当前没有留货记录");
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["编号", "规格", "留货数量", "客户名"]
    });
    XLSX.utils.book_append_sheet(wb, ws, "留货清单");

    const today = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `留货信息_${today}.xlsx`);
    alert("导出成功！");
  } catch (err) {
    console.error("导出留货失败:", err);
    alert("导出失败：" + (err.message || err));
  }
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
    orderBy("timestamp","desc"),
    limit(100)
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
    orderBy("timestamp","desc")
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
  try {
    alert("正在导出，请稍等…");

    const snap = await getDocs(collection(db,"inventory"));

    let warehouseMap = {};
    let allRows = [];

    snap.forEach(doc=>{
      const i = doc.data();
      if(i.hidden) return;

      let reserved = 0;
      if(i.reservedList){
        if(Array.isArray(i.reservedList)){
          i.reservedList.forEach(r=>{
            if(r) reserved += Number(r.qty || r.quantity || 0);
          });
        } else if(typeof i.reservedList === "object"){
          Object.values(i.reservedList).forEach(r=>{
            if(r) reserved += Number(r.qty || r.quantity || 0);
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

      let w = (i.warehouse || "未分类")
        .toString()
        .replace(/[\\\/\?\*\[\]\:]/g, "_")
        .trim()
        .substring(0, 31) || "未分类";

      if(!warehouseMap[w]) warehouseMap[w] = [];
      warehouseMap[w].push(row);
      allRows.push(row);
    });

    if(Object.keys(warehouseMap).length === 0){
      alert("当前没有可导出的库存数据");
      return;
    }

    const wb = XLSX.utils.book_new();

    for(const warehouse in warehouseMap){
      const ws = XLSX.utils.json_to_sheet(warehouseMap[warehouse]);
      XLSX.utils.book_append_sheet(wb, ws, warehouse);
    }

    allRows.sort((a, b) => {
      const specA = (a["规格"] || "").toString();
      const specB = (b["规格"] || "").toString();
      if (specA !== specB) return specA.localeCompare(specB, "zh-CN");

      const qtyA = Number(a["数量"] || 0);
      const qtyB = Number(b["数量"] || 0);
      if (qtyA !== qtyB) return qtyA - qtyB;

      const codeA = (a["编号"] || "").toString();
      const codeB = (b["编号"] || "").toString();
      return codeA.localeCompare(codeB, "zh-CN");
    });

    const summaryWs = XLSX.utils.json_to_sheet(allRows);
    XLSX.utils.book_append_sheet(wb, summaryWs, "全部排序");

    const today = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `当前库存_${today}.xlsx`);
    alert("导出成功！");
  } catch (err) {
    console.error("导出失败:", err);
    alert("导出失败：" + (err.message || err));
  }
};
