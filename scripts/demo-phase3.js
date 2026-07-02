"use strict";

/**
 * DEMO Phase 3 — Content + Image.
 * Nạp 4 sản phẩm từ data/fixtures/demo-4.json → sinh Facebook post + message bạn bè
 * (template free, hoặc Gemini nếu bật) + ảnh promo ghép mascot → render output/index.html.
 *
 * Chạy:  node scripts/demo-phase3.js
 * (Chưa có demo-4.json thì chạy: node scripts/demo-phase2.js trước.)
 */

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../src/utils/config");
const { generateContent } = require("../src/content/ai-generator");
const { createPromoImage, selectMascotPose } = require("../src/content/image-maker");
const { createSink } = require("../src/output");
const logger = require("../src/utils/logger");

async function main() {
  const config = loadConfig();
  const fixture = path.join(config.paths.data, "fixtures", "demo-4.json");
  if (!fs.existsSync(fixture)) {
    throw new Error(`Chưa có ${fixture}. Chạy "node scripts/demo-phase2.js" trước.`);
  }
  const deals = JSON.parse(fs.readFileSync(fixture, "utf8"));
  logger.info(`Nạp ${deals.length} deal. AI=${config.content.useAI ? "Gemini" : "template (free)"}`);

  const sink = createSink(config);
  await sink.init();

  for (const deal of deals) {
    const content = await generateContent(deal, config);
    const pose = selectMascotPose(deal);
    let image = null;
    try {
      image = await createPromoImage(deal, pose);
    } catch (err) {
      logger.error(`Ảnh lỗi (${deal.id}): ${err.message}`);
    }
    await sink.sendDeal(deal, content, image);
    logger.info(`   ✅ ${deal.genreName} | pose=${pose} | content via ${content.via}`);
  }

  const indexPath = await sink.close();
  logger.info(`🏁 Xem: ${indexPath}`);
}

main().catch((err) => {
  logger.error(err.stack || err.message);
  process.exit(1);
});
