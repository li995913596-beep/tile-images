/**
 * 前台查询口令。知道网址也不够，要口令。
 * 改 PIN 只改下面这一行。
 */
var TILE_QUERY_PIN = "1688";
(function(){
  if(localStorage.getItem("tile_query_ok") === "1") return;
  var box = document.createElement("div");
  box.style.cssText = "position:fixed;inset:0;background:#0f172a;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;";
  box.innerHTML = "<div style='width:100%;max-width:320px;background:#fff;border-radius:16px;padding:22px;'>" +
    "<div style='font-size:18px;font-weight:700;margin-bottom:6px;'>库存查询</div>" +
    "<div style='font-size:13px;color:#64748b;margin-bottom:14px;'>请输入查询口令</div>" +
    "<input id='tile_pin' type='password' inputmode='numeric' placeholder='口令' style='width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:16px;'>" +
    "<button id='tile_pin_btn' type='button' style='margin-top:12px;width:100%;padding:10px;border:none;border-radius:10px;background:#0f766e;color:#fff;font-weight:700;'>进入</button>" +
    "<div id='tile_pin_err' style='margin-top:8px;color:#b91c1c;font-size:13px;'></div></div>";
  document.body.appendChild(box);
  function tryIn(){
    var v = (document.getElementById("tile_pin").value || "").trim();
    if(v === TILE_QUERY_PIN){
      localStorage.setItem("tile_query_ok", "1");
      box.remove();
    } else {
      document.getElementById("tile_pin_err").textContent = "口令不对";
    }
  }
  document.getElementById("tile_pin_btn").onclick = tryIn;
  document.getElementById("tile_pin").addEventListener("keydown", function(e){ if(e.key === "Enter") tryIn(); });
  setTimeout(function(){ var el = document.getElementById("tile_pin"); if(el) el.focus(); }, 50);
})();
