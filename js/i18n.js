/**
 * 中 / EN / ไทย switcher. Default zh. localStorage.tile_lang
 * v20260902c
 */
(function (g) {
  var KEY = "tile_lang";
  var LANGS = ["zh", "en", "th"];
  var LABELS = { zh: "中文", en: "EN", th: "ไทย" };
  var D = {
    zh: {
      "title.stock": "库存查询", "title.transit": "在途货物", "title.ship": "出货计划",
      "title.boxes": "纸箱库存", "title.grout": "美缝剂库存", "title.report": "出库排行",
      "title.admin": "库存管理后台",
      "nav.stock": "库存", "nav.transit": "在途", "nav.ship": "出货", "nav.boxes": "纸箱",
      "nav.grout": "美缝", "nav.report": "看板", "nav.admin": "设置",
      "btn.search": "查询", "btn.refresh": "刷新", "btn.showAll": "显示全部",
      "ph.searchCodeSpec": "输入编号或规格，如 3609, 300x600",
      "ph.searchTransit": "搜索编号/柜号/提单",
      "h.transit": "在途货物", "h.ship": "出货计划", "h.boxes": "纸箱库存",
      "h.grout": "美缝剂库存", "h.report": "出库排行（老板看板）",
      "tip.transit": "数据由管理员手动更新，超过 1 周可能不准确",
      "opt.active": "在途+已到港", "opt.inTransit": "仅在途", "opt.arrived": "仅已到港",
      "opt.history": "历史（已入库/取消）", "opt.all": "全部",
      "col.image": "图片", "col.code": "编号", "col.spec": "规格", "col.color": "色号",
      "col.stock": "库存", "col.reserve": "留货", "col.warehouse": "仓库",
      "col.container": "柜号", "col.qty": "数量", "col.status": "状态",
      "col.remark": "备注", "col.booked": "预定",
      "status.inTransit": "在途", "status.arrived": "已到港",
      "status.inbound": "已入库", "status.cancelled": "取消",
      "msg.needKeyword": "请输入编号或规格", "msg.searching": "搜索中…",
      "msg.firstLoad": "首次加载库存数据，稍候…", "msg.searchFail": "搜索失败，请稍后重试",
      "msg.notFound": "未找到库存", "msg.refreshing": "正在从服务器刷新库存…",
      "msg.refreshed": "库存已刷新（共 {n} 条），请重新搜索", "msg.refreshFail": "刷新失败",
      "msg.loading": "加载中…", "msg.loadFail": "加载失败",
      "msg.noTransit": "暂无在途数据", "msg.noData": "暂无数据",
      "reserve.none": "留货 0", "reserve.has": "留货 {n}", "reserve.customer": "客户：",
      "reserve.unknown": "未填客户",
      "banner.overdueTitle": "⚠ 有 {n} 笔留货已超过 30 天，请联系管理员",
      "banner.overdueItem": "（已留 {days} 天）", "banner.more": "…还有 {n} 笔",
      "pack.pcsBox": "{n}片/箱",
      "transit.bl": "提单", "transit.noBl": "(无提单号)",
      "transit.hint": "共 {g} 个提单，{n} 行", "transit.meta": "{c} 柜 · {n} 行",
      "transit.eta": "预计到港：", "transit.updated": "更新：",
      "transit.stale": "⚠️ 部分在途数据上次更新已超过 {days} 天，请联系管理员确认。",
      "report.today": "今天", "report.week": "本周", "report.month": "本月",
      "report.year": "本年", "report.or": "或", "report.wh": "仓库",
      "report.allWh": "全部仓库", "report.bar": "出库 Top 15（柱状图）",
      "report.pie": "Top 10 占比（饼图）", "report.sort": "排名排序：",
      "report.sortQty": "按出库数量", "report.sortCount": "按出库次数",
      "report.rank": "排名", "report.outQty": "出库总量", "report.outCount": "出库次数",
      "report.hint": "此页面无需登录，仅供查看", "report.needDate": "请选择开始和结束日期",
      "report.summary": "共 {orders} 笔出库{wh}，总量 {qty}，涉及 {codes} 个编号",
      "report.empty": "该时间段没有出库记录{wh}", "report.whTag": "（仓库 {w}）",
      "report.chartQty": "出库数量",
      "admin.header": "库存管理后台", "admin.login": "管理员登录",
      "admin.email": "邮箱", "admin.password": "密码", "admin.signin": "登录",
      "admin.in": "入库", "admin.out": "出库", "admin.reserve": "留货",
      "admin.log": "日志", "admin.stats": "统计", "admin.transit": "在途",
      "admin.files": "文件", "admin.ship": "出货计划", "admin.boxes": "纸箱",
      "admin.grout": "美缝剂", "admin.logout": "退出"
    },
    en: {
      "title.stock": "Stock Search", "title.transit": "In Transit", "title.ship": "Shipping Plan",
      "title.boxes": "Carton Stock", "title.grout": "Grout Stock", "title.report": "Outbound Ranking",
      "title.admin": "Inventory Admin",
      "nav.stock": "Stock", "nav.transit": "Transit", "nav.ship": "Ship", "nav.boxes": "Boxes",
      "nav.grout": "Grout", "nav.report": "Board", "nav.admin": "Admin",
      "btn.search": "Search", "btn.refresh": "Refresh", "btn.showAll": "Show all",
      "ph.searchCodeSpec": "Code or size, e.g. 3609, 300x600",
      "ph.searchTransit": "Search code / container / B/L",
      "h.transit": "Goods in transit", "h.ship": "Shipping plan", "h.boxes": "Carton stock",
      "h.grout": "Grout stock", "h.report": "Outbound ranking (owner board)",
      "tip.transit": "Updated manually by admin. Data older than 1 week may be stale.",
      "opt.active": "In transit + arrived", "opt.inTransit": "In transit only",
      "opt.arrived": "Arrived only", "opt.history": "History (received / cancelled)", "opt.all": "All",
      "col.image": "Photo", "col.code": "Code", "col.spec": "Size", "col.color": "Color",
      "col.stock": "Stock", "col.reserve": "Reserved", "col.warehouse": "Warehouse",
      "col.container": "Container", "col.qty": "Qty", "col.status": "Status",
      "col.remark": "Note", "col.booked": "Reserved",
      "status.inTransit": "In transit", "status.arrived": "Arrived",
      "status.inbound": "Received", "status.cancelled": "Cancelled",
      "msg.needKeyword": "Please enter a code or size", "msg.searching": "Searching…",
      "msg.firstLoad": "Loading stock for the first time…", "msg.searchFail": "Search failed. Please try again.",
      "msg.notFound": "No stock found", "msg.refreshing": "Refreshing stock from server…",
      "msg.refreshed": "Stock refreshed ({n} items). Please search again.", "msg.refreshFail": "Refresh failed",
      "msg.loading": "Loading…", "msg.loadFail": "Load failed",
      "msg.noTransit": "No in-transit data", "msg.noData": "No data",
      "reserve.none": "Reserved 0", "reserve.has": "Reserved {n}", "reserve.customer": "Customer: ",
      "reserve.unknown": "No customer",
      "banner.overdueTitle": "⚠ {n} reservation(s) older than 30 days. Contact admin.",
      "banner.overdueItem": "({days} days reserved)", "banner.more": "…and {n} more",
      "pack.pcsBox": "{n} pcs/box",
      "transit.bl": "B/L", "transit.noBl": "(no B/L)",
      "transit.hint": "{g} B/L, {n} rows", "transit.meta": "{c} ctr · {n} rows",
      "transit.eta": "ETA: ", "transit.updated": "Updated: ",
      "transit.stale": "⚠️ Some transit data was last updated {days} days ago. Please confirm with admin.",
      "report.today": "Today", "report.week": "This week", "report.month": "This month",
      "report.year": "This year", "report.or": "or", "report.wh": "Warehouse",
      "report.allWh": "All warehouses", "report.bar": "Outbound Top 15 (bar)",
      "report.pie": "Top 10 share (pie)", "report.sort": "Sort:",
      "report.sortQty": "By quantity", "report.sortCount": "By times",
      "report.rank": "Rank", "report.outQty": "Total qty", "report.outCount": "Times",
      "report.hint": "View only. No login required.", "report.needDate": "Please pick start and end dates",
      "report.summary": "{orders} outbound tickets{wh}, qty {qty}, {codes} codes",
      "report.empty": "No outbound records in this period{wh}", "report.whTag": " (warehouse {w})",
      "report.chartQty": "Outbound qty",
      "admin.header": "Inventory Admin", "admin.login": "Admin login",
      "admin.email": "Email", "admin.password": "Password", "admin.signin": "Sign in",
      "admin.in": "Inbound", "admin.out": "Outbound", "admin.reserve": "Reserve",
      "admin.log": "Logs", "admin.stats": "Stats", "admin.transit": "Transit",
      "admin.files": "Files", "admin.ship": "Ship plan", "admin.boxes": "Boxes",
      "admin.grout": "Grout", "admin.logout": "Log out"
    },
    th: {
      "title.stock": "ค้นหาสต็อก", "title.transit": "สินค้าระหว่างทาง", "title.ship": "แผนส่งสินค้า",
      "title.boxes": "สต็อกกล่อง", "title.grout": "สต็อกยาแนว", "title.report": "อันดับเบิกสินค้า",
      "title.admin": "หลังบ้านคลังสินค้า",
      "nav.stock": "สต็อก", "nav.transit": "ระหว่างทาง", "nav.ship": "ส่งของ", "nav.boxes": "กล่อง",
      "nav.grout": "ยาแนว", "nav.report": "แดชบอร์ด", "nav.admin": "ตั้งค่า",
      "btn.search": "ค้นหา", "btn.refresh": "รีเฟรช", "btn.showAll": "แสดงทั้งหมด",
      "ph.searchCodeSpec": "ใส่รหัสหรือขนาด เช่น 3609, 300x600",
      "ph.searchTransit": "ค้นหารหัส / ตู้ / B/L",
      "h.transit": "สินค้าระหว่างทาง", "h.ship": "แผนส่งสินค้า", "h.boxes": "สต็อกกล่อง",
      "h.grout": "สต็อกยาแนว", "h.report": "อันดับเบิกสินค้า (แดชบอร์ด)",
      "tip.transit": "แอดมินอัปเดตเอง เกิน 1 สัปดาห์อาจไม่ล่าสุด",
      "opt.active": "ระหว่างทาง+ถึงท่า", "opt.inTransit": "เฉพาะระหว่างทาง",
      "opt.arrived": "เฉพาะถึงท่า", "opt.history": "ประวัติ (เข้าคลัง/ยกเลิก)", "opt.all": "ทั้งหมด",
      "col.image": "รูป", "col.code": "รหัส", "col.spec": "ขนาด", "col.color": "สี",
      "col.stock": "สต็อก", "col.reserve": "จอง", "col.warehouse": "คลัง",
      "col.container": "ตู้", "col.qty": "จำนวน", "col.status": "สถานะ",
      "col.remark": "หมายเหตุ", "col.booked": "จอง",
      "status.inTransit": "ระหว่างทาง", "status.arrived": "ถึงท่า",
      "status.inbound": "เข้าคลัง", "status.cancelled": "ยกเลิก",
      "msg.needKeyword": "กรุณาใส่รหัสหรือขนาด", "msg.searching": "กำลังค้นหา…",
      "msg.firstLoad": "กำลังโหลดสต็อกครั้งแรก…", "msg.searchFail": "ค้นหาไม่สำเร็จ ลองใหม่",
      "msg.notFound": "ไม่พบสต็อก", "msg.refreshing": "กำลังรีเฟรชสต็อกจากเซิร์ฟเวอร์…",
      "msg.refreshed": "รีเฟรชแล้ว ({n} รายการ) กรุณาค้นหาใหม่", "msg.refreshFail": "รีเฟรชไม่สำเร็จ",
      "msg.loading": "กำลังโหลด…", "msg.loadFail": "โหลดไม่สำเร็จ",
      "msg.noTransit": "ไม่มีสินค้าระหว่างทาง", "msg.noData": "ไม่มีข้อมูล",
      "reserve.none": "จอง 0", "reserve.has": "จอง {n}", "reserve.customer": "ลูกค้า：",
      "reserve.unknown": "ไม่ได้ใส่ลูกค้า",
      "banner.overdueTitle": "⚠ มีการจอง {n} รายการเกิน 30 วัน ติดต่อแอดมิน",
      "banner.overdueItem": "(จองแล้ว {days} วัน)", "banner.more": "…อีก {n} รายการ",
      "pack.pcsBox": "{n}แผ่น/กล่อง",
      "transit.bl": "B/L", "transit.noBl": "(ไม่มี B/L)",
      "transit.hint": "{g} ใบ B/L, {n} แถว", "transit.meta": "{c} ตู้ · {n} แถว",
      "transit.eta": "ถึงท่าโดยประมาณ：", "transit.updated": "อัปเดต：",
      "transit.stale": "⚠️ ข้อมูลระหว่างทางบางส่วนอัปเดตเกิน {days} วัน กรุณายืนยันกับแอดมิน",
      "report.today": "วันนี้", "report.week": "สัปดาห์นี้", "report.month": "เดือนนี้",
      "report.year": "ปีนี้", "report.or": "หรือ", "report.wh": "คลัง",
      "report.allWh": "ทุกคลัง", "report.bar": "เบิก Top 15 (กราฟแท่ง)",
      "report.pie": "สัดส่วน Top 10 (วงกลม)", "report.sort": "เรียงอันดับ：",
      "report.sortQty": "ตามจำนวน", "report.sortCount": "ตามครั้ง",
      "report.rank": "อันดับ", "report.outQty": "รวมเบิก", "report.outCount": "จำนวนครั้ง",
      "report.hint": "ดูอย่างเดียว ไม่ต้องล็อกอิน", "report.needDate": "เลือกวันที่เริ่มและสิ้นสุด",
      "report.summary": "เบิก {orders} รายการ{wh} รวม {qty} คอบคลุม {codes} รหัส",
      "report.empty": "ช่วงนี้ไม่มีรายการเบิก{wh}", "report.whTag": " (คลัง {w})",
      "report.chartQty": "จำนวนเบิก",
      "admin.header": "หลังบ้านคลังสินค้า", "admin.login": "เข้าสู่ระบบแอดมิน",
      "admin.email": "อีเมล", "admin.password": "รหัสผ่าน", "admin.signin": "เข้าสู่ระบบ",
      "admin.in": "รับเข้า", "admin.out": "เบิกออก", "admin.reserve": "จองของ",
      "admin.log": "ล็อก", "admin.stats": "สถิติ", "admin.transit": "ระหว่างทาง",
      "admin.files": "ไฟล์", "admin.ship": "แผนส่งของ", "admin.boxes": "กล่อง",
      "admin.grout": "ยาแนว", "admin.logout": "ออก"
    }
  };

  function getLang() {
    try { var v = localStorage.getItem(KEY); if (LANGS.indexOf(v) >= 0) return v; } catch (e) {}
    return "zh";
  }
  function fill(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] == null ? "" : vars[k]; });
  }
  function t(key, vars) {
    var lang = getLang();
    return fill((D[lang] && D[lang][key]) || (D.zh && D.zh[key]) || key, vars);
  }
  function pick(zh, en, th) {
    var lang = getLang();
    if (lang === "en") return en == null ? zh : en;
    if (lang === "th") return th == null ? zh : th;
    return zh;
  }
  function statusLabel(st) {
    if (st === "已到港") return t("status.arrived");
    if (st === "已入库") return t("status.inbound");
    if (st === "取消") return t("status.cancelled");
    return t("status.inTransit");
  }
  function apply() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    var titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) titleEl.textContent = t(titleEl.getAttribute("data-i18n"));
    try { document.documentElement.setAttribute("lang", getLang() === "zh" ? "zh-CN" : getLang()); } catch (e) {}
    var bar = document.getElementById("langSwitch");
    if (bar) bar.querySelectorAll("button[data-lang]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === getLang());
    });
  }
  function setLang(lang) {
    if (LANGS.indexOf(lang) < 0) lang = "zh";
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply();
    try { g.dispatchEvent(new CustomEvent("tile-lang-change", { detail: { lang: lang } })); } catch (e) {}
  }
  function injectSwitch() {
    if (document.getElementById("langSwitch")) return;
    var bar = document.createElement("div");
    bar.id = "langSwitch";
    bar.className = "lang-switch";
    bar.innerHTML = LANGS.map(function (code) {
      return '<button type="button" data-lang="' + code + '">' + LABELS[code] + "</button>";
    }).join("");
    bar.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("button[data-lang]") : null;
      if (btn) setLang(btn.getAttribute("data-lang"));
    });
    document.body.appendChild(bar);
  }
  function boot() { injectSwitch(); apply(); }
  g.I18N = { t: t, pick: pick, getLang: getLang, setLang: setLang, apply: apply, applyPhrases: apply, statusLabel: statusLabel };
  g.t = t;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
