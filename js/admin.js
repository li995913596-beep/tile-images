console.log("admin.js 开始执行");
import { db, auth } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, query, orderBy, where, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

function $(id){ return document.getElementById(id); }

function bindLogin(){
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");
  const emailEl = $("email");
  const passwordEl = $("password");
  const loginSection = $("loginSection");
  const adminSection = $("adminSection");

  if(btnLogin){
    btnLogin.onclick = async () => {
      try {
        await signInWithEmailAndPassword(auth, emailEl.value, passwordEl.value);
        alert("登录成功");
      } catch (e) {
        console.error(e);
        alert("登录失败");
      }
    };
  }

  if(btnLogout){
    btnLogout.onclick = async () => {
      await signOut(auth);
    };
  }

  onAuthStateChanged(auth, user => {
    if (user) {
      if(loginSection) loginSection.style.display = "none";
      if(adminSection) adminSection.style.display = "block";
      try { initTabs(); } catch(e){ console.error("initTabs 失败:", e); }
    } else {
      if(loginSection) loginSection.style.display = "block";
      if(adminSection) adminSection.style.display = "none";
    }
  });
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", bindLogin);
} else {
  bindLogin();
}

window.showTab = (name) => {
  document.querySelectorAll(".tab").forEach(t => t.style.display="none");
  const el = $("tab_"+name);
  if(el) el.style.display="block";
  if(name==="stats") setTimeout(()=>{ if(typeof runSalesStats==="function") runSalesStats("month"); }, 50);
};

function hasActiveReserve(reservedList){
  if(!reservedList) return false;
  if(Array.isArray(reservedList)) return reservedList.some(r => r && Number(r.qty || r.quantity || 0) > 0);
  if(typeof reservedList === "object") return Object.values(reservedList).some(r => r && Number(r.qty || r.quantity || 0) > 0);
  return false;
}

async function cleanupZeroStock(){
  try {
    const snap = await getDocs(collection(db, "inventory"));
    for (const d of snap.docs) {
      const i = d.data();
      if(Number(i.stock || 0) > 0) continue;
      if(hasActiveReserve(i.reservedList)) continue;
      await deleteDoc(d.ref);
    }
  } catch (e) { console.error(e); }
}

async function findInventoryDocs(rawKeyword, fuzzyFields = ["code"]){
  const raw = (rawKeyword || "").trim();
  if(!raw) return [];
  const keyword = raw.toLowerCase();
  const seen = new Set(); const results = [];
  function addSnap(snap){ snap.forEach(d => { if(seen.has(d.id)) return; seen.add(d.id); results.push(d); }); }
  try {
    for(const v of [...new Set([raw, keyword, raw.toUpperCase()])]){
      addSnap(await getDocs(query(collection(db, "inventory"), where("code", "==", v))));
    }
  } catch(e){ console.error(e); }
  if(results.length > 0) return results;
  const snap = await getDocs(query(collection(db, "inventory"), limit(5000)));
  snap.forEach(d => {
    const i = d.data();
    const fullId = d.id.toLowerCase();
    const code = String(i.code || "").toLowerCase();
    const spec = String(i.spec || "").toLowerCase();
    const color = String(i.color || "").toLowerCase();
    const warehouse = String(i.warehouse || "").toLowerCase();
    let ok = fullId.includes(keyword) || code.includes(keyword);
    if(fuzzyFields.includes("spec") && spec.includes(keyword)) ok = true;
    if(fuzzyFields.includes("color") && color.includes(keyword)) ok = true;
    if(fuzzyFields.includes("warehouse") && warehouse.includes(keyword)) ok = true;
    if(ok && !seen.has(d.id)){ seen.add(d.id); results.push(d); }
  });
  return results;
}

function initTabs(){
  buildInPage();
  buildOutPage();
  buildReservePage();
  buildLogPage();
  buildStatsPage();
  cleanupZeroStock();
}

function buildAdminCard(d, i, actionsHtml){
  const w = String(i.warehouse || "").toLowerCase();
  let bgColor = "#f3f4f6", warehouseBg = "#e5e7eb", warehouseColor = "#555";
  if(w === "k38"){ bgColor = "#e8f1fb"; warehouseBg = "#dbeafe"; warehouseColor = "#2563eb"; }
  else if(w === "k39"){ bgColor = "#eaf7f1"; warehouseBg = "#dcfce7"; warehouseColor = "#16a34a"; }
  else if(w === "1"){ bgColor = "#f3ecff"; warehouseBg = "#ffedd5"; warehouseColor = "#ea580c"; }
  let stockColor = "#22c55e"; const stockNum = Number(i.stock || 0);
  if(stockNum === 0) stockColor = "#ef4444"; else if(stockNum < 10) stockColor = "#f59e0b";
  const reserved = Array.isArray(i.reservedList) ? i.reservedList.reduce((s,r)=>s+Number(r.qty||0),0) : 0;
  const imageUrl = window.location.origin + "/images/" + (i.code || "") + ".jpg";
  const reserveHtml = reserved > 0
    ? `<span style="font-size:11px;padding:3px 8px;border-radius:999px;background:#ef4444;color:#fff;">留货 ${reserved}</span>`
    : `<span style="font-size:11px;padding:3px 8px;border-radius:999px;background:#e5e7eb;color:#666;">留货 0</span>`;
  return `<div style="background:${bgColor};padding:12px;border-radius:14px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="${imageUrl}" style="width:58px;height:58px;border-radius:8px;object-fit:cover;background:#fff;" onerror="this.style.display='none'">
      <div style="flex:1;"><div style="font-weight:600;font-size:15px;">${i.code || ""}</div>
      <div style="font-size:13px;color:#555;margin-top:2px;">${i.spec || "-"} | 色号 ${i.color || "-"}</div>
      <div style="margin-top:6px;">${reserveHtml}</div></div>
      <div style="text-align:right;"><div style="display:inline-block;font-size:11px;padding:4px 10px;border-radius:999px;background:${warehouseBg};color:${warehouseColor};font-weight:500;margin-bottom:6px;">${i.warehouse || "-"}</div>
      <div style="font-size:16px;font-weight:700;padding:6px 12px;border-radius:10px;background:${stockColor};color:#fff;">${i.stock}</div></div></div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.06);">${actionsHtml}</div></div>`;
}

function buildInPage(){
  const tab_in = $("tab_in");
  if(!tab_in) return;
  tab_in.innerHTML = `<h3>入库</h3><input id="in_search" placeholder="搜索编号"><button onclick="searchIn()">搜索</button><div id="in_result"></div>
  <h4 style="margin-top:25px;">新增库存</h4>
  <div>编号</div><input id="new_code"><div>规格</div><input id="new_spec"><div>色号</div><input id="new_color">
  <div>仓库</div><input id="new_warehouse" placeholder="自动转小写"><div>每箱片数（可空）</div><input id="new_piecesPerBox" type="number">
  <div>数量（箱）</div><input id="new_qty" type="number" step="0.01"><br><br><button onclick="addNewStock()">新增</button>`;
}

window.searchIn = async ()=>{
  const raw = $("in_search").value.trim(); if(!raw) return alert("请输入编号");
  const docs = await findInventoryDocs(raw, ["code"]);
  const in_result = $("in_result"); in_result.innerHTML = "";
  if(!docs.length){ in_result.innerHTML = "未找到库存"; return; }
  docs.forEach(d=>{ const i=d.data();
    in_result.innerHTML += buildAdminCard(d,i,`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">数量：<input id="in_qty_${d.id}" type="number" step="0.01" style="width:100px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;"><button onclick="inStock('${d.id}')" style="padding:6px 14px;border:none;border-radius:8px;background:#3498db;color:#fff;cursor:pointer;">入库</button></div>`);
  });
};

window.inStock = async (id)=>{
  const ref=doc(db,"inventory",id); const data=(await getDoc(ref)).data();
  const qty=Number($("in_qty_"+id).value);
  if(!qty||qty<=0) return alert("请输入正确数量");
  await updateDoc(ref,{stock:Number((data.stock+qty).toFixed(4)),lastUpdate:serverTimestamp()});
  await log("入库",data,qty); alert("完成");
};

window.addNewStock = async ()=>{
  const code=($("new_code").value||"").trim(); const color=($("new_color").value||"").trim();
  const warehouse=($("new_warehouse").value||"").toString().trim().toLowerCase();
  if(!code||!warehouse) return alert("请填写编号和仓库");
  const id=`${code}_${color}_${warehouse}`;
  await setDoc(doc(db,"inventory",id),{code,spec:$("new_spec").value,color,warehouse,stock:Number($("new_qty").value),
    piecesPerBox:$("new_piecesPerBox").value?Number($("new_piecesPerBox").value):null,reservedList:[],lastUpdate:serverTimestamp()});
  alert("新增成功");
};

function buildOutPage(){
  const tab_out = $("tab_out");
  if(!tab_out) return;
  tab_out.innerHTML=`<h3>出库</h3><input id="out_search" placeholder="搜索编号"><button onclick="searchOut()">搜索</button><div id="out_result"></div>`;
}

window.searchOut = async ()=>{
  const raw=$("out_search").value.trim(); if(!raw) return alert("请输入编号");
  const docs=await findInventoryDocs(raw,["code","spec","color","warehouse"]);
  const out_result=$("out_result"); out_result.innerHTML="";
  if(!docs.length){ out_result.innerHTML="未找到库存"; return; }
  docs.forEach(d=>{ const i=d.data();
    let actions=`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;"><span style="font-size:13px;color:#666;width:100%;">可售库存出库：</span>客户：<input id="out_c_${d.id}" style="width:100px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;">数量：<input id="out_q_${d.id}" type="number" step="0.01" style="width:80px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;"><select id="out_unit_${d.id}" style="padding:6px 8px;border:1px solid #ddd;border-radius:8px;"><option value="箱">箱</option><option value="片">片</option></select><button onclick="outStock('${d.id}')" style="padding:6px 14px;border:none;border-radius:8px;background:#e67e22;color:#fff;cursor:pointer;">出库</button></div>`;
    const list=Array.isArray(i.reservedList)?i.reservedList:[];
    if(list.length){ actions+=`<div style="margin-top:4px;padding:10px;background:rgba(231,76,60,0.06);border-radius:10px;border:1px solid rgba(231,76,60,0.15);"><div style="font-size:13px;font-weight:600;color:#c0392b;margin-bottom:8px;">从留货出库（可改数量）：</div>`;
      list.forEach((r,index)=>{ actions+=`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;"><span style="font-size:13px;min-width:120px;">客户：${r.customer||"未填"}（留 ${r.qty}）</span>本次：<input id="ship_q_${d.id}_${index}" type="number" step="0.01" value="${r.qty}" style="width:80px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;"><button type="button" onclick="shipReserve('${d.id}',${index})" style="padding:6px 14px;border:none;border-radius:8px;background:#c0392b;color:#fff;cursor:pointer;">从留货出库</button></div>`; });
      actions+=`</div>`; }
    out_result.innerHTML+=buildAdminCard(d,i,actions);
  });
};

window.outStock=async(id)=>{
  const ref=doc(db,"inventory",id); const data=(await getDoc(ref)).data();
  const qtyInput=Number($("out_q_"+id).value); const unit=$("out_unit_"+id).value;
  if(!qtyInput||qtyInput<=0) return alert("请输入正确数量");
  let finalQty=qtyInput; if(unit==="片"){ if(!data.piecesPerBox) return alert("未设置每箱片数"); finalQty=qtyInput/data.piecesPerBox; }
  if(finalQty>data.stock) return alert("库存不足");
  const newStock=Number((data.stock-finalQty).toFixed(4));
  if(newStock<=0&&!hasActiveReserve(data.reservedList)) await deleteDoc(ref);
  else await updateDoc(ref,{stock:newStock,lastUpdate:serverTimestamp()});
  await log("出库",data,finalQty,$("out_c_"+id).value); alert("完成");
  if($("out_search").value.trim()) searchOut();
};

function buildReservePage(){
  const tab_reserve = $("tab_reserve");
  if(!tab_reserve) return;
  tab_reserve.innerHTML=`<h3>留货</h3><input id="re_search" placeholder="搜索编号"><button onclick="searchReserve()">搜索</button><div id="re_result"></div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-top:25px;margin-bottom:12px;flex-wrap:wrap;gap:10px;"><h4 style="margin:0;">留货清单</h4><button type="button" onclick="exportReserve()">导出留货信息</button></div>
  <div style="overflow-x:auto;"><table width="100%" style="border-collapse:collapse;min-width:480px;"><thead><tr style="background:linear-gradient(90deg,#3a8dde,#2f7dd1);color:#fff;"><th style="padding:10px 12px;text-align:left;">编号</th><th style="padding:10px 12px;text-align:left;">规格</th><th style="padding:10px 12px;text-align:left;">留货数量</th><th style="padding:10px 12px;text-align:left;">客户名</th><th style="padding:10px 12px;text-align:left;">操作</th></tr></thead><tbody id="reserveList"></tbody></table></div>`;
  loadReserve();
}

window.searchReserve=async()=>{ const raw=$("re_search").value.trim(); if(!raw) return alert("请输入编号");
  const docs=await findInventoryDocs(raw,["code","spec","color","warehouse"]);
  const re_result=$("re_result"); re_result.innerHTML="";
  if(!docs.length){ re_result.innerHTML="未找到库存"; return; }
  docs.forEach(d=>{ const i=d.data(); re_result.innerHTML+=buildAdminCard(d,i,`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">客户：<input id="re_c_${d.id}" style="width:100px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;">数量：<input id="re_q_${d.id}" type="number" style="width:80px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;"><button onclick="reserveStock('${d.id}')" style="padding:6px 14px;border:none;border-radius:8px;background:#9b59b6;color:#fff;cursor:pointer;">留货</button></div>`); });
};

window.reserveStock=async(id)=>{ const ref=doc(db,"inventory",id); const data=(await getDoc(ref)).data();
  const qty=Number($("re_q_"+id).value); const customer=$("re_c_"+id).value;
  if(!qty||qty<=0) return alert("请输入正确数量"); if(qty>data.stock) return alert("库存不足");
  const list=data.reservedList||[]; list.push({customer,qty});
  await updateDoc(ref,{stock:data.stock-qty,reservedList:list,lastUpdate:serverTimestamp()}); await log("留货",data,qty,customer); loadReserve();
};

async function loadReserve(){
  const snap=await getDocs(query(collection(db,"inventory"),where("reservedList","!=",[])));
  const tbody=$("reserveList"); if(!tbody) return; tbody.innerHTML=""; let has=false;
  snap.forEach(d=>{ const i=d.data(); (i.reservedList||[]).forEach((r,index)=>{ has=true;
    tbody.innerHTML+=`<tr style="border-bottom:1px solid #eef2f6;"><td style="padding:10px 12px;">${i.code||""}</td><td style="padding:10px 12px;">${i.spec||"-"}</td><td style="padding:10px 12px;">${r.qty}</td><td style="padding:10px 12px;">${r.customer||""}</td><td style="padding:10px 12px;"><button type="button" onclick="deleteReserve('${d.id}',${index})" style="padding:6px 12px;background:#fdecea;color:#e74c3c;box-shadow:none;">取消留货</button></td></tr>`; }); });
  if(!has) tbody.innerHTML=`<tr><td colspan="5" style="padding:16px;text-align:center;color:#888;">暂无留货记录</td></tr>`;
}

window.shipReserve=async function(id,index){
  const ref=doc(db,"inventory",id); const snap=await getDoc(ref); if(!snap.exists()) return alert("记录不存在");
  const data=snap.data(); const list=Array.isArray(data.reservedList)?[...data.reservedList]:[]; const item=list[index]; if(!item) return alert("留货记录不存在");
  const maxQty=Number(item.qty||0); const inputEl=$("ship_q_"+id+"_"+index); let shipQty=inputEl?Number(inputEl.value):maxQty;
  if(!shipQty||shipQty<=0) return alert("请输入正确的出库数量"); if(shipQty>maxQty) return alert(`不能超过留货数量 ${maxQty}`);
  shipQty=Number(shipQty.toFixed(4)); const remain=Number((maxQty-shipQty).toFixed(4));
  if(remain>0) list[index]={...item,qty:remain}; else list.splice(index,1);
  if(Number(data.stock||0)<=0&&!hasActiveReserve(list)) await deleteDoc(ref);
  else await updateDoc(ref,{reservedList:list,lastUpdate:serverTimestamp()});
  await log("出库",data,shipQty,item.customer||"");
  alert(remain>0?`已出库 ${shipQty}，剩余留货 ${remain}`:`已全部出库 ${shipQty}`);
  if($("out_search")&&$("out_search").value.trim()) searchOut();
  if($("reserveList")) loadReserve();
};

window.deleteReserve=async(id,index)=>{
  const ref=doc(db,"inventory",id); const data=(await getDoc(ref)).data();
  const removed=data.reservedList[index]; data.reservedList.splice(index,1); const newStock=data.stock+removed.qty;
  if(newStock<=0&&!hasActiveReserve(data.reservedList)) await deleteDoc(ref);
  else await updateDoc(ref,{reservedList:data.reservedList,stock:newStock,lastUpdate:serverTimestamp()});
  await log("取消留货",data,removed.qty,removed.customer); loadReserve();
};

window.exportReserve=async function(){
  try{
    const snap=await getDocs(query(collection(db,"inventory"),where("reservedList","!=",[]))); const rows=[];
    snap.forEach(d=>{ const i=d.data(); (i.reservedList||[]).forEach(r=>rows.push({"编号":i.code||"","规格":i.spec||"","留货数量":Number(r.qty||0),"客户名":r.customer||""})); });
    if(!rows.length) return alert("当前没有留货记录");
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows,{header:["编号","规格","留货数量","客户名"]}),"留货清单");
    XLSX.writeFile(wb,`留货信息_${new Date().toISOString().split("T")[0]}.xlsx`); alert("导出成功！");
  }catch(err){ alert("导出失败："+(err.message||err)); }
};

function buildLogPage(){
  const tab_log = $("tab_log");
  if(!tab_log) return;
  tab_log.innerHTML=`<h3>日志</h3><button onclick="downloadLogs()">下载CSV</button><table border="1" width="100%" style="margin-top:15px;border-collapse:collapse"><thead><tr><th>时间</th><th>类型</th><th>编号</th><th>规格</th><th>色号</th><th>数量</th><th>仓库</th><th>客户</th></tr></thead><tbody id="logTable"></tbody></table>`;
  loadLogs();
}

async function loadLogs(){
  const snap=await getDocs(query(collection(db,"logs"),orderBy("timestamp","desc"),limit(100)));
  const logTable=$("logTable"); if(!logTable) return; logTable.innerHTML="";
  snap.forEach(d=>{ const l=d.data(); const time=l.timestamp?l.timestamp.toDate().toLocaleString():"";
    logTable.innerHTML+=`<tr><td>${time}</td><td>${l.type}</td><td>${l.code}</td><td>${l.spec||""}</td><td>${l.color||""}</td><td>${l.qty}</td><td>${l.warehouse}</td><td>${l.customer||""}</td></tr>`; });
}

window.downloadLogs=async()=>{
  const snap=await getDocs(query(collection(db,"logs"),orderBy("timestamp","desc")));
  let csv="时间,类型,编号,规格,色号,数量,仓库,客户\n";
  snap.forEach(d=>{ const l=d.data(); const time=l.timestamp?l.timestamp.toDate().toLocaleString():""; csv+=`${time},${l.type},${l.code},${l.spec||""},${l.color||""},${l.qty},${l.warehouse},${l.customer||""}\n`; });
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv])); a.download="logs.csv"; a.click();
};

let salesBarChart=null, salesPieChart=null;
let adminRankedCache=[];
let adminSortBy="qty";

function getRange(preset){
  const end=new Date(); end.setHours(23,59,59,999); const start=new Date(); start.setHours(0,0,0,0);
  if(preset==="week"){ const day=start.getDay()||7; start.setDate(start.getDate()-(day-1)); }
  else if(preset==="month") start.setDate(1);
  else if(preset==="year") start.setMonth(0,1);
  return {start,end};
}

function renderAdminStatsTable(){
  const list=[...adminRankedCache];
  if(adminSortBy==="count") list.sort((a,b)=>b.count-a.count||b.qty-a.qty);
  else list.sort((a,b)=>b.qty-a.qty||b.count-a.count);
  const tbody=$("statsTableBody");
  if(!tbody) return;
  if(!list.length){
    tbody.innerHTML=`<tr><td colspan="4" style="padding:16px;text-align:center;color:#888;">暂无数据</td></tr>`;
    return;
  }
  tbody.innerHTML=list.map((r,i)=>`<tr style="border-bottom:1px solid #eef2f6;"><td style="padding:10px 12px;">${i+1}</td><td style="padding:10px 12px;">${r.code}</td><td style="padding:10px 12px;">${r.qty}</td><td style="padding:10px 12px;">${r.count}</td></tr>`).join("");
}

window.setAdminSort=function(mode){
  adminSortBy=mode==="count"?"count":"qty";
  const q=$("admin_sort_qty"), c=$("admin_sort_count");
  if(q) q.style.background=adminSortBy==="qty"?"#2f7dd1":"";
  if(q) q.style.color=adminSortBy==="qty"?"#fff":"";
  if(c) c.style.background=adminSortBy==="count"?"#2f7dd1":"";
  if(c) c.style.color=adminSortBy==="count"?"#fff":"";
  renderAdminStatsTable();
};

function buildStatsPage(){
  const tab_stats = $("tab_stats");
  if(!tab_stats) return;
  tab_stats.innerHTML=`<h3>卖货分析（出库排行）</h3>
  <p style="font-size:13px;color:#666;margin-top:0;">不用搜编号。老板不登录也可看：打开 <a href="report.html" target="_blank">report.html</a></p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center;">
  <button type="button" onclick="runSalesStats('today')">今天</button><button type="button" onclick="runSalesStats('week')">本周</button>
  <button type="button" onclick="runSalesStats('month')">本月</button><button type="button" onclick="runSalesStats('year')">本年</button>
  <span style="margin-left:8px;color:#888;">或</span><input type="date" id="stats_start"><span>~</span><input type="date" id="stats_end">
  <button type="button" onclick="runSalesStats('custom')">查询</button></div>
  <div id="statsSummary" style="font-size:15px;font-weight:600;margin-bottom:16px;"></div>
  <div style="background:#fafbfd;border-radius:12px;padding:12px;margin-bottom:16px;"><div style="font-weight:600;margin-bottom:8px;">出库 Top 15</div><canvas id="salesBarChart" height="120"></canvas></div>
  <div style="background:#fafbfd;border-radius:12px;padding:12px;max-width:480px;margin-bottom:16px;"><div style="font-weight:600;margin-bottom:8px;">Top 10 占比</div><canvas id="salesPieChart" height="200"></canvas></div>
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
    <span style="font-size:13px;color:#555;">排名排序：</span>
    <button type="button" id="admin_sort_qty" onclick="setAdminSort('qty')" style="background:#2f7dd1;color:#fff;">按出库数量</button>
    <button type="button" id="admin_sort_count" onclick="setAdminSort('count')">按出库次数</button>
  </div>
  <div style="overflow-x:auto;"><table width="100%" style="border-collapse:collapse;min-width:400px;"><thead><tr style="background:linear-gradient(90deg,#3a8dde,#2f7dd1);color:#fff;"><th style="padding:10px 12px;text-align:left;">排名</th><th style="padding:10px 12px;text-align:left;">编号</th><th style="padding:10px 12px;text-align:left;">出库总量</th><th style="padding:10px 12px;text-align:left;">出库次数</th></tr></thead><tbody id="statsTableBody"></tbody></table></div>`;
}

window.runSalesStats=async function(preset){
  let start,end;
  if(preset==="custom"){
    const sv=$("stats_start").value, ev=$("stats_end").value;
    if(!sv||!ev) return alert("请选择开始和结束日期");
    start=new Date(sv); start.setHours(0,0,0,0); end=new Date(ev); end.setHours(23,59,59,999);
  } else {
    const r=getRange(preset||"month"); start=r.start; end=r.end;
    const toI=d=>d.toISOString().split("T")[0];
    if($("stats_start")) $("stats_start").value=toI(start);
    if($("stats_end")) $("stats_end").value=toI(end);
  }
  const summaryEl=$("statsSummary"); if(summaryEl) summaryEl.innerText="加载中…";
  try{
    const snap=await getDocs(query(collection(db,"logs"), where("type","==","出库")));
    const map={}; let totalQty=0,totalOrders=0;
    snap.forEach(d=>{
      const l=d.data();
      let t = null;
      if(l.timestamp && typeof l.timestamp.toDate === "function") t = l.timestamp.toDate();
      else if(l.timestamp instanceof Date) t = l.timestamp;
      if(!t) return;
      if(t < start || t > end) return;
      const code=(l.code||"未知").toString(); const qty=Number(l.qty||0);
      if(!map[code]) map[code]={qty:0,count:0};
      map[code].qty+=qty; map[code].count+=1;
      totalQty+=qty; totalOrders+=1;
    });
    adminRankedCache=Object.entries(map).map(([code,v])=>({code,qty:Number(v.qty.toFixed(4)),count:v.count}));
    if(summaryEl) summaryEl.innerText=adminRankedCache.length?`共 ${totalOrders} 笔出库，总量 ${Number(totalQty.toFixed(2))}，涉及 ${adminRankedCache.length} 个编号`:"该时间段没有出库记录";
    renderAdminStatsTable();
    const byQty=[...adminRankedCache].sort((a,b)=>b.qty-a.qty);
    const colors=["#3498db","#e67e22","#2ecc71","#9b59b6","#e74c3c","#1abc9c","#f39c12","#2980b9","#16a085","#c0392b","#8e44ad","#27ae60","#d35400","#34495e","#7f8c8d"];
    const top15=byQty.slice(0,15), top10=byQty.slice(0,10);
    if(typeof Chart!=="undefined"){
      if(salesBarChart){ salesBarChart.destroy(); salesBarChart=null; } if(salesPieChart){ salesPieChart.destroy(); salesPieChart=null; }
      const barCanvas=$("salesBarChart"), pieCanvas=$("salesPieChart");
      if(barCanvas) salesBarChart=new Chart(barCanvas,{type:"bar",data:{labels:top15.map(r=>r.code),datasets:[{label:"出库数量",data:top15.map(r=>r.qty),backgroundColor:colors.slice(0,top15.length)}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
      if(pieCanvas) salesPieChart=new Chart(pieCanvas,{type:"pie",data:{labels:top10.map(r=>r.code),datasets:[{data:top10.map(r=>r.qty),backgroundColor:colors.slice(0,top10.length)}]},options:{responsive:true,plugins:{legend:{position:"bottom"}}}});
    }
  }catch(err){ console.error(err); if(summaryEl) summaryEl.innerText="统计失败："+(err.message||err); alert("统计失败："+(err.message||err)); }
};

async function log(type,data,qty,customer=""){
  await addDoc(collection(db,"logs"),{timestamp:serverTimestamp(),type,code:data.code,spec:data.spec||"",color:data.color,warehouse:data.warehouse,qty,customer});
}

window.handleImport=async function(){
  const file=$("excelFile").files[0]; if(!file) return alert("请选择文件"); alert("开始导入…");
  const reader=new FileReader();
  reader.onload=async function(e){
    try{
      const workbook=XLSX.read(new Uint8Array(e.target.result),{type:"array"}); let successCount=0;
      for(let sheetName of workbook.SheetNames){
        for(let row of XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])){
          const safeWarehouse=(row["所在仓库"]||"").toString().replaceAll("/","_").replaceAll("\\","_").replaceAll(" ","").trim().toLowerCase();
          const safeCode=(row["编号"]||"").toString().replaceAll("/","_").replaceAll("\\","_").replaceAll(" ","").trim();
          const safeColor=(row["色号"]||"默认").toString().replaceAll("/","_").replaceAll("\\","_").replaceAll(" ","").trim();
          if(!safeCode||!safeWarehouse) continue;
          await setDoc(doc(db,"inventory",`${safeCode}_${safeColor}_${safeWarehouse}`),{code:safeCode,spec:(row["规格"]||"").toString(),color:safeColor,warehouse:safeWarehouse,stock:Number(row["数量"])||0,piecesPerBox:row["每箱片数"]?Number(row["每箱片数"]):null,reservedList:[],lastUpdate:serverTimestamp()});
          successCount++;
        }
      }
      alert(`导入完成 ✅ 共导入 ${successCount} 条`);
    }catch(error){ console.error(error); alert("导入失败"); }
  };
  reader.readAsArrayBuffer(file);
};

window.exportInventory=async function(){
  try{
    alert("正在导出…"); const snap=await getDocs(collection(db,"inventory")); let warehouseMap={}, allRows=[];
    snap.forEach(docSnap=>{ const i=docSnap.data(); if(i.hidden) return;
      let reserved=0; if(Array.isArray(i.reservedList)) i.reservedList.forEach(r=>{ if(r) reserved+=Number(r.qty||r.quantity||0); });
      const row={"编号":i.code||"","规格":i.spec||"","色号":i.color||"","数量":Number(i.stock||0),"所在仓库":i.warehouse||"","留货":reserved,"每箱片数":i.piecesPerBox||""};
      let w=(i.warehouse||"未分类").toString().replace(/[\\\/\?\*\[\]\:]/g,"_").trim().substring(0,31)||"未分类";
      if(!warehouseMap[w]) warehouseMap[w]=[]; warehouseMap[w].push(row); allRows.push(row);
    });
    if(!Object.keys(warehouseMap).length) return alert("没有可导出的数据");
    const wb=XLSX.utils.book_new();
    for(const w in warehouseMap) XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(warehouseMap[w]),w);
    allRows.sort((a,b)=>{
      const s=String(a["规格"]||"").localeCompare(String(b["规格"]||""),"zh-CN"); if(s) return s;
      const q=Number(a["数量"]||0)-Number(b["数量"]||0); if(q) return q;
      return String(a["编号"]||"").localeCompare(String(b["编号"]||""),"zh-CN");
    });
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(allRows),"全部排序");
    XLSX.writeFile(wb,`当前库存_${new Date().toISOString().split("T")[0]}.xlsx`); alert("导出成功！");
  }catch(err){ alert("导出失败："+(err.message||err)); }
};

console.log("准备注册 handleImport");
