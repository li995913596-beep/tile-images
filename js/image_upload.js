import { storage, db } from "./firebase.js";
import { ref as storageRef, uploadBytes } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

window.uploadTileImage = async function(code, fileInputId){
  try{
    code = (code || "").trim();
    if(!code) return alert("没有编号，无法上传");
    const fileEl = $(fileInputId);
    if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("请先选择图片");
    const file = fileEl.files[0];
    if(!file.type || !file.type.startsWith("image/")) return alert("请选择图片文件");
    if(file.size > 15 * 1024 * 1024) return alert("图片太大，请压缩到 15MB 以内");
    if(!confirm("上传图片到编号：" + code + "？\n原文件名：" + file.name + "\n保存为：" + code + ".jpg")) return;

    let blob = file;
    let contentType = file.type || "image/jpeg";
    try {
      if(file.type !== "image/jpeg" && file.type !== "image/jpg"){
        blob = await new Promise((resolve, reject) => {
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
                if(b) resolve(b); else reject(new Error("转换失败"));
              }, "image/jpeg", 0.85);
            } catch(err){ URL.revokeObjectURL(url); reject(err); }
          };
          img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片读取失败")); };
          img.src = url;
        });
        contentType = "image/jpeg";
      }
    } catch(convErr){
      console.warn("图片转换失败，使用原文件", convErr);
      blob = file;
      contentType = file.type || "image/jpeg";
    }

    const path = "images/" + code + ".jpg";
    await uploadBytes(storageRef(storage, path), blob, { contentType });
    alert("上传成功！\n编号：" + code + "\n前台刷新后即可看到");
  }catch(e){
    console.error(e);
    const msg = (e && e.message) ? e.message : String(e);
    if(/permission|unauthorized|Permission|storage\/unauthorized/i.test(msg)){
      alert("上传失败：Storage 权限不足。\n请到 Firebase 控制台 → Storage → Rules，允许已登录用户写入 images/");
    } else {
      alert("上传失败：" + msg);
    }
  }
};

function injectUploadPanels(){
  const root = $("in_result");
  if(!root) return;
  root.querySelectorAll("input[id^='edit_code_']").forEach(input => {
    const id = input.id.replace("edit_code_", "");
    if(root.querySelector("[data-upload-for='"+id+"']")) return;
    const code = (input.value || "").trim();
    const panel = input.closest("div[style*='margin-top:10px']") || input.parentElement;
    if(!panel) return;
    const wrap = document.createElement("div");
    wrap.setAttribute("data-upload-for", id);
    wrap.style.cssText = "margin-top:10px;padding-top:10px;border-top:1px solid rgba(47,125,209,0.15);display:flex;flex-wrap:wrap;gap:8px;align-items:center;";
    const fid = "edit_img_" + id;
    wrap.innerHTML = '<span style="font-size:12px;color:#666;">上传图片</span>' +
      '<input type="file" id="'+fid+'" accept="image/*" style="font-size:12px;max-width:200px;">' +
      '<button type="button" style="padding:6px 14px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;">上传图片</button>' +
      '<span style="font-size:12px;color:#888;">不用改文件名</span>';
    const btn = wrap.querySelector("button");
    btn.onclick = () => window.uploadTileImage(( $("edit_code_"+id) && $("edit_code_"+id).value) || code, fid);
    if(panel.parentElement) panel.parentElement.appendChild(wrap);
    else panel.appendChild(wrap);
  });
}

function hookSearchIn(){
  const tryHook = () => {
    if(typeof window.searchIn !== "function") return false;
    if(window.searchIn.__uploadHooked) return true;
    const orig = window.searchIn;
    window.searchIn = async function(){
      await orig.apply(this, arguments);
      setTimeout(injectUploadPanels, 50);
      setTimeout(injectUploadPanels, 300);
    };
    window.searchIn.__uploadHooked = true;
    console.log("image upload hooked on searchIn");
    return true;
  };
  if(tryHook()) return;
  let n = 0;
  const t = setInterval(() => {
    n++;
    if(tryHook() || n > 40) clearInterval(t);
  }, 250);
}

hookSearchIn();
console.log("image_upload.js loaded");
