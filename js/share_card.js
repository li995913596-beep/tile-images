/**
 * 生成没有网址的分享图，发给客户用这个，不要截网页。
 */
window.shareTileCard = async function(item){
  var canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 420;
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 720, 420);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(24, 24, 672, 372);
  var img = new Image();
  img.crossOrigin = "anonymous";
  var imageUrl = location.origin + "/images/" + encodeURIComponent(item.code || "") + ".jpg";
  await new Promise(function(resolve){
    img.onload = resolve;
    img.onerror = resolve;
    img.src = imageUrl;
  });
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(48, 48, 180, 180);
  if(img.width) ctx.drawImage(img, 48, 48, 180, 180);
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 36px sans-serif";
  ctx.fillText(item.code || "", 252, 92);
  ctx.fillStyle = "#475569";
  ctx.font = "24px sans-serif";
  ctx.fillText("规格  " + (item.spec || "-"), 252, 140);
  ctx.fillText("色号  " + (item.color || "-"), 252, 180);
  ctx.fillText("仓库  " + (item.warehouse || "-"), 252, 220);
  var stock = Number(item.stock || 0);
  ctx.fillStyle = stock > 10 ? "#16a34a" : stock > 0 ? "#d97706" : "#dc2626";
  ctx.font = "700 42px sans-serif";
  ctx.fillText("库存  " + stock + " 箱", 252, 290);
  if(Number(item.reserved || 0) > 0){
    ctx.fillStyle = "#b91c1c";
    ctx.font = "22px sans-serif";
    ctx.fillText("留货 " + item.reserved, 252, 330);
  }
  var blob = await new Promise(function(resolve){ canvas.toBlob(resolve, "image/png"); });
  var file = new File([blob], (item.code || "tile") + ".png", { type: "image/png" });
  if(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
    try { await navigator.share({ files: [file], title: item.code || "库存" }); return; } catch(e){}
  }
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (item.code || "tile") + ".png";
  a.click();
};
