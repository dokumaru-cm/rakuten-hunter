"use strict";

/**
 * Rakuten Hunter — Orchestrator (Phase 4).
 *
 * Nối toàn bộ pipeline thành 1 lệnh:
 *   scrape → score → dedup → filter → content(AI/template) → image → OutputSink
 *
 * Chạy:
 *   npm start                 # full pipeline, có dedup (bỏ deal đã gửi)
 *   npm run run:fresh         # bỏ qua dedup (demo/chạy lại) — không ghi registry
 *   node src/index.js --no-dedup --max 6 --sources superdeal
 *
 * Đầu ra hiện tại: LocalSink (output/index.html). Phase 5 chỉ đổi output.sink="telegram".
 */

const { loadConfig } = require("./utils/config");
const { scrapeAll } = require("./scraper");
const { scoreDeals, filterDeals } = require("./analyzer/scorer");
const { filterNew, markAsSent } = require("./analyzer/dedup");
const { generateContent } = require("./content/ai-generator");
const { createPromoImage, selectMascotPose } = require("./content/image-maker");
const { createSink } = require("./output");
const { sleep } = require("./utils/helpers");
const logger = require("./utils/logger");

function parseArgs(argv) {
  const opts = { dedup: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-dedup") opts.dedup = false;
    else if (a === "--max") opts.max = parseInt(argv[++i], 10);
    else if (a === "--sources") opts.sources = argv[++i].split(",");
    else if (a === "--keywords") opts.keywords = argv[++i].split(",");
  }
  return opts;
}

async function runPipeline(config, opts = {}) {
  const dedup = opts.dedup !== false;
  const threshold = config.scoring.threshold;
  const maxDeals = opts.max || config.scoring.maxDealsPerRun;

  // 1. Scrape
  logger.info("🕷️  [1/5] Scrape...");
  const products = await scrapeAll(config.scraping, {
    sources: opts.sources,
    keywords: opts.keywords,
  });
  if (products.length === 0) {
    logger.warn("Không scrape được sản phẩm nào. Dừng.");
    return;
  }

  // 2. Score
  logger.info("📊 [2/5] Chấm điểm...");
  let scored = scoreDeals(products);

  // 3. Dedup (bỏ deal đã gửi)
  if (dedup) {
    const before = scored.length;
    scored = filterNew(scored);
    logger.info(`🧹 [3/5] Dedup: ${before} → ${scored.length} (bỏ ${before - scored.length} deal đã gửi)`);
  } else {
    logger.info("🧹 [3/5] Dedup: BỎ QUA (--no-dedup)");
  }

  // 4. Filter theo ngưỡng + giới hạn + đa dạng shop
  const maxPerShop = config.scoring.maxPerShop || 1;
  const topDeals = filterDeals(scored, threshold, maxDeals, maxPerShop);
  const shops = new Set(topDeals.map((d) => d.shopName)).size;
  logger.info(`🎯 [4/5] Top deals: ${topDeals.length} (score ≥ ${threshold}, tối đa ${maxDeals}, ${shops} shop khác nhau)`);
  if (topDeals.length === 0) {
    logger.info("Không có deal mới đạt ngưỡng. Dừng.");
    return;
  }

  // 5. Content + Image → Sink
  logger.info("✍️  [5/5] Sinh content + ảnh → output...");
  const sink = createSink(config);
  await sink.init();

  let ok = 0;
  for (const deal of topDeals) {
    try {
      const content = await generateContent(deal, config);
      const pose = selectMascotPose(deal);
      let image = null;
      try {
        image = await createPromoImage(deal, pose);
      } catch (err) {
        logger.error(`   Ảnh lỗi (${deal.itemName.slice(0, 24)}): ${err.message}`);
      }
      await sink.sendDeal(deal, content, image);
      if (dedup) markAsSent(deal.id);
      ok++;
      logger.info(`   ✅ [${deal.score}] ${deal.genreName} — ${deal.itemName.slice(0, 34)} (via ${content.via})`);
      await sleep(300);
    } catch (err) {
      logger.error(`   ❌ ${deal.itemName.slice(0, 30)} — ${err.message}`);
    }
  }

  const result = await sink.close();
  logger.info(`🏁 Hoàn tất: ${ok}/${topDeals.length} deal. ${result ? "→ " + result : ""}`);
}

async function main() {
  const config = loadConfig();
  const opts = parseArgs(process.argv.slice(2));
  logger.info(`▶️  Rakuten Hunter | sink=${config.output.sink} | AI=${config.content.useAI ? "gemini" : "template"} | dedup=${opts.dedup}`);
  await runPipeline(config, opts);
}

if (require.main === module) {
  main().catch((err) => {
    logger.error(err.stack || err.message);
    process.exit(1);
  });
}

module.exports = { runPipeline };
