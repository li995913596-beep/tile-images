/**
 * 后台图片上传到 GitHub（不占用 Firebase Storage）
 * 需要在后台填写一次 GitHub Token（只存在本机浏览器，不会写入代码仓库）
 */
import { auth } from "./firebase.js";

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

function ensureTokenUI(){
  if($("gh_token_box")) return;
  const admin = $("adminSection");
  if(!admin) return;
  const box = document.createElement("div");
  box.id = "gh_token_box";
  box.className = "card";
  box.style.cssText = "margin-bottom:12px;";
  box.innerHTML = `
    <div style="font-weight:600;margin-bottom:6px;">图片上传设置（GitHub）</div>
    <div style="font-size:12px;color:#666;margin-bottom:8px;">
      图片会上传到仓库 images/ 目录，不占 Firebase 空间。Token 只保存在你这台电脑的浏览器里。
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
      <input id="gh_token_input" type="password" placeholder="GitHub Token（fine-grained 或 classic）"
        style="flex:1;min-width:220px;padding:8px;border:1px solid #ddd;border-radius:8px;">
      <button type="button" id="gh_token_save" style="padding:8px 14px;border:none;border-radius:8px;background:#2f7dd1;color:#fff;cursor:pointer;">保存 Token</button>
      <button type="button" id="gh_token_clear" style="padding:8px 14px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;">清除</button>
      <a href="https://github.com/settings/tokens" target="_blank" style="font-size:12px;color:#2f7dd1;">去生成 Token</a>
    </div>
    <div style="font-size:12px;color:#888;margin-top:6px;">
      权限：仓库 Contents 读写。Classic 勾选 repo；Fine-grained 选本仓库 Contents: Read and write。
    </div>
  `;
  const firstCard = admin.querySelector(".card");
  if(firstCard && firstCard.parentNode){
    firstCard.parentNode.insertBefore(box, firstCard.nextSibling);
  } else {
    admin.insertBefore(box, admin.firstChild);
  }
  const input = $("gh_token_input");
  if(input && getToken()) input.value = getToken();
  const save = $("gh_token_save");
  if(save) save.onclick = () => {
    const v = (input && input.value || "").trim();
    if(!v) return alert("请先粘贴 Token");
    setToken(v);
    alert("Token 已保存在本机浏览器");
  };
  const clear = $("gh_token_clear");
  if(clear) clear.onclick = () => {
    setToken("");
    if(input) input.value = "";
    alert("已清除本机 Token");
  };
}

async function fileToJpegBlob(file){
  if((file.type === "image/jpeg" || file.type === "image/jpg") && file.size <= 2 * 1024 * 1024){
    return { blob: file, contentType: "image/jpeg" };
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const maxW = 1600;
        let w = img.width, h = img.height;
        if(w > maxW){ h = Math.round(h * maxW / w); w = maxW; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob((b) => {
          URL.revokeObjectURL(url);
          if(b) resolve({ blob: b, contentType: "image/jpeg" });
          else reject(new Error("图片转换失败"));
        }, "image/jpeg", 0.85);
      } catch(err){
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片读取失败")); };
    img.src = url;
  });
}

function blobToBase64(blob){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function githubGetSha(path, token){
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if(res.status === 404) return null;
  if(!res.ok){
    const t = await res.text();
    throw new Error("读取仓库文件失败：" + res.status + " " + t.slice(0, 200));
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
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`;
  const res = await fetch(url, {
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
  return await res.json();
}

window.uploadTileImage = async function(code, fileInputId){
  try{
    if(!auth.currentUser) return alert("请先登录后台");
    code = (code || "").trim();
    if(!code) return alert("没有编号，无法上传");
    const token = getToken();
    if(!token){
      ensureTokenUI();
      return alert("请先在上方填写并保存 GitHub Token");
    }
    const fileEl = $(fileInputId);
    if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("请先选择图片");
    const file = fileEl.files[0];
    if(!file.type || !file.type.startsWith("image/")) return alert("请选择图片文件");
    if(file.size > 20 * 1024 * 1024) return alert("原图太大（>20MB），请先压缩再传");

    if(!confirm("上传到 GitHub？\n编号：" + code + "\n原文件：" + file.name + "\n保存为：images/" + code + ".jpg")) return;

    const { blob } = await fileToJpegBlob(file);
    if(blob.size > 8 * 1024 * 1024) return alert("压缩后仍超过 8MB，请用更小的图");
    const b64 = await blobToBase64(blob);
    const path = "images/" + code + ".jpg";
    await githubPutFile(path, b64, token, "upload image " + code + ".jpg");
    alert("上传成功！\n路径：images/" + code + ".jpg\n约 1 分钟后前台刷新可见（GitHub Pages 更新）");
  }catch(e){
    console.error(e);
    const msg = (e && e.message) ? e.message : String(e);
    if(/401|Bad credentials|Requires authentication/i.test(msg)){
      alert("Token 无效或已过期，请重新生成并保存");
    } else if(/403|resource not accessible|Permission/i.test(msg)){
      alert("Token 权限不足。请给本仓库 Contents 读写权限");
    } else {
      alert(msg);
    }
  }
};

function injectUploadPanels(){
  const root = $("in_result");
  if(!root) return;
  root.querySelectorAll("input[id^='edit_code_']").forEach(input => {
    const id = input.id.replace("edit_code_", "");
    if(root.querySelector("[data-upload-for='"+id+"']")) return;
    const panel = input.closest("div[style*='margin-top:10px']") || input.parentElement;
    if(!panel) return;
    const wrap = document.createElement("div");
    wrap.setAttribute("data-upload-for", id);
    wrap.style.cssText = "margin-top:10px;padding-top:10px;border-top:1px solid rgba(47,125,209,0.15);display:flex;flex-wrap:wrap;gap:8px;align-items:center;";
    const fid = "edit_img_" + id;
    wrap.innerHTML = '<span style="font-size:12px;color:#666;">上传图片到 GitHub</span>' +
      '<input type="file" id="'+fid+'" accept="image/*" style="font-size:12px;max-width:200px;">' +
      '<button type="button" style="padding:6px 14px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">上传</button>' +
      '<span style="font-size:12px;color:#888;">自动命名 编号.jpg</span>';
    const btn = wrap.querySelector("button");
    btn.onclick = () => {
      const codeEl = $("edit_code_"+id);
      const code = (codeEl && codeEl.value ? codeEl.value : input.value || "").trim();
      window.uploadTileImage(code, fid);
    };
    if(panel.parentElement) panel.parentElement.appendChild(wrap);
    else panel.appendChild(wrap);
  });
}

function hookSearchIn(){
  const tryHook = () => {
    if(typeof window.searchIn !== "function") return false;
    if(window.searchIn.__ghUploadHooked) return true;
    const orig = window.searchIn;
    window.searchIn = async function(){
      await orig.apply(this, arguments);
      setTimeout(injectUploadPanels, 50);
      setTimeout(injectUploadPanels, 300);
    };
    window.searchIn.__ghUploadHooked = true;
    console.log("GitHub image upload hooked");
    return true;
  };
  if(tryHook()) return;
  let n = 0;
  const t = setInterval(() => {
    n++;
    if(tryHook() || n > 50) clearInterval(t);
  }, 200);
}

function boot(){
  ensureTokenUI();
  hookSearchIn();
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
setInterval(() => {
  if($("adminSection") && $("adminSection").style.display !== "none"){
    ensureTokenUI();
  }
}, 1500);

console.log("image_upload.js (GitHub) loaded");
