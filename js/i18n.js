/** translation removed — Chinese only stub so existing tt() calls keep working */
(function(g){
  try { localStorage.removeItem("tile_lang"); } catch (e) {}
  try { document.cookie = "tile_lang=; Max-Age=0; path=/"; } catch (e) {}

  var ZH = {
    "title.stock":"库存查询","title.transit":"在途货物","title.ship":"出货计划",
    "title.boxes":"纸箱库存","title.grout":"美缝剂库存","title.report":"出库排行",
    "nav.stock":"库存","nav.transit":"在途","nav.ship":"出货","nav.boxes":"纸箱",
    "nav.grout":"美缝","nav.report":"看板","nav.admin":"设置",
    "btn.search":"查询","btn.refresh":"刷新","btn.showAll":"显示全部",
    "ph.searchCodeSpec":"输入编号或规格，如 3609, 300x600",
    "ph.searchTransit":"搜索编号 / 柜号 / 提单号",
    "h.transit":"在途货物","h.ship":"出货计划","h.boxes":"纸箱库存",
    "h.grout":"美缝剂库存","h.report":"出库排行（老板看板）",
    "tip.transit":"数据由管理员手动更新；若更新时间超过 1 周，信息可能不准确，请询问管理员。",
    "opt.active":"在途 + 已到港","opt.inTransit":"仅在途","opt.arrived":"仅已到港",
    "opt.history":"历史（已入库/取消）","opt.all":"全部",
    "col.image":"图片","col.code":"编号","col.model":"型号","col.spec":"规格","col.color":"色号",
    "col.stock":"库存","col.reserve":"留货","col.warehouse":"仓库",
    "col.container":"柜号","col.qty":"数量","col.status":"状态","col.remark":"备注","col.booked":"预定",
    "status.inTransit":"在途","status.arrived":"已到港","status.inbound":"已入库","status.cancelled":"取消",
    "msg.needKeyword":"请输入编号或规格","msg.searching":"搜索中…","msg.firstLoad":"首次加载库存数据，稍候…",
    "msg.searchFail":"搜索失败，请稍后重试","msg.notFound":"未找到库存",
    "msg.refreshing":"正在从服务器刷新库存…","msg.refreshed":"库存已刷新（共 {n} 条），请重新搜索",
    "msg.refreshFail":"刷新失败","msg.loading":"加载中…","msg.loadFail":"加载失败",
    "msg.noTransit":"暂无在途数据","msg.noData":"暂无数据",
    "reserve.none":"留货 0","reserve.has":"留货 {n}","reserve.customer":"客户：","reserve.unknown":"未填客户",
    "banner.overdueTitle":"⚠ 有 {n} 笔留货已超过 30 天，请联系管理员",
    "banner.overdueItem":"（已留 {days} 天）","banner.more":"…还有 {n} 笔",
    "pack.pcsBox":"{n}片/箱",
    "transit.bl":"提单","transit.noBl":"(无提单号)","transit.hint":"共 {g} 个提单，{n} 行",
    "transit.meta":"{c} 柜 · {n} 行","transit.eta":"预计到港：","transit.updated":"更新：",
    "transit.stale":"⚠️ 部分在途数据上次更新已超过 {days} 天，请联系管理员确认最新装柜/到港情况。",
    "report.today":"今天","report.week":"本周","report.month":"本月","report.year":"本年",
    "report.or":"或","report.wh":"仓库","report.allWh":"全部仓库",
    "report.bar":"出库 Top 15（柱状图）","report.pie":"Top 10 占比（饼图）","report.sort":"排名排序：",
    "report.sortQty":"按出库数量","report.sortCount":"按出库次数","report.rank":"排名",
    "report.outQty":"出库总量","report.outCount":"出库次数","report.hint":"此页面无需登录，仅供查看",
    "report.needDate":"请选择开始和结束日期",
    "report.summary":"共 {orders} 笔出库{wh}，总量 {qty}，涉及 {codes} 个编号",
    "report.empty":"该时间段没有出库记录{wh}","report.whTag":"（仓库 {w}）","report.chartQty":"出库数量"
  };
  function fill(s, vars){
    if(!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function(_,k){ return vars[k]==null?"":vars[k]; });
  }
  function t(key, vars){ return fill(ZH[key] || key, vars); }
  function statusLabel(st){
    if(st==="已到港") return "已到港";
    if(st==="已入库") return "已入库";
    if(st==="取消") return "取消";
    return "在途";
  }
  g.I18N = { t:t, pick:function(zh){ return zh; }, getLang:function(){ return "zh"; }, setLang:function(){}, apply:function(){}, applyPhrases:function(){}, statusLabel:statusLabel };
  g.t = t;
})(window);
