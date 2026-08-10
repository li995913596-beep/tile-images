/**
 * 后台在途管理 — 加载稳定版逻辑，并使用 transit_status 的渲染（含整票/整柜改状态）
 */
import "https://cdn.jsdelivr.net/gh/li995913596-beep/tile-images@a7bada2d9e9882e0960eca890472bc2faa534503/js/transit_admin.js";

// 覆盖渲染为带批量状态的版本
import { renderAdminList } from "./transit_status.js?v=20260810a";
window.renderAdminList = renderAdminList;

// 重新绑定刷新，确保用新的 renderAdminList
const _origReload = window.reloadTransitAdmin;
window.reloadTransitAdmin = async function(){
  if(typeof _origReload === "function"){
    // 临时替换 renderAdminList 已在 window 上
    return _origReload();
  }
};

console.log("transit_admin.js wrapper ready");
