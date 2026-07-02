"use strict";

const { buildDealSearchUrl } = require("./helpers");
const { fetchAndMap } = require("./search");
const { randomDelay } = require("../utils/helpers");
const logger = require("../utils/logger");

// Các bậc point-back của Super DEAL (cao → thấp). mk=2026dealsearch{tier}&f=13
const DEFAULT_TIERS = [50, 40, 30, 20];

/**
 * Scrape Super DEAL qua endpoint search đã lọc sẵn point-back.
 *
 * Phát hiện Phase 1.5: trang event.rakuten.co.jp/superdeal/ là JS-render (không có
 * INITIAL_STATE), nhưng nó trỏ tới các URL search.rakuten.co.jp/search/mall/?mk=2026dealsearchNN&f=13
 * — mà endpoint search LẠI có sẵn __INITIAL_STATE__.ichibaSearch.items. Nên ta lấy
 * trực tiếp qua đó, không cần Playwright. Item có point.dealMultiplier + point.count
 * → tính được point rate thật (20~50%).
 *
 * @param {object} opts { tiers, maxPages, delays, userAgents }
 * @returns {Promise<ScrapedProduct[]>}
 */
async function scrapeSuperDeal(opts = {}) {
  const {
    tiers = DEFAULT_TIERS,
    maxPages = 1,
    delays = { minMs: 3000, maxMs: 8000 },
    userAgents = [],
  } = opts;

  const out = [];
  let first = true;

  for (const tier of tiers) {
    for (let page = 1; page <= maxPages; page++) {
      if (!first) await randomDelay(delays.minMs, delays.maxMs);
      first = false;

      const url = buildDealSearchUrl(tier, { page });
      logger.info(`🕷️  superdeal ${tier}% p${page} → ${url}`);

      let mapped;
      try {
        mapped = await fetchAndMap(url, "superdeal", { userAgents });
      } catch (err) {
        logger.error(`   superdeal ${tier}% p${page} lỗi: ${err.message}`);
        break;
      }
      if (!mapped) {
        logger.warn(`   Không có items (tier ${tier}, p${page}) — dừng tier này`);
        break;
      }
      out.push(...mapped);
      logger.info(`   +${mapped.length} sản phẩm (tổng ${out.length})`);
      if (mapped.length === 0) break;
    }
  }

  // Dedup trong nội bộ super deal (1 sp có thể ở nhiều bậc).
  const seen = new Set();
  const deduped = out.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  logger.info(`Super DEAL: ${out.length} → sau dedup ${deduped.length}`);
  return deduped;
}

module.exports = { scrapeSuperDeal, DEFAULT_TIERS };
