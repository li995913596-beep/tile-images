/**
 * 文件页：搜索 → 在结果上上传/替换图片（显示现有图片预览）
 * 入库页：删除错误库存
 */
import { auth, db } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, deleteDoc, query, where, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
  if(!save) return;
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
  return (await res.json()).sha || null;
}

async function githubPutFile(path, base64Content, token, message){
  const sha = await githubGetSha(path, token);
  const body = { message: message || ("upload " + path), content: base64Content, branch: GH_BRANCH };
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
  try{
    if(!auth.currentUser) return alert("请先登录后台");
    code = (code || "").trim().replace(/\.jpe?g$/i, "");
    if(!code) return alert("没有编号");
    const token = getToken();
    if(!token) return alert("请先在上方保存 GitHub Token");
    const fileEl = $(fileInputId);
    if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("请先选择图片");
    const file = fileEl.files[0];
    if(!file.type || !file.type.startsWith("image/")) return alert("请选择图片文件");
    if(file.size > 20 * 1024 * 1024) return alert("原图太大（>20MB）");

    const path = "images/" + code + ".jpg";
    if(!confirm("确认上传/替换？\n编号：" + code + "\n已有同名图会被覆盖")) return;

    const blob = await fileToJpegBlob(file);
    if(blob.size > 8 * 1024 * 1024) return alert("压缩后仍超过 8MB");
    const b64 = await blobToBase64(blob);
    const result = await githubPutFile(path, b64, token, "upload image " + code + ".jpg");
    alert("成功！\n" + (result.replaced ? "已替换" : "已新增") + "\n" + path + "\n约1分钟后前台刷新可见");
  }catch(e){
    console.error(e);
    const msg = (e && e.message) ? e.message : String(e);
    if(/401|Bad credentials/i.test(msg)) alert("Token 无效或过期");
    else if(/403|Permission|not accessible/i.test(msg)) alert("Token 权限不足，需要 Contents Read and write");
    else alert(msg);
  }
};

window.searchForImage = async function(){
  const input = $("img_search");
  const result = $("img_search_result");
  if(!result) return;
  const raw = (input && input.value || "").trim();
  result.innerHTML = "";
  if(!raw){
    result.innerHTML = '<div style="color:#666;font-size:13px;">请输入编号或规格</div>';
    return;
  }
  result.innerHTML = '<div style="color:#666;font-size:13px;">搜索中…</div>';

  const keyword = raw.toLowerCase();
  const seen = new Set();
  const list = [];

  function addSnap(snap){
    snap.forEach(function(d){
      if(seen.has(d.id)) return;
      seen.add(d.id);
      list.push({ id: d.id, data: d.data() });
    });
  }

  try {
    const variants = Array.from(new Set([raw, keyword, raw.toUpperCase()]));
    for(let i=0;i<variants.length;i++){
      const v = variants[i];
      addSnap(await getDocs(query(collection(db, "inventory"), where("code", "==", v))));
      addSnap(await getDocs(query(collection(db, "inventory"), where("spec", "==", v))));
    }
  } catch(e){
    console.error(e);
  }

  if(list.length === 0){
    try {
      const snap = await getDocs(query(collection(db, "inventory"), limit(800)));
      snap.forEach(function(d){
        const item = d.data();
        const code = String(item.code || "").toLowerCase();
        const spec = String(item.spec || "").toLowerCase();
        if(code.includes(keyword) || spec.includes(keyword) || d.id.toLowerCase().includes(keyword)){
          if(seen.has(d.id)) return;
          seen.add(d.id);
          list.push({ id: d.id, data: item });
        }
      });
    } catch(e){
      console.error(e);
    }
  }

  const byCode = {};
  list.forEach(function(row){
    const code = String(row.data.code || "").trim();
    if(!code) return;
    if(!byCode[code]) byCode[code] = row;
  });
  const codes = Object.keys(byCode);
  if(codes.length === 0){
    result.innerHTML = '<div style="color:#666;font-size:13px;">未找到库存</div>';
    return;
  }

  result.innerHTML = "";
  codes.forEach(function(code, idx){
    const row = byCode[code];
    const item = row.data;
    const fid = "img_file_" + idx;
    const imgUrl = window.location.origin + "/images/" + encodeURIComponent(code) + ".jpg?t=" + Date.now();
    const card = document.createElement("div");
    card.style.cssText = "background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;";

    const thumb = document.createElement("div");
    thumb.style.cssText = "flex-shrink:0;width:72px;height:72px;border-radius:10px;overflow:hidden;background:#f3f4f6;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;";
    const img = document.createElement("img");
    img.src = imgUrl;
    img.alt = code;
    img.style.cssText = "width:72px;height:72px;object-fit:cover;display:block;";
    img.onerror = function(){
      thumb.innerHTML = '<span style="font-size:11px;color:#9ca3af;text-align:center;padding:4px;">暂无图片</span>';
    };
    thumb.appendChild(img);

    const body = document.createElement("div");
    body.style.cssText = "flex:1;min-width:0;";
    body.innerHTML =
      '<div style="font-weight:600;font-size:15px;margin-bottom:4px;">' + code + '</div>' +
      '<div style="font-size:12px;color:#888;margin-bottom:8px;">同编号共用一张图 · 规格 ' + (item.spec||"-") + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
        '<input type="file" id="'+fid+'" accept="image/*" style="font-size:12px;max-width:200px;">' +
        '<button type="button" class="btn-upload-img" style="padding:6px 14px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;font-weight:600;">上传/替换图片</button>' +
      '</div>';
    body.querySelector(".btn-upload-img").onclick = function(){
      window.uploadTileImage(code, fid);
    };

    card.appendChild(thumb);
    card.appendChild(body);
    result.appendChild(card);
  });
};

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
    if(reserved > 0) tip += "\n\n注意：还有留货 " + reserved + "，删除后留货也会消失！";
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
    return true;
  };
  if(tryHook()) return;
  let n = 0;
  const t = setInterval(function(){ n++; if(tryHook() || n > 60) clearInterval(t); }, 200);
}

function bindImageSearch(){
  const btn = $("img_search_btn");
  const input = $("img_search");
  if(btn && !btn.__bound){
    btn.__bound = true;
    btn.onclick = function(){ window.searchForImage(); };
  }
  if(input && !input.__bound){
    input.__bound = true;
    input.addEventListener("keydown", function(e){
      if(e.key === "Enter") window.searchForImage();
    });
  }
}

function boot(){
  bindTokenUI();
  bindImageSearch();
  hookSearchIn();
  console.log("image_upload.js ready: search-then-upload in 文件 + delete in 入库");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
setInterval(function(){ bindTokenUI(); bindImageSearch(); }, 1500);
