"use strict";

/**
 * Test Phase 0: nạp deal fixture → đẩy qua sink → render output/index.html.
 * KHÔNG cần scraper, AI, Telegram hay bất kỳ tài khoản nào.
 *
 * Chạy:  npm run test:output   (rồi mở output/index.html)
 */

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../src/utils/config");
const { createSink } = require("../src/output");
const logger = require("../src/utils/logger");

async function main() {
  const config = loadConfig();
  const fixturePath = path.join(config.paths.data, "fixtures", "sample-deals.json");
  const deals = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  logger.info(`Nạp ${deals.length} deal fixture`);

  const sink = createSink(config);
  await sink.init();

  for (const deal of deals) {
    const content = {
      dealId: deal.id,
      facebookPost: deal.facebookPost,
      friendMessage: deal.friendMessage,
      productLink: deal.itemUrl,
    };
    // Phase 0 chưa có image-maker → truyền null (card hiện "Chưa có ảnh").
    await sink.sendDeal(deal, content, null);
  }

  const indexPath = await sink.close();
  logger.info(`🏁 Xong. Mở file: ${indexPath}`);
}

main().catch((err) => {
  logger.error(err.stack || err.message);
  process.exit(1);
});
