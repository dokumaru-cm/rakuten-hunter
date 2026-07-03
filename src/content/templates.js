"use strict";

const { formatPrice, pickBy } = require("../utils/helpers");

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

/** Câu "hook" tiếng Việt — nhiều biến thể, chọn ổn định theo deal cho đỡ lặp. */
function hookLine(deal) {
  if (deal.score >= 85) {
    return pickBy(deal.id, [
      "🔥 DEAL SIÊU HOT hôm nay, xịn hết nấc!",
      "🔥 Deal đỉnh nhất hôm nay đây rồi, bỏ qua là tiếc!",
      "🚨 Báo động deal xịn — hàng ngon giá hời thế này hiếm lắm!",
    ]);
  }
  if (deal.discountPercent >= 50) {
    return pickBy(deal.id, [
      `😱 Giảm sốc tới ${deal.discountPercent}% — hiếm khi thấy!`,
      `😱 Ối trời, giảm hẳn ${deal.discountPercent}% luôn cả nhà ơi!`,
      `💥 Sale mạnh tay ${deal.discountPercent}% — canh mãi mới thấy!`,
    ]);
  }
  if (deal.pointRate >= 30) {
    return pickBy(deal.id, [
      `💰 Hoàn point khủng ${deal.pointRate}% — mua như được lời lại!`,
      `💰 Point back ${deal.pointRate}% — kiểu này mua là lãi rồi!`,
      `🤑 Được hoàn hẳn ${deal.pointRate}% point, ngon hơn cả giảm giá!`,
    ]);
  }
  if (deal.dealEndTime) {
    return pickBy(deal.id, [
      "⏰ Deal có giới hạn thời gian, nhanh kẻo lỡ!",
      "⏰ Đồng hồ đếm ngược rồi — chần chừ là hết suất!",
    ]);
  }
  return pickBy(deal.id, [
    "✨ Deal ngon đáng chú ý cho cả nhà nè!",
    "🛒 Lượm được deal hời, chia sẻ liền cho cả nhà!",
    "✨ Món này đang giá tốt, ai cần thì vào ngay nhé!",
    "🎁 Săn được món hời quá, không khoe không chịu được!",
  ]);
}

/** Câu chốt kêu gọi — nhiều biến thể. */
function closingLine(deal) {
  if (deal.dealEndTime) {
    return pickBy(deal.id + "c", [
      "Số lượng & thời gian có hạn, chốt nhanh nha 👇",
      "Deal hết hạn là tiếc lắm đó, vào liền nha 👇",
    ]);
  }
  return pickBy(deal.id + "c", [
    "Thấy hời thì múc liền tay nha cả nhà 👇",
    "Ưng bụng thì chốt đơn luôn nè 👇",
    "Ai đang cần món này thì đừng bỏ lỡ nha 👇",
  ]);
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
  const opener = pickBy(deal.id + "f", [
    `Ê, món 「${shortName(deal.itemName, 34)}」 đang sale nè!`,
    `Nè nè, 「${shortName(deal.itemName, 34)}」 đang giá hời lắm!`,
    `Tìm thấy deal ngon nè: 「${shortName(deal.itemName, 34)}」!`,
  ]);
  return [
    opener,
    `Giá ${formatPrice(deal.currentPrice)}${pt}, tính ra chỉ còn khoảng ${formatPrice(deal.effectivePrice)}${deal.savingsPercent > 0 ? ` (rẻ hơn ${deal.savingsPercent}%)` : ""}.`,
    rv,
    `Link nè: ${link}`,
    `(※ affiliate link nhé, mua ủng hộ mình xíu 😄)`,
  ].filter(Boolean).join("\n");
}

module.exports = { HASHTAGS, shortName, priceLine, fallbackFacebook, fallbackFriend };
