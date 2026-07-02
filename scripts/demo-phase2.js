"use strict";

/**
 * DEMO Phase 2 — Scorer.
 * Scrape gọn Super DEAL → chấm điểm 0..100 → chọn 4 sản phẩm KHÁC LOẠI (genre)
 * điểm cao nhất mỗi loại → lưu data/fixtures/demo-4.json + render output/index.html.
 *
 * Chạy:  node scripts/demo-phase2.js
 */

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../src/utils/config");
const { scrapeSuperDeal } = require("../src/scraper/superdeal");
const { scrapeSearch } = require("../src/scraper/search");
const { scoreDeals } = require("../src/analyzer/scorer");
const { createSink } = require("../src/output");
const { ensureDir, formatPrice } = require("../src/utils/helpers");
const logger = require("../src/utils/logger");

async function main() {
  const config = loadConfig();

  const { delays, userAgents } = config.scraping;

  // 1. Scrape gọn, đa nguồn để đa dạng loại: Super DEAL (4 bậc) + 2 keyword search.
  const products = [];
  products.push(...(await scrapeSuperDeal({ tiers: [50, 40, 30, 20], maxPages: 1, delays, userAgents })));
  products.push(...(await scrapeSearch("半額", { maxPages: 1, delays, userAgents })));
  products.push(...(await scrapeSearch("タイムセール", { maxPages: 1, delays, userAgents })));

  // 2. Chấm điểm.
  const scored = scoreDeals(products);
  logger.info(`Đã chấm điểm ${scored.length} sản phẩm`);

  // 3. Chọn 4 loại KHÁC NHAU: đa dạng theo genre nội bộ (gia_dung/thuc_pham/my_pham/...);
  //    với sp không map được (other) thì phân biệt bằng genreName. Mỗi nhóm tối đa 1 sp.
  const usedKeys = new Set();
  const picks = [];
  for (const d of scored) {
    if (d.currentPrice < 500 || d.currentPrice > 50000) continue;
    const key = d.genre && d.genre !== "other" ? d.genre : d.genreName;
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    picks.push(d);
    if (picks.length >= 4) break;
  }

  // 4. Lưu mẫu.
  const outFixture = path.join(ensureDir(path.join(config.paths.data, "fixtures")), "demo-4.json");
  fs.writeFileSync(outFixture, JSON.stringify(picks, null, 2), "utf8");

  // 5. In bảng điểm chi tiết.
  logger.info("──────── 4 SẢN PHẨM DEMO (khác loại) ────────");
  for (const d of picks) {
    const b = d.scoreBreakdown;
    logger.info(`[${d.genreName}] score ${d.score}/100  (disc ${b.discount} + pt ${b.point} + rev ${b.review} + price ${b.priceRange} + urg ${b.urgency})`);
    logger.info(`   ${d.itemName.slice(0, 50)}`);
    logger.info(`   ${formatPrice(d.currentPrice)} | giảm ${d.discountPercent}% | point ${d.pointRate}% = ${formatPrice(d.pointAmount)} | thực tế ${formatPrice(d.effectivePrice)} (tiết kiệm ${d.savingsPercent}%) | ⭐${d.reviewAverage}(${d.reviewCount})`);
  }

  // 6. Render output.
  const sink = createSink(config);
  await sink.init();
  for (const d of picks) await sink.sendDeal(d, {}, null);
  const indexPath = await sink.close();
  logger.info(`💾 Mẫu: ${outFixture}`);
  logger.info(`🏁 Xem: ${indexPath}`);
}

main().catch((err) => {
  logger.error(err.stack || err.message);
  process.exit(1);
});
