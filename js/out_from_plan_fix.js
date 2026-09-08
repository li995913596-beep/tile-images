/**
 * Overlay on out_from_plan.js — fuzzy helpers + reserve-out customer field. v20260908c
 */
(function () {
  function normCode(s) {
    return String(s == null ? "" : s).trim().toUpperCase().replace(/[\s\-_.]/g, "");
  }
  function codeCore(s) {
    var n = normCode(s);
    var stripped = n.replace(/[A-Z]+$/, "");
    return stripped || n;
  }
  function codesLooseEqual(a, b) {
    var A = normCode(a), B = normCode(b);
    if (!A || !B) return false;
    if (A === B) return true;
    var ca = codeCore(a), cb = codeCore(b);
    if (ca && cb && ca === cb) return true;
    if (A.indexOf(B) === 0 || B.indexOf(A) === 0) {
      var longer = A.length >= B.length ? A : B;
      var shorter = A.length >= B.length ? B : A;
      var rest = longer.slice(shorter.length);
      if (/^[A-Z]{1,2}$/.test(rest)) return true;
    }
    return false;
  }
  function codeMatchScore(planCode, invCode) {
    var A = normCode(planCode), B = normCode(invCode);
    if (!A || !B) return 0;
    if (A === B) return 100;
    if (codesLooseEqual(planCode, invCode)) return 80;
    if (B.indexOf(A) === 0 || A.indexOf(B) === 0) return 60;
    if (B.indexOf(A) >= 0 || A.indexOf(B) >= 0) return 40;
    return 0;
  }
  function cleanTok(s) {
    return String(s || "").replace(/[。．.、，,\s]+$/g, "").replace(/^[。．.、，,\s]+/g, "").trim();
  }
  function classifyPayAccount(tok) {
    var t = cleanTok(tok);
    if (!t) return null;
    if (/已付款|已经付款|已付完|付清/.test(t)) return { pay: "已付款" };
    if (/未付款|没付款|尚未付款/.test(t)) return { pay: "未付款" };
    if (/部分付款|已付定金|定金/.test(t)) return { pay: "部分付款" };
    if (/货到付款|到付/.test(t)) return { pay: "货到付款" };
    if (/^(已付|付了)$/.test(t)) return { pay: "已付款" };
    if (/^(未付|没付)$/.test(t)) return { pay: "未付款" };
    if (/开票|发票|要票|对公|公账|公司账/.test(t)) return { account: "公账" };
    if (/对私|私账|个人账|现金$/.test(t)) return { account: "私账" };
    return null;
  }
  function parseCustomerBlob(raw) {
    var s = String(raw || "").replace(/^客户\s*[:：]?\s*/, "");
    var parts = s.split(/[，,、；;\/|]/).map(cleanTok).filter(Boolean);
    var customer = "", pay = "", account = "";
    var nameParts = [];
    for (var i = 0; i < parts.length; i++) {
      var tagged = classifyPayAccount(parts[i]);
      if (tagged && tagged.pay) { pay = tagged.pay; continue; }
      if (tagged && tagged.account) { account = tagged.account; continue; }
      nameParts.push(parts[i]);
    }
    customer = nameParts.join("").trim() ? nameParts.join(" ") : "";
    return { customer: customer, pay: pay, account: account };
  }
  window.__tileNormCode = normCode;
  window.__tileCodesLooseEqual = codesLooseEqual;
  window.__tileCodeMatchScore = codeMatchScore;
  window.__tileParseCustomerBlob = parseCustomerBlob;
  function enhanceReserveCustomerInputs() {
    var box = document.getElementById("out_result");
    if (!box) return;
    box.querySelectorAll("button[onclick*='shipReserve']").forEach(function (btn) {
      var m = String(btn.getAttribute("onclick") || "").match(/shipReserve\('([^']+)',\s*(\d+)\)/);
      if (!m) return;
      var id = m[1], index = m[2];
      var inpId = "ship_c_" + id + "_" + index;
      if (document.getElementById(inpId)) return;
      var wrap = btn.parentNode;
      if (!wrap) return;
      var label = document.createElement("span");
      label.style.cssText = "font-size:12px;color:#64748b;";
      label.textContent = "出给";
      var inp = document.createElement("input");
      inp.id = inpId;
      inp.placeholder = "实际客户（可改）";
      inp.style.cssText = "width:120px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;";
      wrap.insertBefore(inp, btn);
      wrap.insertBefore(label, inp);
    });
  }
  setInterval(enhanceReserveCustomerInputs, 1200);
  console.log("out_from_plan_fix.js ready v20260908c");
})();
