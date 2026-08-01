/**
 * 文件页：上传/替换图片到 GitHub
 * 入库页：删除错误库存记录
 */
import { auth, db } from "./firebase.js";
import { doc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const GH_OWNER = "li995913596-beep";
const GH_REPO = "tile-images";
const GH_BRANCH = "main";
const TOKEN_KEY = "tile_gh_token";

function $(id){ return document.getElementById(id); }

function getToken(){
  try { return (localStorage.getItem(TOKEN_KEY) || "").trim(); } catch(e){ return ""; }
}
function setToken(t){
  try { localStorage.setItem(TOKEN_KEY, (t || "").trim()); } catch(e){}
}

function bindFilesUI(){
  const input = $("gh_token_input");
  const save = $("gh_token_save");
  const clear = $("gh_token_clear");
  const btn = $("gh_img_upload_btn");

  if(input && getToken()) input.placeholder = "已保存 Token（更换请重新粘贴）";

  if(save && !save.__bound){
    save.__bound = true;
    save.onclick = function(){
      const v = (input && input.value || "").trim();
      if(!v) return alert("请先粘贴 Token");
      setToken(v);
      if(input){ input.value = ""; input.placeholder = "已保存 Token（更换请重新粘贴）"; }
      alert("Token 已保存");
    };
  }
  if(clear && !clear.__bound){
    clear.__bound = true;
    clear.onclick = function(){
      setToken("");
      if(input){ input.value = ""; input.placeholder = "粘贴 GitHub Token"; }
      alert("已清除");
    };
  }
  if(btn && !btn.__bound){
    btn.__bound = true;
    btn.onclick = function(){
      const code = (($("gh_img_code") && $("gh_img_code").value) || "").trim();
      window.uploadTileImage(code, "gh_img_file");
    };
  }
}

async function fileToJpegBlob(file){
  if((file.type === "image/jpeg" || file.type === "image/jpg") && file.size <= 2 * 1024 * 1024){
    return file;
  }
  return await new Promise(function(resolve, reject){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function(){
      try {
        const canvas = document.createElement("canvas");
        const maxW = 1600;
        let w = img.width, h = img.height;
        if(w > maxW){ h = Math.round(h * maxW / w); w = maxW; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(b){
          URL.revokeObjectURL(url);
          if(b) resolve(b); else reject(new Error("图片转换失败"));
        }, "image/jpeg", 0.85);
      } catch(err){
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error("图片读取失败")); };
    img.src = url;
  });
}

function blobToBase64(blob){
  return new Promise(function(resolve, reject){
    const reader = new FileReader();
    reader.onload = function(){
      const s = String(reader.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function githubGetSha(path, token){
  const encPath = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch("https://api.github.com/repos/" + GH_OWNER + "/" + GH_REPO + "/contents/" + encPath + "?ref=" + GH_BRANCH, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if(res.status === 404) return null;
  if(!res.ok){
    const t = await res.text();
    throw new Error("读取失败：" + res.status + " " + t.slice(0, 200));
  }
  const data = await res.json();
  return data.sha || null;
}

async function githubPutFile(path, base64Content, token, message){
  const sha = await githubGetSha(path, token);
  const body = {
    message: message || ("upload " + path),
    content: base64Content,
    branch: GH_BRANCH
  };
  if(sha) body.sha = sha;
  const encPath = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch("https://api.github.com/repos/" + GH_OWNER + "/" + GH_REPO + "/contents/" + encPath, {
    method: "PUT",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify(body)
  });
  if(!res.ok){
    const t = await res.text();
    throw new Error("上传失败：" + res.status + " " + t.slice(0, 300));
  }
  return { replaced: !!sha };
}

window.uploadTileImage = async function(code, fileInputId){
  const status = $("gh_img_status");
  try{
    if(!auth.currentUser) return alert("请先登录后台");
    code = (code || "").trim().replace(/\.jpe?g$/i, "");
    if(!code) return alert("请填写瓷砖编号");
    const token = getToken();
    if(!token) return alert("请先保存 GitHub Token");
    const fileEl = $(fileInputId);
    if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("请先选择图片");
    const file = fileEl.files[0];
    if(!file.type || !file.type.startsWith("image/")) return alert("请选择图片文件");
    if(file.size > 20 * 1024 * 1024) return alert("原图太大（>20MB），请先压缩");

    const path = "images/" + code + ".jpg";
    if(!confirm("确认上传/替换？\n编号：" + code + "\n路径：" + path + "\n已有同名图会被覆盖")) return;

    if(status) status.textContent = "压缩中…";
    const blob = await fileToJpegBlob(file);
    if(blob.size > 8 * 1024 * 1024) {
      if(status) status.textContent = "";
      return alert("压缩后仍超过 8MB，请用更小的图");
    }
    if(status) status.textContent = "上传中…（" + Math.round(blob.size/1024) + " KB）";
    const b64 = await blobToBase64(blob);
    const result = await githubPutFile(path, b64, token, "upload image " + code + ".jpg");
    const tip = result.replaced ? "已替换原有图片" : "已新增图片";
    if(status) status.textContent = "成功：" + tip + " → " + path;
    alert("成功！\n" + tip + "\n" + path + "\n约 1 分钟后强制刷新前台即可看到");
  }catch(e){
    console.error(e);
    if(status) status.textContent = "失败";
    const msg = (e && e.message) ? e.message : String(e);
    if(/401|Bad credentials|Requires authentication/i.test(msg)){
      alert("Token 无效或过期，请重新生成并保存");
    } else if(/403|resource not accessible|Permission/i.test(msg)){
      alert("Token 权限不足：请给 tile-images 仓库 Contents Read and write");
    } else {
      alert(msg);
    }
  }
};

/** 删除错误入库的库存记录 */
window.deleteInventoryItem = async function(id){
  try{
    if(!auth.currentUser) return alert("请先登录后台");
    if(!id) return alert("记录无效");
    const ref = doc(db, "inventory", id);
    const snap = await getDoc(ref);
    if(!snap.exists()) return alert("记录不存在，可能已删除");
    const data = snap.data() || {};
    const code = data.code || id;
    const stock = Number(data.stock || 0);
    const list = Array.isArray(data.reservedList) ? data.reservedList : [];
    const reserved = list.reduce(function(s, r){ return s + Number(r && r.qty || 0); }, 0);

    let tip = "确定删除这条库存？\n编号：" + code +
      "\n色号：" + (data.color || "-") +
      "\n仓库：" + (data.warehouse || "-") +
      "\n数量：" + stock;
    if(reserved > 0) tip += "\n\n注意：还有留货 " + reserved + "，删除后留货信息也会消失！";
    tip += "\n\n此操作不可恢复。";
    if(!confirm(tip)) return;

    await deleteDoc(ref);
    alert("已删除：" + code);
    if($("in_search") && $("in_search").value.trim() && typeof window.searchIn === "function"){
      window.searchIn();
    }
  }catch(e){
    console.error(e);
    alert("删除失败：" + ((e && e.message) || e));
  }
};

function injectDeleteButtons(){
  const root = $("in_result");
  if(!root) return;
  root.querySelectorAll("input[id^='edit_code_']").forEach(function(input){
    const id = input.id.replace("edit_code_", "");
    if(root.querySelector('[data-delete-for="'+id.replace(/"/g,"")+'"]')) return;
    const panel = input.closest("div[style*='margin-top:10px']") || input.parentElement;
    if(!panel) return;
    const wrap = document.createElement("div");
    wrap.setAttribute("data-delete-for", id);
    wrap.style.cssText = "margin-top:8px;";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "删除这条库存";
    btn.style.cssText = "padding:6px 12px;border:none;border-radius:8px;background:#dc2626;color:#fff;cursor:pointer;font-size:13px;";
    btn.onclick = function(){ window.deleteInventoryItem(id); };
    wrap.appendChild(btn);
    (panel.parentElement || panel).appendChild(wrap);
  });
}

function hookSearchIn(){
  const tryHook = function(){
    if(typeof window.searchIn !== "function") return false;
    if(window.searchIn.__deleteHooked) return true;
    const orig = window.searchIn;
    window.searchIn = async function(){
      await orig.apply(this, arguments);
      setTimeout(injectDeleteButtons, 50);
      setTimeout(injectDeleteButtons, 400);
    };
    window.searchIn.__deleteHooked = true;
    console.log("delete button hooked on searchIn");
    return true;
  };
  if(tryHook()) return;
  let n = 0;
  const t = setInterval(function(){ n++; if(tryHook() || n > 60) clearInterval(t); }, 200);
}

function boot(){
  bindFilesUI();
  hookSearchIn();
  console.log("image_upload.js ready (files upload + inventory delete)");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
setInterval(bindFilesUI, 1500);
