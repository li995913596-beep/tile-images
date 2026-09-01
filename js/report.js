import { db } from "./firebase.js";
import {
  collection, getDocs, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let barChart = null;
let pieChart = null;
let rankedCache = [];
let sortBy = "qty";

function $(id){ return document.getElementById(id); }

function getRange(preset){
  const end = new Date();
  end.setHours(23,59,59,999);
  const start = new Date();
  start.setHours(0,0,0,0);
  if(preset === "week"){
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - (day - 1));
  } else if(preset === "month"){
    start.setDate(1);
  } else if(preset === "year"){
    start.setMonth(0, 1);
  }
  return { start, end };
}

function setActivePeriod(preset){
  ["today","week","month","year"].forEach(p => {
    const btn = $("btn_" + p);
    if(btn) btn.classList.toggle("active", p === preset);
  });
}

function renderTable(){
  const list = [...rankedCache];
  if(sortBy === "count"){
    list.sort((a,b) => b.count - a.count || b.qty - a.qty);
  } else {
    list.sort((a,b) => b.qty - a.qty || b.count - a.count);
  }
  const tbody = $("tableBody");
  if(!tbody) return;
  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="4" style="padding:16px;text-align:center;color:#888;">暂无数据 / ไม่มีข้อมูล</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((r,i) => `
    <tr>
      <td>${i+1}</td>
      <td>${r.code}</td>
      <td>${r.qty}</td>
      <td>${r.count}</td>
    </tr>
  `).join("");
}

function renderCharts(){
  const colors = ["#3498db","#e67e22","#2ecc71","#9b59b6","#e74c3c","#1abc9c","#f39c12","#2980b9","#16a085","#c0392b","#8e44ad","#27ae60","#d35400","#34495e","#7f8c8d"];
  const byQty = [...rankedCache].sort((a,b)=>b.qty-a.qty);
  const top15 = byQty.slice(0,15);
  const top10 = byQty.slice(0,10);

  if(typeof Chart === "undefined") return;
  if(barChart){ barChart.destroy(); barChart = null; }
  if(pieChart){ pieChart.destroy(); pieChart = null; }

  const barCanvas = $("barChart");
  const pieCanvas = $("pieChart");
  if(barCanvas){
    barChart = new Chart(barCanvas, {
      type: "bar",
      data: {
        labels: top15.map(r=>r.code),
        datasets: [{ label: "出库数量 / จำนวนเบิก", data: top15.map(r=>r.qty), backgroundColor: colors.slice(0, top15.length) }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }
  if(pieCanvas){
    pieChart = new Chart(pieCanvas, {
      type: "pie",
      data: {
        labels: top10.map(r=>r.code),
        datasets: [{ data: top10.map(r=>r.qty), backgroundColor: colors.slice(0, top10.length) }]
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });
  }
}

window.setSort = function(mode){
  sortBy = mode === "count" ? "count" : "qty";
  const q = $("sort_qty"); const c = $("sort_count");
  if(q) q.classList.toggle("active", sortBy === "qty");
  if(c) c.classList.toggle("active", sortBy === "count");
  renderTable();
};

window.loadReport = async function(preset){
  window._lastPreset = preset || window._lastPreset || "month";
  let start, end;
  if(preset === "custom"){
    const sv = $("r_start").value;
    const ev = $("r_end").value;
    if(!sv || !ev) return alert("请选择开始和结束日期 / เลือกวันที่เริ่ม-สิ้นสุด");
    start = new Date(sv); start.setHours(0,0,0,0);
    end = new Date(ev); end.setHours(23,59,59,999);
  } else {
    const r = getRange(preset || "month");
    start = r.start; end = r.end;
    setActivePeriod(preset || "month");
    const toI = d => d.toISOString().split("T")[0];
    if($("r_start")) $("r_start").value = toI(start);
    if($("r_end")) $("r_end").value = toI(end);
  }

  const whFilter = (($("r_warehouse") && $("r_warehouse").value) || "").trim().toLowerCase();
  const summaryEl = $("summary");
  if(summaryEl) summaryEl.innerText = "加载中… / กำลังโหลด";

  try {
    const snap = await getDocs(query(
      collection(db, "logs"),
      where("timestamp", ">=", start),
      where("timestamp", "<=", end),
      orderBy("timestamp", "desc")
    ));
    const map = {};
    let totalQty = 0, totalOrders = 0;

    snap.forEach(d => {
      const l = d.data();
      if(l.type !== "出库") return;
      if(whFilter && String(l.warehouse || "").toLowerCase() !== whFilter) return;
      const code = (l.code || "未知").toString();
      const qty = Number(l.qty || 0);
      if(!map[code]) map[code] = { qty: 0, count: 0 };
      map[code].qty += qty;
      map[code].count += 1;
      totalQty += qty;
      totalOrders += 1;
    });

    rankedCache = Object.entries(map)
      .map(([code, v]) => ({ code, qty: Number(v.qty.toFixed(4)), count: v.count }));

    const whText = whFilter ? `（仓库 / คลัง ${whFilter}）` : "";
    if(summaryEl){
      summaryEl.innerText = rankedCache.length
        ? `共 ${totalOrders} 笔出库${whText}，总量 ${Number(totalQty.toFixed(2))}，涉及 ${rankedCache.length} 个编号 / ${totalOrders} รายการ`
        : `该时间段没有出库记录${whText} / ไม่มีรายการเบิก`;
    }

    renderTable();
    renderCharts();
  } catch (err) {
    console.error(err);
    if(summaryEl) summaryEl.innerText = "加载失败 / โหลดไม่สำเร็จ：" + (err.message || err);
    alert("加载失败 / โหลดไม่สำเร็จ\n" + (err.message || err));
  }
};

loadReport("month");
