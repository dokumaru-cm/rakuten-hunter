"use strict";

const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { loadConfig } = require("../utils/config");
const { formatPrice, truncate } = require("../utils/helpers");
const logger = require("../utils/logger");

const WIDTH = 1200;
const HEIGHT = 628;
const FONT = "Meiryo"; // font hệ thống Windows hỗ trợ tiếng Nhật

const CATEGORY_COLORS = {
  gia_dung: { from: "#FF6B35", to: "#FF4D4D" },
  thuc_pham: { from: "#4CAF50", to: "#2E7D32" },
  my_pham: { from: "#E91E63", to: "#AD1457" },
  quan_ao_tre_em: { from: "#42A5F5", to: "#1565C0" },
  do_choi_tre_em: { from: "#FF9800", to: "#E65100" },
  other: { from: "#5C6BC0", to: "#283593" },
  default: { from: "#FF4D4D", to: "#FF8C00" },
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
    const buf = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);
  } catch (e) {
    return null;
  }
}

/**
 * Tạo ảnh promo 1200x628 (Buffer PNG).
 * @param {ScoredDeal} deal
 * @param {string} pose  pose mascot (mặc định auto)
 */
async function createPromoImage(deal, pose = null) {
  const mascotPose = pose || selectMascotPose(deal);
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const colors = CATEGORY_COLORS[deal.genre] || CATEGORY_COLORS.default;

  // 1. Nền gradient theo category.
  const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  g.addColorStop(0, colors.from);
  g.addColorStop(1, colors.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. Ảnh sản phẩm (vòng tròn trắng nền).
  const productImg = await fetchImage(deal.imageUrl);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(210, 300, 150, 0, Math.PI * 2);
  ctx.fill();
  if (productImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(210, 300, 140, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(productImg, 70, 160, 280, 280);
    ctx.restore();
  }

  // 3. Badge giảm giá / point. (Không dùng emoji: Meiryo không có glyph màu → ô vuông.)
  const badge = deal.discountPercent >= 10 ? `${deal.discountPercent}% OFF!` : `${deal.pointRate}% ポイント!`;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 30, 30, 230, 62, 12);
  ctx.fill();
  ctx.fillStyle = colors.from;
  ctx.font = `bold 36px ${FONT}`;
  ctx.fillText(badge, 52, 74);

  // 4. Text thông tin (khối phải).
  const X = 400;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 30px ${FONT}`;
  wrapText(ctx, truncate(deal.itemName, 46), X, 150, 720, 38, 2);

  let y = 250;
  if (deal.originalPrice && deal.originalPrice > deal.currentPrice) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `24px ${FONT}`;
    const t = formatPrice(deal.originalPrice);
    ctx.fillText(t, X, y);
    const w = ctx.measureText(t).width;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X, y - 8);
    ctx.lineTo(X + w, y - 8);
    ctx.stroke();
    y += 48;
  }
  ctx.fillStyle = "#FFEB3B";
  ctx.font = `bold 48px ${FONT}`;
  ctx.fillText(formatPrice(deal.currentPrice), X, y);
  y += 52;

  if (deal.pointRate > 0) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText(`+ ${deal.pointRate}% ポイントバック`, X, y);
    y += 42;
  }
  if (deal.reviewCount > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = `22px ${FONT}`;
    ctx.fillText(`★ ${deal.reviewAverage}/5 (${deal.reviewCount}件)`, X, y);
  }

  // 5. Thanh CTA dưới cùng.
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, HEIGHT - 78, WIDTH, 78);
  ctx.fillStyle = "#FFEB3B";
  ctx.font = `bold 32px ${FONT}`;
  ctx.textAlign = "center";
  // Text ảnh giữ thuần Nhật (Meiryo không có dấu tiếng Việt). Tiếng Việt nằm ở bài post.
  ctx.fillText(
    `実質 ${formatPrice(deal.effectivePrice)} → ${deal.savingsPercent}% お得!`,
    WIDTH / 2,
    HEIGHT - 28
  );
  ctx.textAlign = "left";

  // 6. Mascot (góc phải dưới).
  try {
    const cfg = loadConfig();
    const mascotPath = path.join(cfg.paths.mascot, `mascot_${mascotPose}.png`);
    const mascotImg = await loadImage(mascotPath);
    const mh = 300;
    const mw = (mascotImg.width / mascotImg.height) * mh;
    ctx.drawImage(mascotImg, WIDTH - mw - 20, HEIGHT - mh - 60, mw, mh);
  } catch (e) {
    logger.warn(`Không nạp được mascot "${mascotPose}": ${e.message}`);
  }

  return canvas.toBuffer("image/png");
}

/** Vẽ text nhiều dòng, tối đa maxLines (thêm … nếu tràn). */
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
        // dòng cuối: đổ phần còn lại, cắt nếu cần
        let rest = line + chars.slice(i + 1).join("");
        while (ctx.measureText(rest + "…").width > maxWidth && rest.length > 1) {
          rest = rest.slice(0, -1);
        }
        if (rest.length < (line + chars.slice(i + 1).join("")).length) rest += "…";
        ctx.fillText(rest, x, y);
        return;
      }
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}

module.exports = { createPromoImage, selectMascotPose };
