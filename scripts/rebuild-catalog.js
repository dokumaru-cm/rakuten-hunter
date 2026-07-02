"use strict";

/**
 * Dựng lại catalog output/index.html từ file scraped MỚI NHẤT — KHÔNG scrape lại.
 * Tiện khi chỉ chỉnh UI/scoring/ảnh. Mặc định không dedup (featured = top điểm).
 *
 * Chạy:  node scripts/rebuild-catalog.js [--gen 30]
 */

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../src/utils/config");
const { buildCatalog } = require("../src/index");
const logger = require("../src/utils/logger");

function latestScraped(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) throw new Error(`Chưa có file scraped. Chạy "npm run scrape" hoặc "npm start" trước.`);
  return path.join(dir, files[files.length - 1]);
}

async function main() {
  const config = loadConfig();
  const genIdx = process.argv.indexOf("--gen");
  const gen = genIdx >= 0 ? parseInt(process.argv[genIdx + 1], 10) : undefined;

  const src = latestScraped(path.join(config.paths.data, "scraped"));
  const products = JSON.parse(fs.readFileSync(src, "utf8"));
  logger.info(`Rebuild từ ${src} (${products.length} sản phẩm) — không scrape lại`);

  await buildCatalog(config, products, { dedup: false, gen });
}

main().catch((err) => { logger.error(err.stack || err.message); process.exit(1); });
