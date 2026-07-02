"use strict";

const { formatPrice } = require("../utils/helpers");

const HASHTAGS = ["#PR", "#楽天", "#お得", "#スーパーDEAL"];

/** Rút gọn tiêu đề Rakuten (thường rất dài) cho headline dễ đọc. Giữ nguyên tiếng Nhật. */
function shortName(name = "", max = 46) {
  // Lột sạch các khối quảng cáo ở ĐẦU tiêu đề: 【..】 [..] （..) ★..★ ＼..／ và ký tự thừa.
  const strip = [
    /^[【\[（(][^】\]）)]*[】\]）)]\s*/,
    /^★[^★]*★\s*/,
    /^◆[^◆]*◆\s*/,
    /^＼[^／]*／\s*/,
    /^[\s、,・|]+/,
  ];
  let s = String(name);
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of strip) {
      if (re.test(s)) {
        s = s.replace(re, "");
        changed = true;
      }
    }
  }
  s = s.trim();
  if (!s) s = String(name).trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Dòng giá: có giá gốc thì gạch ngang → giá sale. */
function priceLine(deal) {
  if (deal.originalPrice && deal.originalPrice > deal.currentPrice) {
    return `${formatPrice(deal.originalPrice)} → ${formatPrice(deal.currentPrice)} (giảm ${deal.discountPercent}%)`;
  }
  return `${formatPrice(deal.currentPrice)}${deal.discountPercent ? ` (giảm ${deal.discountPercent}%)` : ""}`;
}

/** Câu "hook" tiếng Việt chọn theo điểm mạnh nhất của deal. */
function hookLine(deal) {
  if (deal.score >= 85) return "🔥 DEAL SIÊU HOT hôm nay, xịn hết nấc!";
  if (deal.discountPercent >= 50) return `😱 Giảm sốc tới ${deal.discountPercent}% — hiếm khi thấy!`;
  if (deal.pointRate >= 30) return `💰 Hoàn point khủng ${deal.pointRate}% — mua như được lời lại!`;
  if (deal.dealEndTime) return "⏰ Deal có giới hạn thời gian, nhanh kẻo lỡ!";
  return "✨ Deal ngon đáng chú ý cho cả nhà nè!";
}

/** Câu chốt kêu gọi. */
function closingLine(deal) {
  if (deal.dealEndTime) return "Số lượng & thời gian có hạn, chốt nhanh nha 👇";
  return "Thấy hời thì múc liền tay nha cả nhà 👇";
}

/** Bài Facebook fallback — tiếng Việt tự nhiên, tên sản phẩm giữ tiếng Nhật. */
function fallbackFacebook(deal, link) {
  const lines = [];
  lines.push(`【PR】 ${hookLine(deal)}`);
  lines.push("");
  lines.push(`📦 ${shortName(deal.itemName)}`);
  if (deal.shopName) lines.push(`🏬 Shop: ${deal.shopName}`);
  lines.push("");
  lines.push(`💰 Giá sale: ${priceLine(deal)}`);
  if (deal.pointRate > 0) {
    lines.push(`🎯 Được hoàn ${deal.pointRate}% point (≈ ${formatPrice(deal.pointAmount)})`);
  }
  lines.push(`💎 Tính ra chỉ còn khoảng ${formatPrice(deal.effectivePrice)}${deal.savingsPercent > 0 ? ` — rẻ hơn ${deal.savingsPercent}% so với giá gốc!` : "!"}`);
  if (deal.reviewCount > 0) {
    lines.push(`⭐ Đánh giá ${deal.reviewAverage}/5 từ ${deal.reviewCount} lượt mua`);
  }
  lines.push("");
  lines.push(closingLine(deal));
  lines.push(`👉 ${link}`);
  lines.push("");
  lines.push(HASHTAGS.join(" "));
  return lines.join("\n");
}

/** Message gửi bạn bè fallback — tiếng Việt thân mật, tên sản phẩm giữ tiếng Nhật. */
function fallbackFriend(deal, link) {
  const pt = deal.pointRate > 0 ? `, được hoàn ${deal.pointRate}% point` : "";
  const rv = deal.reviewCount > 0 ? `Review ${deal.reviewAverage}⭐ (${deal.reviewCount} người mua) nên khá yên tâm.` : "";
  return [
    `Ê, món 「${shortName(deal.itemName, 34)}」 đang sale nè!`,
    `Giá ${formatPrice(deal.currentPrice)}${pt}, tính ra chỉ còn khoảng ${formatPrice(deal.effectivePrice)}${deal.savingsPercent > 0 ? ` (rẻ hơn ${deal.savingsPercent}%)` : ""}.`,
    rv,
    `Link nè: ${link}`,
    `(※ affiliate link nhé, mua ủng hộ mình xíu 😄)`,
  ].filter(Boolean).join("\n");
}

module.exports = { HASHTAGS, shortName, priceLine, fallbackFacebook, fallbackFriend };
