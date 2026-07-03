"use strict";

/**
 * Rakuten Hunter — Orchestrator (catalog mode).
 *
 * Pipeline: scrape → score → (dedup chọn featured) → build catalog.
 *   - HIỂN THỊ TẤT CẢ sản phẩm (không giới hạn 10) với đầy đủ thông tin sale/point,
 *     search / filter / sort ngay trong output/index.html.
 *   - Sinh ảnh promo mascot + bài Facebook/message cho `generateLimit` deal hot nhất
 *     (tránh render hàng trăm ảnh). Deal còn lại dùng thumbnail Rakuten + info.
 *
 * Chạy:
 *   npm start                        # catalog đầy đủ, featured = deal mới (dedup)
 *   npm run run:fresh                # không dedup (featured = top điểm, không ghi registry)
 *   node src/index.js --gen 50       # sinh bài+ảnh cho 50 deal
 *   node src/index.js --sources superdeal --keywords 半額,在庫処分
 */

const { loadConfig } = require("./utils/config");
const { scrapeAll } = require("./scraper");
const { scoreDeals } = require("./analyzer/scorer");
const { filterNew, markAsSent } = require("./analyzer/dedup");
const { generateContent } = require("./content/ai-generator");
const { createPromoImage, selectMascotPose } = require("./content/image-maker");
const { createSink } = require("./output");
const { sleep, ensureDir, stampForFilename } = require("./utils/helpers");
const fs = require("fs");
const path = require("path");
const logger = require("./utils/logger");

function parseArgs(argv) {
  const opts = { dedup: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-dedup") opts.dedup = false;
    else if (a === "--gen") opts.gen = parseInt(argv[++i], 10);
    else if (a === "--sources") opts.sources = argv[++i].split(",");
    else if (a === "--keywords") opts.keywords = argv[++i].split(",");
  }
  return opts;
}

async function runPipeline(config, opts = {}) {
  const snapshotPath = path.join(config.paths.data, "snapshot.json");

  // 1. Scrape (best-effort: IP trung tâm dữ liệu có thể bị Rakuten chặn).
  logger.info("🕷️  [1/4] Scrape...");
  let products = [];
  try {
    products = await scrapeAll(config.scraping, { sources: opts.sources, keywords: opts.keywords });
  } catch (e) {
    logger.warn(`Scrape lỗi: ${e.message}`);
  }

  if (products.length > 0) {
    // Scrape thành công → cập nhật snapshot (nguồn build dùng chung, commit vào repo).
    try {
      fs.writeFileSync(snapshotPath, JSON.stringify(products, null, 2), "utf8");
      const dir = ensureDir(path.join(config.paths.data, "scraped"));
      fs.writeFileSync(path.join(dir, `${stampForFilename()}.json`), JSON.stringify(products, null, 2), "utf8");
    } catch (e) {
      logger.warn(`Không lưu được snapshot: ${e.message}`);
    }
  } else {
    // Scrape 0 sản phẩm (thường do bị chặn IP trên CI) → fallback snapshot đã commit.
    logger.warn("Scrape 0 sản phẩm — thử dùng snapshot đã lưu (data/snapshot.json)...");
    if (fs.existsSync(snapshotPath)) {
      try {
        products = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
        logger.info(`📦 Dùng snapshot: ${products.length} sản phẩm (dữ liệu build lần trước)`);
      } catch (e) {
        logger.error(`Snapshot hỏng: ${e.message}`);
      }
    }
  }

  if (products.length === 0) {
    logger.warn("Không có dữ liệu (scrape lẫn snapshot đều trống). Dừng.");
    return;
  }
  return buildCatalog(config, products, opts);
}

/** Dựng catalog từ danh sách sản phẩm đã có (dùng lại được khi rebuild không scrape). */
async function buildCatalog(config, products, opts = {}) {
  const dedup = opts.dedup !== false;
  const genLimit = opts.gen || config.content.generateLimit || 30;

  // 2. Score toàn bộ
  logger.info("📊 [2/4] Chấm điểm toàn bộ...");
  const scored = scoreDeals(products); // đã sort điểm giảm dần

  // 3. Chọn featured để sinh ẢNH promo (deal mới nếu bật dedup). Content thì sinh cho TẤT CẢ.
  const pool = dedup ? filterNew(scored) : scored;
  const featured = new Set(pool.slice(0, genLimit).map((d) => d.id));
  logger.info(`✨ [3/4] Content: TẤT CẢ ${scored.length} · Ảnh promo: ${featured.size} deal hot${dedup ? " mới" : ""}`);

  // 4. Build catalog: content cho tất cả, ảnh cho featured
  logger.info("🖼️  [4/4] Dựng catalog (bài viết cho tất cả, ảnh mascot cho featured)...");
  const sink = createSink(config);
  await sink.init();

  let img = 0;
  let done = 0;
  const viaCount = { gemini: 0, cache: 0, template: 0 };
  for (const deal of scored) {
    try {
      const isFeatured = featured.has(deal.id);
      // Content cho MỌI sản phẩm (non-featured ép template để không gọi AI hàng loạt).
      const content = await generateContent(deal, config, { forceTemplate: !isFeatured });
      viaCount[content.via] = (viaCount[content.via] || 0) + 1;
      let image = null;
      if (isFeatured) {
        try {
          image = await createPromoImage(deal, selectMascotPose(deal));
        } catch (err) {
          logger.error(`   Ảnh lỗi (${deal.itemName.slice(0, 22)}): ${err.message}`);
        }
        if (dedup) markAsSent(deal.id);
        img++;
        // Throttle CHỈ khi vừa gọi Gemini thật (~10 req/phút free tier).
        // Cache hit / template thì không cần chờ.
        await sleep(content.via === "gemini" ? config.content.aiDelayMs || 5000 : 120);
      }
      await sink.sendDeal(deal, content, image);
      if (++done % 200 === 0) logger.info(`   ...đã xử lý ${done}/${scored.length}`);
    } catch (err) {
      logger.error(`   ❌ ${(deal.itemName || "").slice(0, 30)} — ${err.message}`);
    }
  }

  const result = await sink.close();
  const quota = require("./content/quota-tracker");
  logger.info(`🏁 Catalog: ${scored.length} sản phẩm, ${img} ảnh promo | AI mới: ${viaCount.gemini} · cache: ${viaCount.cache} · template: ${viaCount.template}`);
  if (config.content.useAI) {
    logger.info(`⚡ Quota Gemini hôm nay: ${quota.getTodayCount()}/${quota.getDailyLimit()} request`);
  }
  logger.info(`→ ${result}`);
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

module.exports = { runPipeline, buildCatalog };
