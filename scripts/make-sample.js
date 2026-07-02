"use strict";

/**
 * Chắt lọc từ file scraped mới nhất → bộ mẫu thực tế gọn (data/fixtures/real-deals.json)
 * và render ra output/index.html để xem bằng mắt.
 *
 * Chạy:  node scripts/make-sample.js [số_lượng]   (mặc định 15)
 */

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../src/utils/config");
const { createSink } = require("../src/output");
const { ensureDir, formatPrice } = require("../src/utils/helpers");
const logger = require("../src/utils/logger");

function latestScraped(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) throw new Error(`Chưa có file scraped nào trong ${dir}. Chạy "npm run scrape" trước.`);
  return path.join(dir, files[files.length - 1]);
}

async function main() {
  const config = loadConfig();
  const limit = Number(process.argv[2]) || 15;

  const scrapedDir = path.join(config.paths.data, "scraped");
  const src = latestScraped(scrapedDir);
  const all = JSON.parse(fs.readFileSync(src, "utf8"));
  logger.info(`Nguồn: ${src} (${all.length} sản phẩm)`);

  // Lọc: giá hợp lý, có review, ưu tiên đa dạng shop.
  const filtered = all
    .filter((p) => p.currentPrice >= 500 && p.currentPrice <= 30000 && p.reviewCount >= 50)
    .sort((a, b) => b.pointRate - a.pointRate || b.reviewCount - a.reviewCount);

  const seenShop = new Set();
  const sample = [];
  for (const p of filtered) {
    if (seenShop.has(p.shopName)) continue; // mỗi shop 1 sp cho đa dạng
    seenShop.add(p.shopName);
    sample.push(p);
    if (sample.length >= limit) break;
  }

  // Lưu bộ mẫu thực tế.
  const outFixture = path.join(ensureDir(path.join(config.paths.data, "fixtures")), "real-deals.json");
  fs.writeFileSync(outFixture, JSON.stringify(sample, null, 2), "utf8");
  logger.info(`💾 Bộ mẫu thực tế: ${sample.length} sản phẩm → ${outFixture}`);

  // Render ra output để xem (chưa có score/content — Phase 2/3).
  const sink = createSink(config);
  await sink.init();
  for (const p of sample) {
    await sink.sendDeal(p, {}, null);
    logger.info(`   • ${formatPrice(p.currentPrice)} | pt${p.pointRate}% | ⭐${p.reviewAverage}(${p.reviewCount}) | ${p.itemName.slice(0, 36)}`);
  }
  const indexPath = await sink.close();
  logger.info(`🏁 Xem: ${indexPath}`);
}

main().catch((err) => {
  logger.error(err.stack || err.message);
  process.exit(1);
});
