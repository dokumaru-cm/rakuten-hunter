"use strict";

/**
 * Deal Scorer — chấm điểm 0..100 cho mỗi sản phẩm.
 *
 * Điều chỉnh theo dữ liệu thật (Phase 1/1.5):
 *  - Nguồn search KHÔNG có originalPrice → discount suy ra từ TIÊU ĐỀ (半額/NN%OFF...).
 *  - Nguồn superdeal có point rate rất mạnh (20~50%) → trọng số point cao là hợp lý.
 */

/**
 * Suy ra % giảm giá từ tiêu đề sản phẩm.
 * Nhận diện: "半額" (=50%), "NN%OFF", "NN％オフ", "最大NN%OFF".
 * Bỏ qua "NNポイントバック"/"NN倍" (đó là point, không phải discount).
 * @returns {number} 0..90
 */
function parseDiscountFromTitle(name = "") {
  if (!name) return 0;
  let best = 0;

  // NN%OFF / NN％OFF / NN%オフ (không đứng ngay trước "ポイント")
  const re = /(\d{1,2})\s*[%％]\s*(?:OFF|off|Off|オフ)/g;
  let m;
  while ((m = re.exec(name)) !== null) {
    const v = parseInt(m[1], 10);
    if (v > best && v <= 90) best = v;
  }

  // 半額 → 50% (chỉ khi chưa có số cao hơn)
  if (/半額/.test(name)) best = Math.max(best, 50);

  return best;
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/**
 * Chấm điểm 1 sản phẩm → ScoredDeal (giữ nguyên field gốc + thêm điểm & giá dẫn xuất).
 */
function calculateScore(product) {
  const breakdown = { discount: 0, point: 0, review: 0, priceRange: 0, urgency: 0 };

  // discount: ưu tiên field có sẵn, nếu 0 thì suy từ tiêu đề.
  let discount = Number(product.discountPercent) || 0;
  if (discount === 0) discount = parseDiscountFromTitle(product.itemName);

  // 1. DISCOUNT (max 30)
  if (discount >= 50) breakdown.discount = 30;
  else if (discount >= 40) breakdown.discount = 25;
  else if (discount >= 30) breakdown.discount = 20;
  else if (discount >= 20) breakdown.discount = 15;
  else if (discount >= 10) breakdown.discount = 8;

  // 2. POINT BACK (max 25)
  const p = Number(product.pointRate) || 0;
  if (p >= 40) breakdown.point = 25;
  else if (p >= 30) breakdown.point = 20;
  else if (p >= 20) breakdown.point = 15;
  else if (p >= 10) breakdown.point = 10;
  else if (p >= 5) breakdown.point = 5;

  // 3. REVIEW (max 20)
  const rc = Number(product.reviewCount) || 0;
  const ra = Number(product.reviewAverage) || 0;
  if (rc >= 100 && ra >= 4.5) breakdown.review = 20;
  else if (rc >= 50 && ra >= 4.0) breakdown.review = 15;
  else if (rc >= 20 && ra >= 3.5) breakdown.review = 10;
  else if (rc >= 5 && ra >= 3.0) breakdown.review = 5;

  // 4. PRICE RANGE (max 15)
  const price = Number(product.currentPrice) || 0;
  if (price >= 1000 && price <= 5000) breakdown.priceRange = 15;
  else if (price > 5000 && price <= 15000) breakdown.priceRange = 12;
  else if (price > 15000 && price <= 50000) breakdown.priceRange = 8;
  else if (price > 50000) breakdown.priceRange = 5;
  else breakdown.priceRange = 3;

  // 5. URGENCY (max 10)
  if (product.isSuperDeal) breakdown.urgency += 5;
  if (product.dealEndTime) breakdown.urgency += 5;

  const score = clamp(Object.values(breakdown).reduce((a, b) => a + b, 0), 0, 100);

  // Giá dẫn xuất.
  const pointAmount = Number(product.pointAmount) || Math.floor((price * p) / 100);
  const effectivePrice = Math.max(0, price - pointAmount);
  // Nếu thiếu giá gốc nhưng suy được discount → ước lượng giá gốc.
  let basePrice = product.originalPrice;
  if (!basePrice && discount > 0 && discount < 100) {
    basePrice = Math.round(price / (1 - discount / 100));
  }
  basePrice = basePrice || price;
  const savings = Math.max(0, basePrice - effectivePrice);
  const savingsPercent = basePrice > 0 ? Math.round((1 - effectivePrice / basePrice) * 100) : 0;

  return {
    ...product,
    discountPercent: discount,
    originalPrice: product.originalPrice || (discount > 0 ? basePrice : null),
    score,
    scoreBreakdown: breakdown,
    pointAmount,
    effectivePrice,
    savings,
    savingsPercent,
  };
}

/** Chấm điểm cả mảng, sort giảm dần. */
function scoreDeals(products) {
  return products.map(calculateScore).sort((a, b) => b.score - a.score);
}

/**
 * Lọc theo ngưỡng + giới hạn số lượng, RẢI ĐỀU theo shop (round-robin).
 *
 * Thuật toán: duyệt nhiều vòng với "hạn mức/shop" tăng dần (cap = maxPerShop, +1, +1...).
 * Mỗi vòng chỉ nhận thêm 1 sản phẩm/shop. Nhờ vậy mọi shop có deal đều được 1 suất
 * TRƯỚC khi bất kỳ shop nào có suất thứ 2 → đa dạng tối đa có thể; chỉ lặp shop khi
 * buộc phải bù cho đủ maxDeals.
 * @param {ScoredDeal[]} deals  đã sort giảm dần theo score
 */
function filterDeals(deals, threshold = 70, maxDeals = 10, maxPerShop = 1) {
  const eligible = deals.filter((d) => d.score >= threshold);
  const picked = [];
  const chosen = new Set();
  const shopCount = new Map();

  let cap = Math.max(1, maxPerShop);
  while (picked.length < maxDeals && cap <= maxDeals) {
    let addedThisRound = 0;
    for (const d of eligible) {
      if (picked.length >= maxDeals) break;
      if (chosen.has(d)) continue;
      const shop = d.shopName || "(unknown)";
      const c = shopCount.get(shop) || 0;
      if (c < cap) {
        picked.push(d);
        chosen.add(d);
        shopCount.set(shop, c + 1);
        addedThisRound++;
      }
    }
    if (addedThisRound === 0) cap++; // không còn shop nào dưới cap → nới hạn mức
  }

  return picked.slice(0, maxDeals);
}

module.exports = { calculateScore, scoreDeals, filterDeals, parseDiscountFromTitle };
