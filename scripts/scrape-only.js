"use strict";

/**
 * Chạy scraper thật, lưu kết quả raw vào data/scraped/<stamp>.json.
 * Không score, không content, không gửi đi đâu.
 *
 * Chạy:  npm run scrape
 *        npm run scrape -- 半額 タイムセール 在庫処分   (keyword tùy chọn)
 */

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../src/utils/config");
const { scrapeAll } = require("../src/scraper");
const { ensureDir, stampForFilename } = require("../src/utils/helpers");
const logger = require("../src/utils/logger");

async function main() {
  const config = loadConfig();
  const keywords = process.argv.slice(2);
  const opts = keywords.length ? { keywords } : {};

  const products = await scrapeAll(config.scraping, opts);

  const dir = ensureDir(path.join(config.paths.data, "scraped"));
  const file = path.join(dir, `${stampForFilename()}.json`);
  fs.writeFileSync(file, JSON.stringify(products, null, 2), "utf8");
  logger.info(`💾 Lưu ${products.length} sản phẩm → ${file}`);

  // In thử vài dòng đầu cho dễ kiểm tra.
  for (const p of products.slice(0, 5)) {
    logger.info(`   • ¥${p.currentPrice} | pt${p.pointRate}% | ⭐${p.reviewAverage}(${p.reviewCount}) | ${p.itemName.slice(0, 40)}`);
  }
}

main().catch((err) => {
  logger.error(err.stack || err.message);
  process.exit(1);
});
