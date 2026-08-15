/**
 * 出库页增强：常规出库 + 计划识别出库（粘贴出货计划文本）
 * 不替换原有 searchOut / outStock / shipReserve
 */
import { db, auth } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, query, where, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

function esc(s){
  var t = String(s == null ? "" : s);
  var amp = String.fromCharCode(38);
  t = t.split(amp).join(amp + "amp;");
  t = t.split('"').join(amp + "quot;");
  t = t.split("<").join(amp + "lt;");
  t = t.split(">").join(amp + "gt;");
  return t;
}

function reservedTotal(item){
  var list = Array.isArray(item.reservedList) ? item.reservedList : [];
  var t = 0;
  for(var i = 0; i < list.length; i++){
    t += Number((list[i] && list[i].qty) || 0);
  }
  return t;
}

function hasActiveReserve(reservedList){
  if(!reservedList) return false;
  if(Array.isArray(reservedList)) return reservedList.some(function(r){ return r && Number(r.qty || 0) > 0; });
  return false;
}

function parseShipPlanText(text){
  var lines = String(text || "").split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
  var customer = "", pay = "", account = "";
  var items = [];
  var current = null;
  function pushCurrent(){
    if(current && current.code) items.push(current);
    current = null;
  }
  for(var i = 0; i < lines.length; i++){
    var line = lines[i];
    var cm = line.match(/^客户\s*[:：]\s*(.+)$/);
    if(cm){
      var parts = cm[1].split(/[，,、]/).map(function(s){ return s.trim(); }).filter(Boolean);
      if(parts.length) customer = parts[0];
      for(var p = 1; p < parts.length; p++){
        if(/已付款|未付款|部分付款|货到付款/.test(parts[p])) pay = parts[p];
        else if(/公账|私账/.test(parts[p])) account = parts[p];
      }
      continue;
    }
    if(/编号\s*[:：]/.test(line) || /ကုဒ်နိပတ်/.test(line)){
      var codeM = line.match(/编号\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9\-_]*)/);
      if(!codeM) codeM = line.match(/[:：]\s*([A-Za-z0-9][A-Za-z0-9\-_]*)\s*$/);
      if(codeM){
        pushCurrent();
        current = { code: codeM[1].trim(), spec: "", color: "", qty: 0 };
      }
      continue;
    }
    if(!current) continue;
    if(/规格\s*[:：]/.test(line) || /အလျားအနံ/.test(line)){
      var sm = line.match(/规格\s*[:：]\s*(.+)$/);
      if(sm) current.spec = sm[1].trim();
      continue;
    }
    if(/色号/.test(line) || /အရောင်/.test(line)){
      var colM = line.match(/色号\s*[:：]?\s*(.*)$/);
      if(!colM) colM = line.match(/[:：]\s*(.*)$/);
      if(colM) current.color = String(colM[1] || "").trim();
      continue;
    }
    if(/数量\s*[:：]/.test(line) || /အရေအတွက်/.test(line)){
      var qm = line.match(/数量\s*[:：]\s*([\d.]+)/);
      if(!qm) qm = line.match(/([\d.]+)\s*$/);
      if(qm) current.qty = Number(qm[1]) || 0;
      continue;
    }
  }
  pushCurrent();
  return { customer: customer, pay: pay, account: account, items: items };
}

async function findCandidates(code, color){
  var list = [];
  var seen = {};
  var variants = [code, String(code).toUpperCase(), String(code).toLowerCase()];
  var uniq = [];
  variants.forEach(function(v){ if(v && uniq.indexOf(v) < 0) uniq.push(v); });
  for(var i = 0; i < uniq.length; i++){
    try {
      var snap = await getDocs(query(collection(db, "inventory"), where("code", "==", uniq[i])));
      snap.forEach(function(d){
        if(seen[d.id]) return;
        seen[d.id] = true;
        var data = d.data();
        if(data.hidden) return;
        list.push({ id: d.id, data: data });
      });
    } catch(e){ console.error(e); }
  }
  if(!list.length){
    try {
      var all = await getDocs(query(collection(db, "inventory"), limit(2000)));
      var kw = String(code).toLowerCase();
      all.forEach(function(d){
        if(seen[d.id]) return;
        var data = d.data();
        if(data.hidden) return;
        if(String(data.code || "").toLowerCase().indexOf(kw) >= 0){
          seen[d.id] = true;
          list.push({ id: d.id, data: data });
        }
      });
    } catch(e){ console.error(e); }
  }
  var colorKey = String(color == null ? "" : color).trim().toLowerCase();
  var matched = list.filter(function(row){
    var c = String(row.data.color == null ? "" : row.data.color).trim().toLowerCase();
    return c === colorKey;
  });
  return matched.length ? matched : list;
}

var previewRows = [];

function switchOutMode(mode){
  var single = $("outPanelSingle");
  var plan = $("outPanelPlan");
  var b1 = $("outModeSingle");
  var b2 = $("outModePlan");
  if(!single || !plan) return;
  if(mode === "plan"){
    single.style.display = "none";
    plan.style.display = "block";
    if(b1){ b1.style.background = "#eef3f8"; b1.style.color = "#2c3e50"; }
    if(b2){ b2.style.background = "#0f766e"; b2.style.color = "#fff"; }
  } else {
    single.style.display = "block";
    plan.style.display = "none";
    if(b1){ b1.style.background = "#2f7dd1"; b1.style.color = "#fff"; }
    if(b2){ b2.style.background = "#eef3f8"; b2.style.color = "#2c3e50"; }
  }
}

function renderPreview(){
  var box = $("opf_preview");
  if(!box) return;
  if(!previewRows.length){
    box.innerHTML = '<div style="padding:12px;color:#888;font-size:13px;">请先粘贴出货计划并点「识别预览」</div>';
    return;
  }
  var html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:760px;">';
  html += '<thead><tr style="background:#f1f5f9;text-align:left;">' +
    '<th style="padding:8px;">#</th><th style="padding:8px;">编号</th><th style="padding:8px;">色号</th><th style="padding:8px;">计划数</th>' +
    '<th style="padding:8px;">仓库（可选）</th><th style="padding:8px;">库存/留货/可出</th><th style="padding:8px;">出库数</th><th style="padding:8px;">状态</th><th style="padding:8px;"></th></tr></thead><tbody>';
  previewRows.forEach(function(row, idx){
    var bg = row.ok ? "#fff" : "#fef2f2";
    var opts = (row.candidates || []).map(function(c){
      var d = c.data;
      var avail = Math.max(0, Number(d.stock || 0) - reservedTotal(d));
      var selected = c.id === row.invId ? " selected" : "";
      return '<option value="' + esc(c.id) + '"' + selected + '>' + esc(d.warehouse || "-") + "（可出" + avail + "）</option>";
    }).join("");
    var stockInfo = "-";
    if(row.invId && row.candidates){
      var hit = row.candidates.filter(function(c){ return c.id === row.invId; })[0];
      if(hit){
        var st = Number(hit.data.stock || 0), rs = reservedTotal(hit.data), av = Math.max(0, st - rs);
        stockInfo = st + " / " + rs + " / <b style="color:" + (av > 0 ? "#16a34a" : "#ef4444") + ";">" + av + "</b>";
      }
    }
    html += '<tr style="background:' + bg + ';border-bottom:1px solid #f1f5f9;">' +
      '<td style="padding:8px;color:#64748b;">' + (idx + 1) + '</td>' +
      '<td style="padding:8px;font-weight:600;">' + esc(row.plan.code) + '</td>' +
      '<td style="padding:8px;">' + esc(row.plan.color || "-") + '</td>' +
      '<td style="padding:8px;">' + esc(row.plan.qty) + '</td>' +
      '<td style="padding:8px;">' + (row.candidates && row.candidates.length
        ? '<select data-opf-wh="' + idx + '" style="padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;max-width:160px;">' + opts + '</select>'
        : '<span style="color:#b91c1c;">无匹配库存</span>') + '</td>' +
      '<td style="padding:8px;font-size:12px;">' + stockInfo + '</td>' +
      '<td style="padding:8px;"><input data-opf-qty="' + idx + '" type="number" step="0.01" min="0" value="' + esc(row.qty) +
        '" style="width:80px;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;"' + (row.ok ? "" : " disabled") + '></td>' +
      '<td style="padding:8px;font-size:12px;color:' + (row.ok ? "#16a34a" : "#b91c1c") + ';">' + esc(row.error || "可出") + '</td>' +
      '<td style="padding:8px;"><button type="button" data-opf-del="' + idx + '" style="padding:4px 10px;border:1px solid #fecaca;background:#fee2e2;color:#b91c1c;border-radius:6px;cursor:pointer;font-size:12px;">删</button></td></tr>';
  });
  html += '</tbody></table></div>';
  box.innerHTML = html;
  box.querySelectorAll('[data-opf-wh]').forEach(function(sel){
    sel.onchange = function(){
      var i = Number(sel.getAttribute('data-opf-wh'));
      var row = previewRows[i]; if(!row) return;
      row.invId = sel.value;
      var hit = (row.candidates || []).filter(function(c){ return c.id === row.invId; })[0];
      if(hit){
        var av = Math.max(0, Number(hit.data.stock || 0) - reservedTotal(hit.data));
        if(row.qty > av) row.qty = av;
        row.ok = av > 0 && row.qty > 0;
        row.error = row.ok ? "" : (av <= 0 ? "可出为 0" : "超过可出");
      }
      renderPreview();
    };
  });
  box.querySelectorAll('[data-opf-qty]').forEach(function(inp){
    inp.onchange = inp.onblur = function(){
      var i = Number(inp.getAttribute('data-opf-qty'));
      var row = previewRows[i]; if(!row) return;
      var hit = (row.candidates || []).filter(function(c){ return c.id === row.invId; })[0];
      if(!hit) return;
      var av = Math.max(0, Number(hit.data.stock || 0) - reservedTotal(hit.data));
      var q = Number(inp.value) || 0;
      if(q > av){ alert('不能超过可出 ' + av); q = av; }
      if(q < 0) q = 0;
      row.qty = q; row.ok = q > 0 && av > 0; row.error = q <= 0 ? '数量需大于 0' : '';
      renderPreview();
    };
  });
  box.querySelectorAll('[data-opf-del]').forEach(function(btn){
    btn.onclick = function(){
      previewRows.splice(Number(btn.getAttribute('data-opf-del')), 1);
      renderPreview();
    };
  });
}

window.opfParsePreview = async function(){
  if(!auth.currentUser) return alert('请先登录');
  var text = (($('opf_text') && $('opf_text').value) || '').trim();
  if(!text) return alert('请先粘贴出货计划文本');
  var parsed = parseShipPlanText(text);
  if(!parsed.items.length) return alert('没有识别到瓷砖明细，请确认粘贴的是完整出货计划');
  if($('opf_customer')) $('opf_customer').value = parsed.customer || '';
  if($('opf_pay')) $('opf_pay').value = parsed.pay || '';
  if($('opf_account')) $('opf_account').value = parsed.account || '';
  var box = $('opf_preview');
  if(box) box.innerHTML = '<div style="padding:12px;color:#666;">识别中，匹配库存…</div>';
  previewRows = [];
  for(var i = 0; i < parsed.items.length; i++){
    var it = parsed.items[i];
    var candidates = await findCandidates(it.code, it.color);
    var row = { plan: it, candidates: candidates, invId: '', qty: Number(it.qty) || 0, ok: false, error: '' };
    if(!candidates.length){
      row.error = '库存无此编号/色号'; row.ok = false;
    } else {
      candidates.sort(function(a, b){
        return Math.max(0, Number(b.data.stock||0)-reservedTotal(b.data)) - Math.max(0, Number(a.data.stock||0)-reservedTotal(a.data));
      });
      row.invId = candidates[0].id; row.candidates = candidates;
      var av = Math.max(0, Number(candidates[0].data.stock||0) - reservedTotal(candidates[0].data));
      if(av <= 0){ row.ok = false; row.error = '可出为 0（可能全被留货）'; row.qty = 0; }
      else { if(row.qty > av) row.qty = av; row.ok = row.qty > 0; row.error = row.ok ? '' : '数量无效'; }
    }
    previewRows.push(row);
  }
  renderPreview();
  var okN = previewRows.filter(function(r){ return r.ok; }).length;
  alert('识别完成：共 ' + previewRows.length + ' 行，可出 ' + okN + ' 行' + (previewRows.length-okN ? '，异常 ' + (previewRows.length-okN) + ' 行（红底，可删）' : ''));
};

window.opfConfirmOut = async function(){
  if(!auth.currentUser) return alert('请先登录');
  var customer = (($('opf_customer') && $('opf_customer').value) || '').trim();
  var pay = (($('opf_pay') && $('opf_pay').value) || '').trim();
  var account = (($('opf_account') && $('opf_account').value) || '').trim();
  var logCustomer = [customer, pay, account].filter(Boolean).join('，');
  if($('opf_preview')){
    $('opf_preview').querySelectorAll('[data-opf-qty]').forEach(function(inp){
      var i = Number(inp.getAttribute('data-opf-qty'));
      if(previewRows[i]) previewRows[i].qty = Number(inp.value) || 0;
    });
  }
  var lines = previewRows.filter(function(r){ return r.ok && r.invId && r.qty > 0; });
  if(!lines.length) return alert('没有可出库的行');
  var summary = [];
  for(var i = 0; i < lines.length; i++){
    var r = lines[i];
    var snap = await getDoc(doc(db, 'inventory', r.invId));
    if(!snap.exists()) return alert('第 ' + (i+1) + ' 行库存已不存在，请重新识别');
    var data = snap.data();
    var av = Math.max(0, Number(data.stock||0) - reservedTotal(data));
    if(r.qty > av) return alert(data.code + ' 可出仅 ' + av + '，请改小数量');
    summary.push((i+1) + '. ' + data.code + ' 色' + (data.color||'-') + ' @' + data.warehouse + ' × ' + r.qty);
  }
  if(!confirm('确认按计划出库？\n客户：' + (logCustomer||'未填') + '\n共 ' + lines.length + ' 行\n\n' + summary.join('\n'))) return;
  var btn = $('opf_btn_confirm');
  if(btn){ btn.disabled = true; btn.textContent = '出库中…'; }
  var ok = 0, fail = [];
  try {
    for(var j = 0; j < lines.length; j++){
      var L = lines[j];
      try {
        var ref = doc(db, 'inventory', L.invId);
        var s2 = await getDoc(ref);
        if(!s2.exists()){ fail.push(L.plan.code + ': 已不存在'); continue; }
        var data = s2.data();
        var av = Math.max(0, Number(data.stock||0) - reservedTotal(data));
        var qty = Number(L.qty) || 0;
        if(qty <= 0 || qty > av || qty > Number(data.stock||0)){ fail.push(L.plan.code + ': 可出不足'); continue; }
        var newStock = Number((Number(data.stock||0) - qty).toFixed(4));
        if(newStock <= 0 && !hasActiveReserve(data.reservedList)) await deleteDoc(ref);
        else await updateDoc(ref, { stock: newStock, lastUpdate: serverTimestamp() });
        await addDoc(collection(db, 'logs'), {
          timestamp: serverTimestamp(), type: '出库', code: data.code, spec: data.spec||'', color: data.color||'',
          warehouse: data.warehouse||'', qty: qty, customer: logCustomer||''
        });
        ok++;
      } catch(err){
        console.error(err);
        fail.push(L.plan.code + ': ' + ((err && err.message) || err));
      }
    }
    alert('出库完成：成功 ' + ok + ' 行' + (fail.length ? '\n失败：\n' + fail.join('\n') : ''));
    if(ok){ previewRows = []; renderPreview(); if($('opf_text')) $('opf_text').value = ''; }
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = '确认出库'; }
  }
};

function buildPlanPanelHtml(){
  return '<div style="padding:14px;border-radius:12px;background:#f0fdfa;border:1px solid #99f6e4;margin-bottom:12px;">' +
    '<div style="font-size:13px;color:#0f766e;margin-bottom:10px;line-height:1.5;">把「出货计划」页生成的整段文字粘贴到下方 -> 识别客户/付款/账户和明细 -> 每行可选仓库 -> 确认后批量出库（只扣可售库存，不动留货）。</div>' +
    '<textarea id="opf_text" rows="10" placeholder="在此粘贴出货计划全文…" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:13px;line-height:1.45;font-family:ui-monospace,monospace;resize:vertical;"></textarea>' +
    '<div style="margin-top:10px;"><button type="button" id="opf_btn_parse" style="padding:8px 16px;border:none;border-radius:8px;background:#0f766e;color:#fff;cursor:pointer;font-weight:600;">识别预览</button></div></div>' +
    '<div style="padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:12px;">' +
    '<div style="font-weight:600;margin-bottom:10px;color:#1f2937;font-size:14px;">出库信息（可改）</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">' +
    '<label style="font-size:13px;">客户 <input id="opf_customer" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;min-width:140px;"></label>' +
    '<label style="font-size:13px;">付款 <input id="opf_pay" placeholder="已付款/未付款" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;width:110px;"></label>' +
    '<label style="font-size:13px;">账户 <input id="opf_account" placeholder="公账/私账" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;width:100px;"></label></div></div>' +
    '<div style="padding:14px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;margin-bottom:12px;">' +
    '<div style="font-weight:600;margin-bottom:8px;color:#1f2937;font-size:14px;">明细预览</div>' +
    '<div id="opf_preview"><div style="padding:8px;color:#888;font-size:13px;">识别后显示</div></div></div>' +
    '<button type="button" id="opf_btn_confirm" style="padding:10px 20px;border:none;border-radius:8px;background:#e67e22;color:#fff;cursor:pointer;font-weight:600;">确认出库</button>';
}

function needsOutEnhance(){
  return !!$('tab_out') && !$('outModePlan');
}

function enhanceOutTab(){
  var tab = $('tab_out');
  if(!tab) return false;
  if(!needsOutEnhance() && $('outPanelSingle') && $('out_search')) return true;
  tab.innerHTML =
    '<h3 style="margin:0 0 12px;font-size:16px;color:#1f2937;">出库</h3>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">' +
    '<button type="button" id="outModeSingle" style="padding:8px 16px;border:none;border-radius:8px;background:#2f7dd1;color:#fff;cursor:pointer;font-weight:600;">常规出库</button>' +
    '<button type="button" id="outModePlan" style="padding:8px 16px;border:none;border-radius:8px;background:#eef3f8;color:#2c3e50;cursor:pointer;font-weight:600;">计划出库</button></div>' +
    '<div id="outPanelSingle">' +
    '<div style="font-size:13px;color:#666;margin-bottom:10px;">搜索编号，逐条出库；支持从留货出库。</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center;">' +
    '<input id="out_search" placeholder="搜索编号 / 规格" style="flex:1;min-width:160px;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;">' +
    '<button type="button" onclick="searchOut()" style="padding:8px 16px;border:none;border-radius:8px;background:#e67e22;color:#fff;cursor:pointer;font-weight:600;">搜索</button></div>' +
    '<div id="out_result"></div></div>' +
    '<div id="outPanelPlan" style="display:none;">' + buildPlanPanelHtml() + '</div>';
  tab.dataset.opfEnhanced = '1';
  var b1 = $('outModeSingle'), b2 = $('outModePlan');
  if(b1) b1.onclick = function(){ switchOutMode('single'); };
  if(b2) b2.onclick = function(){ switchOutMode('plan'); };
  var bp = $('opf_btn_parse'); if(bp) bp.onclick = function(){ window.opfParsePreview(); };
  var bc = $('opf_btn_confirm'); if(bc) bc.onclick = function(){ window.opfConfirmOut(); };
  var searchInput = $('out_search');
  if(searchInput && !searchInput.__opfEnter){
    searchInput.__opfEnter = true;
    searchInput.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); if(typeof window.searchOut === 'function') window.searchOut(); }
    });
  }
  return true;
}

function hookShowTab(){
  if(typeof window.showTab !== 'function') return false;
  if(window.showTab.__opfHooked) return true;
  var orig = window.showTab;
  window.showTab = function(name){
    orig.apply(this, arguments);
    if(name === 'out'){
      setTimeout(enhanceOutTab, 0);
      setTimeout(enhanceOutTab, 150);
      setTimeout(enhanceOutTab, 400);
    }
  };
  window.showTab.__opfHooked = true;
  return true;
}

function boot(){
  hookShowTab();
  setInterval(function(){
    hookShowTab();
    if(needsOutEnhance()) enhanceOutTab();
  }, 500);
  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t) return;
    var btn = t.closest ? t.closest('button') : null;
    if(btn && /出库/.test(btn.textContent || '') && !/计划|确认|常规/.test(btn.textContent || '')){
      setTimeout(enhanceOutTab, 50);
      setTimeout(enhanceOutTab, 300);
    }
  }, true);
  console.log('out_from_plan.js ready v20260815b');
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
