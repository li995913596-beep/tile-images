/**
 * Bind language bar + translate leftover Chinese in JS-rendered admin/front UI.
 * Works even when i18n.js is an older build that skipped #langSwitch.
 * v20260902g
 */
(function (g) {
  var P = {
    "入库 / 修改信息": { en: "Inbound / edit info", th: "รับเข้า / แก้ไขข้อมูล" },
    "搜索后可直接改编号、规格、色号、仓库。改编号/色号/仓库会自动换记录，库存和留货保留。": { en: "Search, then edit code, size, color, warehouse. Changing code/color/warehouse moves the record; stock and reserves stay.", th: "ค้นแล้วแก้รหัส ขนาด สี คลังได้ เปลี่ยนรหัส/สี/คลังจะย้ายรายการ สต็อกและของจองยังอยู่" },
    "搜索编号": { en: "Search code", th: "ค้นหารหัส" },
    "搜索": { en: "Search", th: "ค้นหา" },
    "新增库存": { en: "Add stock", th: "เพิ่มสต็อก" },
    "编号": { en: "Code", th: "รหัส" },
    "规格": { en: "Size", th: "ขนาด" },
    "色号": { en: "Color", th: "สี" },
    "仓库": { en: "Warehouse", th: "คลัง" },
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
    "新增库存": { en: "Add stock", th: "เพิ่มสต็อก" },
    "搜索编号": { en: "Search code", th: "ค้นหารหัส" },
    "编号": { en: "Code", th: "รหัส" },
    "规格": { en: "Size", th: "ขนาด" },
    "色号": { en: "Color", th: "สี" },
    "仓库": { en: "Warehouse", th: "คลัง" },
    "新增": { en: "Add", th: "เพิ่ม" },
    "登录成功": { en: "Signed in", th: "เข้าสู่ระบบสำเร็จ" },
    "登录失败": { en: "Sign-in failed", th: "เข้าสู่ระบบไม่สำเร็จ" },
    "修改信息（编号/色号/仓库改了会自动换记录）": { en: "Edit info (changing code/color/warehouse moves the record)", th: "แก้ไขข้อมูล (เปลี่ยนรหัส/สี/คลังจะย้ายรายการ)" },
    "可售库存出库：": { en: "Outbound from free stock:", th: "เบิกจากสต็อกพร้อมขาย：" },
    "从留货出库（可改数量）：": { en: "Outbound from reserve (qty editable):", th: "เบิกจากของจอง (แก้จำนวนได้)：" },
    "从留货出库": { en: "From reserve", th: "เบิกจากของจอง" },
    "留货清单": { en: "Reserve list", th: "รายการจอง" },
    "导出留货信息": { en: "Export reserves", th: "ส่งออกของจอง" },
    "取消留货": { en: "Cancel reserve", th: "ยกเลิกการจอง" },
    "下载CSV": { en: "Download CSV", th: "ดาวน์โหลด CSV" },
    "暂无数据": { en: "No data", th: "ไม่มีข้อมูล" },
    "卖货分析（出库排行）": { en: "Sales analysis (outbound rank)", th: "วิเคราะห์ยอดเบิก" },
    "今天": { en: "Today", th: "วันนี้" },
    "本周": { en: "This week", th: "สัปดาห์นี้" },
    "本月": { en: "This month", th: "เดือนนี้" },
    "本年": { en: "This year", th: "ปีนี้" },
    "或": { en: "or", th: "หรือ" },
    "全部仓库": { en: "All warehouses", th: "ทุกคลัง" },
    "管理员登录": { en: "Admin login", th: "เข้าสู่ระบบแอดมิน" },
    "库存管理后台": { en: "Inventory Admin", th: "หลังบ้านคลังสินค้า" },
    "邮箱": { en: "Email", th: "อีเมล" },
    "密码": { en: "Password", th: "รหัสผ่าน" },
    "登录": { en: "Sign in", th: "เข้าสู่ระบบ" },
    "查询": { en: "Search", th: "ค้นหา" },
    "刷新": { en: "Refresh", th: "รีเฟรช" },
    "搜索": { en: "Search", th: "ค้นหา" }
  };

  function lang() {
    if (g.I18N && g.I18N.getLang) return g.I18N.getLang();
    try {
      var v = localStorage.getItem("tile_lang");
      if (v === "en" || v === "th" || v === "zh") return v;
    } catch (e) {}
    return "zh";
  }
  function phrase(zh) {
    if (zh == null) return zh;
    var s = String(zh);
    var L = lang();
    if (L === "zh") return s;
    var hit = P[s];
    if (hit) return L === "en" ? (hit.en || s) : (hit.th || s);
    return s;
  }
  function applyPhrases(root) {
    root = root || document.body;
    if (!root) return;
    var nodes = root.querySelectorAll("h1,h2,h3,h4,p,div,span,button,label,th,td,option,a,legend");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.id === "langSwitch" || (el.closest && el.closest("#langSwitch"))) continue;
      if (el.getAttribute && el.getAttribute("data-i18n")) continue;
      if (el.children && el.children.length) continue;
      var cur = (el.textContent || "").trim();
      if (!cur) continue;
      var orig = el.getAttribute("data-i18n-src");
      if (!orig) {
        if (!/[\u4e00-\u9fff]/.test(cur)) continue;
        orig = cur;
        el.setAttribute("data-i18n-src", orig);
      } else if (/[\u4e00-\u9fff]/.test(cur) && P[cur]) {
        orig = cur;
        el.setAttribute("data-i18n-src", orig);
      }
      var next = phrase(orig);
      if (next && el.textContent.trim() !== next) el.textContent = next;
    }
    var phs = root.querySelectorAll("input[placeholder],textarea[placeholder]");
    for (var j = 0; j < phs.length; j++) {
      var inp = phs[j];
      if (inp.getAttribute("data-i18n-placeholder")) continue;
      var src = inp.getAttribute("data-i18n-ph-src");
      var po = inp.getAttribute("placeholder") || "";
      if (!src) {
        if (!/[\u4e00-\u9fff]/.test(po)) continue;
        src = po;
        inp.setAttribute("data-i18n-ph-src", src);
      } else if (/[\u4e00-\u9fff]/.test(po) && P[po]) {
        src = po;
        inp.setAttribute("data-i18n-ph-src", src);
      }
      inp.setAttribute("placeholder", phrase(src));
    }
  }
  function paint() {
    if (g.I18N && g.I18N.apply) g.I18N.apply();
    applyPhrases(document.body);
    var bar = document.getElementById("langSwitch");
    if (!bar) return;
    var cur = lang();
    bar.querySelectorAll("button[data-lang]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === cur);
    });
  }
  function setLang(code) {
    if (code !== "zh" && code !== "en" && code !== "th") return;
    if (g.I18N && g.I18N.setLang) g.I18N.setLang(code);
    else {
      try { localStorage.setItem("tile_lang", code); } catch (e) {}
      try { document.cookie = "tile_lang=" + code + ";path=/;max-age=31536000;SameSite=Lax"; } catch (e) {}
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
  g.TILE_LANG = { phrase: phrase, applyPhrases: applyPhrases, paint: paint, setLang: setLang };
  if (g.I18N) {
    g.I18N.phrase = phrase;
    var oldApply = g.I18N.apply;
    g.I18N.apply = function () { oldApply(); applyPhrases(document.body); };
    g.I18N.applyPhrases = applyPhrases;
  }
  function boot() {
    bind();
    paint();
    var n = 0;
    var timer = setInterval(function () {
      n++;
      paint();
      if (n > 20) clearInterval(timer);
    }, 400);
  }
  g.addEventListener("tile-lang-change", function () { applyPhrases(document.body); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
