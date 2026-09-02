/**
 * Whole-page ZH / EN / TH switch + live translation of JS-rendered admin UI.
 * v20260902h
 */
(function (g) {
  var P = {
    "入库 / 修改信息": { en: "Inbound / edit info", th: "รับเข้า / แก้ไขข้อมูล" },
    "搜索后可直接改编号、规格、色号、仓库。改编号/色号/仓库会自动换记录，库存和留货保留。": { en: "After search you can edit code, size, color and warehouse. Changing code/color/warehouse moves the record; stock and reserves stay.", th: "ค้นแล้วแก้รหัส ขนาด สี คลังได้ เปลี่ยนรหัส/สี/คลังจะย้ายรายการ สต็อกและของจองยังอยู่" },
    "搜索编号": { en: "Search code", th: "ค้นหารหัส" },
    "搜索": { en: "Search", th: "ค้นหา" },
    "新增库存": { en: "Add stock", th: "เพิ่มสต็อก" },
    "编号": { en: "Code", th: "รหัส" },
    "规格": { en: "Size", th: "ขนาด" },
    "色号": { en: "Color", th: "สี" },
    "仓库": { en: "Warehouse", th: "คลัง" },
    "所在仓库": { en: "Warehouse", th: "คลัง" },
    "每箱片数（可空）": { en: "Pcs / box (optional)", th: "แผ่น/กล่อง (ว่างได้)" },
    "每箱片数": { en: "Pcs / box", th: "แผ่น/กล่อง" },
    "数量（箱）": { en: "Qty (boxes)", th: "จำนวน (กล่อง)" },
    "数量": { en: "Qty", th: "จำนวน" },
    "新增": { en: "Add", th: "เพิ่ม" },
    "自动转小写": { en: "Auto lowercase", th: "แปลงเป็นตัวเล็กอัตโนมัติ" },
    "入库": { en: "Inbound", th: "รับเข้า" },
    "出库": { en: "Outbound", th: "เบิกออก" },
    "留货": { en: "Reserve", th: "จองของ" },
    "日志": { en: "Logs", th: "ล็อก" },
    "统计": { en: "Stats", th: "สถิติ" },
    "在途": { en: "Transit", th: "ระหว่างทาง" },
    "文件": { en: "Files", th: "ไฟล์" },
    "出货计划": { en: "Ship plan", th: "แผนส่งของ" },
    "纸箱": { en: "Boxes", th: "กล่อง" },
    "美缝剂": { en: "Grout", th: "ยาแนว" },
    "退出": { en: "Log out", th: "ออก" },
    "查询": { en: "Search", th: "ค้นหา" },
    "刷新": { en: "Refresh", th: "รีเฟรช" },
    "保存": { en: "Save", th: "บันทึก" },
    "保存修改": { en: "Save changes", th: "บันทึกการแก้" },
    "删除": { en: "Delete", th: "ลบ" },
    "取消": { en: "Cancel", th: "ยกเลิก" },
    "修改": { en: "Edit", th: "แก้ไข" },
    "客户": { en: "Customer", th: "ลูกค้า" },
    "客户名": { en: "Customer", th: "ชื่อลูกค้า" },
    "客户：": { en: "Customer: ", th: "ลูกค้า: " },
    "数量：": { en: "Qty: ", th: "จำนวน: " },
    "本次：": { en: "This time: ", th: "ครั้งนี้: " },
    "操作": { en: "Action", th: "จัดการ" },
    "状态": { en: "Status", th: "สถานะ" },
    "日期": { en: "Date", th: "วันที่" },
    "时间": { en: "Time", th: "เวลา" },
    "备注": { en: "Note", th: "หมายเหตุ" },
    "库存": { en: "Stock", th: "สต็อก" },
    "可售": { en: "For sale", th: "พร้อมขาย" },
    "可出": { en: "Available", th: "ส่งได้" },
    "类型": { en: "Type", th: "ประเภท" },
    "箱": { en: "box", th: "กล่อง" },
    "片": { en: "pcs", th: "แผ่น" },
    "未填": { en: "Blank", th: "ว่าง" },
    "未找到库存": { en: "No stock found", th: "ไม่พบสต็อก" },
    "请输入编号": { en: "Enter a code", th: "กรุณาใส่รหัส" },
    "请输入正确数量": { en: "Enter a valid qty", th: "กรุณาใส่จำนวนที่ถูก" },
    "请填写编号和仓库": { en: "Enter code and warehouse", th: "กรุณาใส่รหัสและคลัง" },
    "登录成功": { en: "Signed in", th: "เข้าสู่ระบบสำเร็จ" },
    "登录失败": { en: "Sign-in failed", th: "เข้าสู่ระบบไม่สำเร็จ" },
    "新增成功": { en: "Added", th: "เพิ่มสำเร็จ" },
    "修改成功": { en: "Updated", th: "แก้ไขสำเร็จ" },
    "入库成功：": { en: "Inbound OK: ", th: "รับเข้าสำเร็จ: " },
    "出库成功：": { en: "Outbound OK: ", th: "เบิกสำเร็จ: " },
    "留货成功：": { en: "Reserved: ", th: "จองสำเร็จ: " },
    "修改信息（编号/色号/仓库改了会自动换记录）": { en: "Edit info (changing code/color/warehouse moves the record)", th: "แก้ไขข้อมูล (เปลี่ยนรหัส/สี/คลังจะย้ายรายการ)" },
    "可售库存出库：": { en: "Outbound from free stock:", th: "เบิกจากสต็อกพร้อมขาย:" },
    "从留货出库（可改数量）：": { en: "Outbound from reserve (qty editable):", th: "เบิกจากของจอง (แก้จำนวนได้):" },
    "从留货出库": { en: "From reserve", th: "เบิกจากของจอง" },
    "留货清单": { en: "Reserve list", th: "รายการจอง" },
    "导出留货信息": { en: "Export reserves", th: "ส่งออกของจอง" },
    "取消留货": { en: "Cancel reserve", th: "ยกเลิกการจอง" },
    "暂无留货记录": { en: "No reserves", th: "ไม่มีรายการจอง" },
    "下载CSV": { en: "Download CSV", th: "ดาวน์โหลด CSV" },
    "暂无数据": { en: "No data", th: "ไม่มีข้อมูล" },
    "卖货分析（出库排行）": { en: "Sales analysis (outbound rank)", th: "วิเคราะห์ยอดเบิก" },
    "今天": { en: "Today", th: "วันนี้" },
    "本周": { en: "This week", th: "สัปดาห์นี้" },
    "本月": { en: "This month", th: "เดือนนี้" },
    "本年": { en: "This year", th: "ปีนี้" },
    "或": { en: "or", th: "หรือ" },
    "全部仓库": { en: "All warehouses", th: "ทุกคลัง" },
    "出库 Top 15": { en: "Outbound Top 15", th: "เบิก Top 15" },
    "Top 10 占比": { en: "Top 10 share", th: "สัดส่วน Top 10" },
    "排名排序：": { en: "Sort:", th: "เรียงอันดับ: " },
    "按出库数量": { en: "By quantity", th: "ตามจำนวน" },
    "按出库次数": { en: "By times", th: "ตามครั้ง" },
    "排名": { en: "Rank", th: "อันดับ" },
    "出库总量": { en: "Total qty", th: "รวมเบิก" },
    "出库次数": { en: "Times", th: "จำนวนครั้ง" },
    "出库数量": { en: "Outbound qty", th: "จำนวนเบิก" },
    "加载中…": { en: "Loading…", th: "กำลังโหลด…" },
    "确认出库": { en: "Confirm outbound", th: "ยืนยันเบิกออก" },
    "库存不足": { en: "Not enough stock", th: "สต็อกไม่พอ" },
    "编号不能为空": { en: "Code required", th: "ต้องใส่รหัส" },
    "仓库不能为空": { en: "Warehouse required", th: "ต้องใส่คลัง" },
    "没有改动": { en: "No changes", th: "ไม่มีการเปลี่ยน" },
    "记录不存在": { en: "Record not found", th: "ไม่พบรายการ" },
    "当前没有留货记录": { en: "No reserve records", th: "ไม่มีรายการจอง" },
    "导出成功！": { en: "Exported", th: "ส่งออกสำเร็จ" },
    "管理员登录": { en: "Admin login", th: "เข้าสู่ระบบแอดมิน" },
    "库存管理后台": { en: "Inventory Admin", th: "หลังบ้านคลังสินค้า" },
    "邮箱": { en: "Email", th: "อีเมล" },
    "密码": { en: "Password", th: "รหัสผ่าน" },
    "登录": { en: "Sign in", th: "เข้าสู่ระบบ" },
    "显示全部": { en: "Show all", th: "แสดงทั้งหมด" },
    "在途货物": { en: "Goods in transit", th: "สินค้าระหว่างทาง" },
    "在途货物管理": { en: "In-transit management", th: "จัดการสินค้าระหว่างทาง" },
    "一个柜子多种砖：同一柜号新增多行即可。色号可空。列表按提单分组。可按提单/柜号批量删除。": { en: "One container, many tiles: add extra rows with the same container no. Color optional. Grouped by B/L. Batch delete by B/L or container.", th: "ตู้เดียวหลายรุ่น: เพิ่มหลายแถวด้วยเลขตู้เดียวกัน สีเว้นว่างได้ จัดกลุ่มตาม B/L ลบทั้ง B/L หรือทั้งตู้ได้" },
    "纸箱库存": { en: "Carton stock", th: "สต็อกกล่อง" },
    "美缝剂库存": { en: "Grout stock", th: "สต็อกยาแนว" },
    "解锁编辑": { en: "Unlock edit", th: "ปลดล็อกแก้ไข" },
    "锁定编辑": { en: "Lock edit", th: "ล็อกแก้ไข" },
    "可查看；入库/出库/新增需口令": { en: "View only; PIN required to edit", th: "ดูได้อย่างเดียว แก้ไขต้องใส่รหัส" },
    "已解锁编辑（本会话）": { en: "Editing unlocked (this session)", th: "ปลดล็อกแล้ว (เซสชันนี้)" },
    "仅供查看。修改请联系管理员": { en: "View only. Ask admin to edit.", th: "ดูอย่างเดียว แก้ไขที่หลังบ้าน" },
    "加入计划": { en: "Add to plan", th: "เพิ่มแผน" },
    "生成出货计划": { en: "Make ship plan", th: "สร้างแผนส่งของ" },
    "尚未加入瓷砖": { en: "No tiles added", th: "ยังไม่มีรายการ" },
    "导入在途": { en: "Import transit", th: "นำเข้าของระหว่างทาง" },
    "导出 Excel": { en: "Export Excel", th: "ส่งออก Excel" },
    "加载明细": { en: "Load lines", th: "โหลดรายการ" },
    "确认整柜入库": { en: "Confirm container inbound", th: "ยืนยันรับเข้าทั้งตู้" },
    "请选择柜号": { en: "Select container", th: "เลือกตู้" },
    "刷新柜号": { en: "Refresh containers", th: "รีเฟรชตู้" },
    "选择仓库": { en: "Warehouse", th: "เลือกคลัง" },
    "导入库存": { en: "Import stock", th: "นำเข้าสต็อก" },
    "导出当前库存": { en: "Export stock", th: "ส่งออกสต็อก" },
    "保存 Token": { en: "Save token", th: "บันทึก Token" },
    "手动新增": { en: "Add manually", th: "เพิ่มเอง" },
    "整柜一键入库": { en: "Receive whole container", th: "รับเข้าทั้งตู้" },
    "预计到港": { en: "ETA", th: "ถึงท่าโดยประมาณ" },
    "提单号": { en: "B/L no.", th: "เลข B/L" },
    "柜号": { en: "Container", th: "ตู้" },
    "文件与图片管理": { en: "Files and photos", th: "จัดการไฟล์และรูป" },
    "上传 / 替换图片": { en: "Upload / replace photo", th: "อัปโหลด / เปลี่ยนรูป" },
    "库存文件": { en: "Inventory file", th: "ไฟล์สต็อก" },
    "搜索编号或规格": { en: "Search code or size", th: "ค้นหารหัสหรือขนาด" },
    "粘贴 GitHub Token": { en: "Paste GitHub Token", th: "วาง GitHub Token" },
    "Excel 导入装箱单": { en: "Import packing list", th: "นำเข้าใบแพ็ก" },
    "型号/编号*": { en: "Code*", th: "รหัส*" },
    "色号(可空)": { en: "Color (optional)", th: "สี (ว่างได้)" },
    "搜索编号/柜号/提单": { en: "Search code / container / B/L", th: "ค้นหารหัส / ตู้ / B/L" },
    "在途+已到港": { en: "In transit + arrived", th: "ระหว่างทาง+ถึงท่า" },
    "仅在途": { en: "In transit only", th: "เฉพาะระหว่างทาง" },
    "仅已到港": { en: "Arrived only", th: "เฉพาะถึงท่า" },
    "历史": { en: "History", th: "ประวัติ" },
    "全部": { en: "All", th: "ทั้งหมด" },
    "已到港": { en: "Arrived", th: "ถึงท่า" },
    "已入库": { en: "Received", th: "เข้าคลังแล้ว" },
    "留货数量": { en: "Reserved qty", th: "จำนวนจอง" },
    "留货时间": { en: "Reserved at", th: "เวลาจอง" },
    "修改留货": { en: "Edit reserve", th: "แก้ไขการจอง" },
    "常规出库": { en: "Normal outbound", th: "เบิกปกติ" },
    "留货出库": { en: "Outbound from reserve", th: "เบิกจากของจอง" },
    "手动入库": { en: "Manual inbound", th: "รับเข้ามือ" },
    "从留货出": { en: "From reserve", th: "เบิกจากของจอง" },
    "操作人": { en: "Operator", th: "ผู้ทำรายการ" },
    "不用搜编号。老板不登录也可看：打开": { en: "No search needed. Owner can open without login:", th: "ไม่ต้องค้นรหัส เจ้านายเปิดดูได้โดยไม่ต้องล็อกอิน:" },
    "请选择开始和结束日期": { en: "Pick start and end dates", th: "เลือกวันเริ่มและวันสิ้นสุด" },
    "全部排序": { en: "Sort all", th: "เรียงทั้งหมด" },
    "撤销": { en: "Undo", th: "ย้อนกลับ" },
    "确认": { en: "Confirm", th: "ยืนยัน" },
    "完成": { en: "Done", th: "เสร็จ" },
    "导入": { en: "Import", th: "นำเข้า" },
    "导出": { en: "Export", th: "ส่งออก" }
  };

  var KEYS = Object.keys(P).sort(function (a, b) { return b.length - a.length; });
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE)$/;

  function lang() {
    try {
      var v = localStorage.getItem("tile_lang");
      if (v === "en" || v === "th" || v === "zh") return v;
    } catch (e) {}
    if (g.I18N && g.I18N.getLang) return g.I18N.getLang();
    return "zh";
  }
  function writeLang(code) {
    try { localStorage.setItem("tile_lang", code); } catch (e) {}
    try { document.cookie = "tile_lang=" + code + ";path=/;max-age=31536000;SameSite=Lax"; } catch (e) {}
  }
  function phrase(zh) {
    if (zh == null) return zh;
    var s = String(zh);
    var L = lang();
    if (L === "zh") return s;
    var hit = P[s];
    if (hit) return L === "en" ? (hit.en || s) : (hit.th || s);
    var out = s;
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      if (k.length < 2) continue;
      if (out.indexOf(k) === -1) continue;
      var tr = L === "en" ? P[k].en : P[k].th;
      out = out.split(k).join(tr);
    }
    return out;
  }
  function translateNodeText(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.id === "langSwitch" || (el.closest && el.closest("#langSwitch"))) return;
    if (el.getAttribute && el.getAttribute("data-i18n")) return;
    if (el.children && el.children.length) return;
    var cur = (el.textContent || "").trim();
    if (!cur) return;
    var orig = el.getAttribute("data-i18n-src");
    if (!orig) {
      if (!/[\u4e00-\u9fff]/.test(cur)) return;
      orig = cur;
      el.setAttribute("data-i18n-src", orig);
    } else if (/[\u4e00-\u9fff]/.test(cur) && (P[cur] || cur !== orig)) {
      orig = /[\u4e00-\u9fff]/.test(cur) ? cur : orig;
      el.setAttribute("data-i18n-src", orig);
    }
    var next = phrase(orig);
    if (next && el.textContent.trim() !== next) el.textContent = next;
  }
  function wrapTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    var parent = node.parentNode;
    if (!parent || parent.nodeType !== 1) return;
    if (SKIP.test(parent.tagName)) return;
    if (parent.id === "langSwitch" || (parent.closest && parent.closest("#langSwitch"))) return;
    if (parent.getAttribute && parent.getAttribute("data-i18n")) return;
    if (parent.getAttribute && parent.getAttribute("data-i18n-src") && parent.childNodes.length === 1) return;
    var raw = node.nodeValue;
    if (!raw || !/[\u4e00-\u9fff]/.test(raw)) return;
    var span = document.createElement("span");
    span.setAttribute("data-i18n-src", raw);
    span.textContent = phrase(raw);
    parent.replaceChild(span, node);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { wrapTextNode(root); return; }
    if (root.nodeType !== 1) return;
    if (root.id === "langSwitch" || SKIP.test(root.tagName)) return;
    if (root.getAttribute && root.getAttribute("data-i18n")) return;
    if (!root.children || !root.children.length) {
      translateNodeText(root);
      return;
    }
    var list = [];
    for (var i = 0; i < root.childNodes.length; i++) list.push(root.childNodes[i]);
    for (var j = 0; j < list.length; j++) {
      var n = list[j];
      if (n.nodeType === 3) wrapTextNode(n);
      else if (n.nodeType === 1) walk(n);
    }
  }
  function applyPlaceholders(root) {
    var phs = (root || document).querySelectorAll("input[placeholder],textarea[placeholder]");
    for (var j = 0; j < phs.length; j++) {
      var inp = phs[j];
      if (inp.getAttribute("data-i18n-placeholder")) continue;
      var src = inp.getAttribute("data-i18n-ph-src");
      var po = inp.getAttribute("placeholder") || "";
      if (!src) {
        if (!/[\u4e00-\u9fff]/.test(po)) continue;
        src = po;
        inp.setAttribute("data-i18n-ph-src", src);
      } else if (/[\u4e00-\u9fff]/.test(po)) {
        src = po;
        inp.setAttribute("data-i18n-ph-src", src);
      }
      inp.setAttribute("placeholder", phrase(src));
    }
  }
  function applyPhrases(root) {
    root = root || document.body;
    if (!root) return;
    g.__tileApplying = true;
    try {
      walk(root);
      applyPlaceholders(root);
    } finally {
      g.__tileApplying = false;
    }
  }
  function paintBar() {
    var bar = document.getElementById("langSwitch");
    if (!bar) return;
    var cur = lang();
    var btns = bar.querySelectorAll("button[data-lang]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("active", btns[i].getAttribute("data-lang") === cur);
    }
  }
  function paint() {
    if (g.I18N && g.I18N.apply && !g.__tileNestedApply) {
      g.__tileNestedApply = true;
      try { g.I18N.apply(); } catch (e) {}
      g.__tileNestedApply = false;
    }
    applyPhrases(document.body);
    paintBar();
  }
  function setLang(code) {
    if (code !== "zh" && code !== "en" && code !== "th") return;
    writeLang(code);
    if (g.I18N && g.I18N.setLang && !g.__tileNestedSet) {
      g.__tileNestedSet = true;
      try { g.I18N.setLang(code); } catch (e) {}
      g.__tileNestedSet = false;
    }
    paint();
    try { g.dispatchEvent(new CustomEvent("tile-lang-change", { detail: { lang: code } })); } catch (e) {}
  }
  function bind() {
    if (g.__tileLangBound) return;
    g.__tileLangBound = true;
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest("#langSwitch button[data-lang], .lang-switch button[data-lang]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      setLang(btn.getAttribute("data-lang"));
    }, true);
    if (!g.__tileAlertWrapped) {
      g.__tileAlertWrapped = true;
      var a = g.alert, c = g.confirm;
      if (typeof a === "function") g.alert = function (msg) { return a.call(g, phrase(String(msg == null ? "" : msg))); };
      if (typeof c === "function") g.confirm = function (msg) { return c.call(g, phrase(String(msg == null ? "" : msg))); };
    }
  }
  function hookShowTab() {
    if (typeof g.showTab === "function" && !g.showTab.__i18n) {
      var raw = g.showTab;
      g.showTab = function (name) {
        raw(name);
        setTimeout(function () { applyPhrases(document.body); }, 20);
        setTimeout(function () { applyPhrases(document.body); }, 250);
      };
      g.showTab.__i18n = 1;
    }
  }
  function watchDom() {
    if (g.__tileLangObs || !document.body) return;
    g.__tileLangObs = new MutationObserver(function () {
      if (g.__tileApplying) return;
      if (g.__tileObsTimer) clearTimeout(g.__tileObsTimer);
      g.__tileObsTimer = setTimeout(function () {
        applyPhrases(document.body);
        hookShowTab();
      }, 40);
    });
    g.__tileLangObs.observe(document.body, { childList: true, subtree: true });
  }

  g.TILE_LANG = { phrase: phrase, applyPhrases: applyPhrases, paint: paint, setLang: setLang };
  g.setTileLang = setLang;
  if (g.I18N) {
    g.I18N.phrase = phrase;
    g.I18N.applyPhrases = applyPhrases;
    var oldApply = g.I18N.apply;
    g.I18N.apply = function () {
      if (typeof oldApply === "function") oldApply.call(g.I18N);
      if (!g.__tileNestedApply) applyPhrases(document.body);
    };
  }
  function boot() {
    bind();
    watchDom();
    hookShowTab();
    paint();
    var n = 0;
    var timer = setInterval(function () {
      n++;
      hookShowTab();
      applyPhrases(document.body);
      paintBar();
      if (n > 120) clearInterval(timer);
    }, 500);
  }
  g.addEventListener("tile-lang-change", function () {
    applyPhrases(document.body);
    paintBar();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
