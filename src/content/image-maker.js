"use strict";

const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { loadConfig } = require("../utils/config");
const { formatPrice, truncate } = require("../utils/helpers");
const logger = require("../utils/logger");

const WIDTH = 1200;
const HEIGHT = 628;
const FONT = "Meiryo"; // font hệ thống Windows hỗ trợ tiếng Nhật
const CTA_H = 84;
const TEXT_X = 396; // mép trái vùng chữ
const TEXT_R = 900; // mép phải vùng chữ (chừa chỗ mascot)

const CATEGORY_COLORS = {
  gia_dung: { from: "#FF6B35", to: "#E23E3E" },
  thuc_pham: { from: "#43A047", to: "#1B5E20" },
  my_pham: { from: "#EC407A", to: "#AD1457" },
  quan_ao_tre_em: { from: "#42A5F5", to: "#1565C0" },
  do_choi_tre_em: { from: "#FB8C00", to: "#E65100" },
  other: { from: "#5C6BC0", to: "#283593" },
  default: { from: "#FF5252", to: "#C62828" },
};

/** Chọn pose mascot theo đặc điểm deal. */
function selectMascotPose(deal) {
  if (deal.score >= 85) return "excited";
  if (deal.discountPercent >= 50) return "surprised";
  if (deal.pointRate >= 30) return "winking";
  if (deal.dealEndTime) return "inviting";
  return "pointing";
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function fetchImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Vẽ 1 "chip" bo tròn có chữ, trả về chiều rộng đã vẽ. */
function drawChip(ctx, x, y, text, { bg, fg, font = `bold 26px ${FONT}`, padX = 18, h = 46 }) {
  ctx.font = font;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

/**
 * Tạo ảnh promo 1200x628 (Buffer PNG).
 */
async function createPromoImage(deal, pose = null) {
  const mascotPose = pose || selectMascotPose(deal);
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
  const colors = CATEGORY_COLORS[deal.genre] || CATEGORY_COLORS.default;

  // 1. Nền gradient.
  const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  g.addColorStop(0, colors.from);
  g.addColorStop(1, colors.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. Ảnh sản phẩm trong vòng tròn trắng.
  const productImg = await fetchImage(deal.imageUrl);
  const cx = 205, cy = 292, R = 150;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (productImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 8, 0, Math.PI * 2);
    ctx.clip();
    const s = (R - 8) * 2;
    ctx.drawImage(productImg, cx - R + 8, cy - R + 8, s, s);
    ctx.restore();
  }

  // 3. Nhãn nguồn (góc trên trái).
  const tag = deal.isSuperDeal ? "SUPER DEAL" : "SALE";
  drawChip(ctx, 34, 30, tag, { bg: "rgba(255,255,255,0.95)", fg: colors.to, font: `bold 24px ${FONT}`, h: 42 });

  // 4. Tên sản phẩm.
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 30px ${FONT}`;
  const nameBottom = wrapText(ctx, truncate(deal.itemName, 52), TEXT_X, 96, TEXT_R - TEXT_X, 38, 2);

  // 5. Khối giá.
  let y = Math.max(nameBottom + 34, 190);
  if (deal.originalPrice && deal.originalPrice > deal.currentPrice) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `24px ${FONT}`;
    const t = formatPrice(deal.originalPrice);
    ctx.fillText(t, TEXT_X, y);
    const w = ctx.measureText(t).width;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(TEXT_X, y - 8);
    ctx.lineTo(TEXT_X + w, y - 8);
    ctx.stroke();
    y += 12;
  }
  // Giá sale lớn + chip giảm %.
  ctx.fillStyle = "#FFEB3B";
  ctx.font = `bold 60px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(formatPrice(deal.currentPrice), TEXT_X, y + 52);
  const priceW = ctx.measureText(formatPrice(deal.currentPrice)).width;
  if (deal.discountPercent > 0) {
    drawChip(ctx, TEXT_X + priceW + 20, y + 14, `-${deal.discountPercent}%`, {
      bg: "#FFEB3B", fg: "#C62828", font: `bold 30px ${FONT}`, h: 50,
    });
  }
  y += 82;

  // 6. Chip POINT (hoàn point) — rõ ràng, không đè mascot.
  if (deal.pointRate > 0) {
    drawChip(ctx, TEXT_X, y, `ポイント +${deal.pointRate}%  (${formatPrice(deal.pointAmount)})`, {
      bg: "rgba(0,0,0,0.28)", fg: "#FFFFFF", font: `bold 27px ${FONT}`, h: 50,
    });
    y += 66;
  }

  // 7. Review + hạn.
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `23px ${FONT}`;
  let ry = y + 4;
  if (deal.reviewCount > 0) {
    ctx.fillText(`★ ${deal.reviewAverage}/5  (${deal.reviewCount}件)`, TEXT_X, ry);
    ry += 34;
  }
  if (deal.dealEndTime) {
    ctx.fillStyle = "#FFE0B2";
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText("期間限定 — お早めに!", TEXT_X, ry);
  }

  // 8. Mascot (đứng trên thanh CTA, không bị cắt).
  try {
    const cfg = loadConfig();
    const mascotImg = await loadImage(path.join(cfg.paths.mascot, `mascot_${mascotPose}.png`));
    const mh = 360;
    const mw = (mascotImg.width / mascotImg.height) * mh;
    const my = HEIGHT - CTA_H - mh + 24; // chân đứng chạm mép trên thanh CTA
    ctx.drawImage(mascotImg, WIDTH - mw - 28, my, mw, mh);
  } catch (e) {
    logger.warn(`Không nạp được mascot "${mascotPose}": ${e.message}`);
  }

  // 9. Thanh CTA dưới cùng (thuần Nhật — Meiryo không có dấu tiếng Việt).
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, HEIGHT - CTA_H, WIDTH, CTA_H);
  ctx.fillStyle = "#FFEB3B";
  ctx.font = `bold 34px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    `実質 ${formatPrice(deal.effectivePrice)}  →  ${deal.savingsPercent}% お得!`,
    WIDTH / 2,
    HEIGHT - CTA_H / 2 + 2
  );
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  return canvas.toBuffer("image/png");
}

/** Vẽ text nhiều dòng, tối đa maxLines. Trả về y của baseline dòng cuối. */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = [...text];
  let line = "";
  let lines = 0;
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth) {
      ctx.fillText(line, x, y);
      lines++;
      y += lineHeight;
      line = chars[i];
      if (lines >= maxLines - 1) {
        let rest = line + chars.slice(i + 1).join("");
        while (ctx.measureText(rest + "…").width > maxWidth && rest.length > 1) rest = rest.slice(0, -1);
        if (rest.length < (line + chars.slice(i + 1).join("")).length) rest += "…";
        ctx.fillText(rest, x, y);
        return y;
      }
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
  return y;
}

module.exports = { createPromoImage, selectMascotPose };
