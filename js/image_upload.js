/**
 * 图片上传/替换到 GitHub
 * 流程：入库页搜索 → 在结果卡片上上传/替换
 * Token 在「文件」页设置，只存在本机浏览器
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

function bindTokenUI(){
  const input = $("gh_token_input");
  const save = $("gh_token_save");
  const clear = $("gh_token_clear");
  if(!save) return;

  if(input && getToken()) input.placeholder = "已保存 Token（更换请重新粘贴）";

  if(save && !save.__bound){
    save.__bound = true;
    save.onclick = () => {
      const v = (input && input.value || "").trim();
      if(!v) return alert("请先粘贴 Token");
      setToken(v);
      if(input){ input.value = ""; input.placeholder = "已保存 Token（更换请重新粘贴）"; }
      alert("Token 已保存");
    };
  }
  if(clear && !clear.__bound){
    clear.__bound = true;
    clear.onclick = () => {
      setToken("");
      if(input){ input.value = ""; input.placeholder = "粘贴 GitHub Token"; }
      alert("已清除");
    };
  }
}

async function fileToJpegBlob(file){
  if((file.type === "image/jpeg" || file.type === "image/jpg") && file.size <= 2 * 1024 * 1024){
    return file;
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
          if(b) resolve(b); else reject(new Error("图片转换失败"));
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
  const encPath = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encPath}?ref=${GH_BRANCH}`, {
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
  if(sha) body.sha = sha; // 覆盖已有图片
  const encPath = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encPath}`, {
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
  try{
    if(!auth.currentUser) return alert("请先登录后台");
    code = (code || "").trim().replace(/\.jpe?g$/i, "");
    if(!code) return alert("没有编号，无法上传");
    const token = getToken();
    if(!token) return alert("请先到「文件」页保存 GitHub Token");
    const fileEl = $(fileInputId);
    if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("请先选择图片");
    const file = fileEl.files[0];
    if(!file.type || !file.type.startsWith("image/")) return alert("请选择图片文件");
    if(file.size > 20 * 1024 * 1024) return alert("原图太大（>20MB），请先压缩");

    const path = "images/" + code + ".jpg";
    if(!confirm("确认上传/替换？\n编号：" + code + "\n路径：" + path + "\n已有同名图会被覆盖")) return;

    const blob = await fileToJpegBlob(file);
    if(blob.size > 8 * 1024 * 1024) return alert("压缩后仍超过 8MB，请用更小的图");
    const b64 = await blobToBase64(blob);
    const { replaced } = await githubPutFile(path, b64, token, "upload image " + code + ".jpg");
    const tip = replaced ? "已替换原有图片" : "已新增图片";
    alert("成功！\n" + tip + "\n" + path + "\n约 1 分钟后强制刷新前台即可看到");
  }catch(e){
    console.error(e);
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

function injectUploadPanels(){
  const root = $("in_result");
  if(!root) return;
  root.querySelectorAll("input[id^='edit_code_']").forEach(input => {
    const id = input.id.replace("edit_code_", "");
    if(root.querySelector('[data-upload-for="'+id.replace(/"/g,"")+'"]')) return;
    const panel = input.closest("div[style*='margin-top:10px']") || input.parentElement;
    if(!panel) return;
    const wrap = document.createElement("div");
    wrap.setAttribute("data-upload-for", id);
    wrap.style.cssText = "margin-top:10px;padding:10px;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;";
    const fid = "edit_img_" + id;
    const code = (input.value || "").trim();
    wrap.innerHTML = '<span style="font-size:13px;color:#166534;font-weight:600;">📷 上传/替换图片</span>' +
      '<input type="file" id="'+fid+'" accept="image/*" style="font-size:12px;max-width:180px;">' +
      '<button type="button" style="padding:6px 14px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;font-weight:600;">上传/替换</button>' +
      '<span style="font-size:12px;color:#888;">编号 ' + code + ' · 有图则覆盖</span>';
    wrap.querySelector("button").onclick = () => {
      const codeEl = $("edit_code_"+id);
      const c = (codeEl && codeEl.value ? codeEl.value : input.value || "").trim();
      window.uploadTileImage(c, fid);
    };
    (panel.parentElement || panel).appendChild(wrap);
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
      setTimeout(injectUploadPanels, 400);
    };
    window.searchIn.__ghUploadHooked = true;
    console.log("GitHub upload hooked on searchIn");
    return true;
  };
  if(tryHook()) return;
  let n = 0;
  const t = setInterval(() => { n++; if(tryHook() || n > 60) clearInterval(t); }, 200);
}

function boot(){
  bindUploadUI();
  hookSearchIn();
  console.log("image_upload.js bound OK");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
setInterval(bindUploadUI, 1500);
