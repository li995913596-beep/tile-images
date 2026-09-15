/**
 * Overlay: plan outbound must show inventory color.
 * Inventory id = code_color_warehouse
 * v20260915a
 */
(function () {
  function colorFromInvId(id) {
    var parts = String(id || "").split("_");
    if (parts.length < 3) return "";
    return parts.slice(1, parts.length - 1).join("_");
  }
  function paintPreview() {
    var box = document.getElementById("opf_preview");
    if (!box) return;
    box.querySelectorAll("[data-opf-wh]").forEach(function (sel) {
      Array.from(sel.options).forEach(function (opt) {
        var color = colorFromInvId(opt.value);
        if (!color) return;
        if (opt.textContent.indexOf("色") >= 0) return;
        opt.textContent = String(opt.textContent || "").replace("（", " · 色" + color + "（");
      });
      var tr = sel.closest("tr");
      if (!tr || !tr.children || tr.children.length < 3) return;
      var colorTd = tr.children[2];
      var color = colorFromInvId(sel.value);
      if (!color) color = String(colorTd.textContent || "").replace("计划:", "").trim();
      if (!color || color === "-") color = "无色号";
      if (colorTd.getAttribute("data-painted") === color) return;
      colorTd.setAttribute("data-painted", color);
      colorTd.innerHTML = "<span style='display:inline-block;min-width:64px;padding:4px 8px;border-radius:6px;background:#ecfdf5;color:#115e59;font-weight:800;font-size:15px;'>" + color + "</span>";
    });
  }
  function watch() {
    var box = document.getElementById("opf_preview");
    if (box && !box.__opfColorObs) {
      box.__opfColorObs = true;
      new MutationObserver(function () { paintPreview(); }).observe(box, { childList: true, subtree: true });
    }
    paintPreview();
  }
  setInterval(watch, 800);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
  console.log("out_from_plan_fix.js ready v20260915a (show color from inventory id)");
})();
