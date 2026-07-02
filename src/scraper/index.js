"use strict";

const { scrapeSearch } = require("./search");
const { scrapeSuperDeal } = require("./superdeal");
const { randomDelay } = require("../utils/helpers");
const logger = require("../utils/logger");

/**
 * Orchestrator scraper.
 * Nguồn hỗ trợ (đều đã verify chạy thật qua endpoint search):
 *   - superdeal: point-back 20~50% (mk=2026dealsearchNN&f=13)
 *   - search:    theo keyword (半額, タイムセール, ...)
 *
 * @param {object} scrapingConfig  = config.scraping
 * @param {object} opts { keywords, sources, tiers }
 */
async function scrapeAll(scrapingConfig, opts = {}) {
  const { delays, userAgents, maxPagesPerTarget = 1 } = scrapingConfig;
  const sources = opts.sources || ["superdeal", "search"];
  const keywords = opts.keywords || scrapingConfig.keywords || ["半額", "タイムセール"];

  const all = [];

  if (sources.includes("superdeal")) {
    try {
      const deals = await scrapeSuperDeal({
        tiers: opts.tiers,
        maxPages: maxPagesPerTarget,
        delays,
        userAgents,
      });
      all.push(...deals);
    } catch (err) {
      logger.error(`Scrape Super DEAL thất bại: ${err.message}`);
    }
  }

  if (sources.includes("search")) {
    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i];
      try {
        if (all.length > 0) await randomDelay(delays.minMs, delays.maxMs);
        const products = await scrapeSearch(kw, { maxPages: maxPagesPerTarget, delays, userAgents });
        all.push(...products);
      } catch (err) {
        logger.error(`Scrape keyword "${kw}" thất bại: ${err.message}`);
      }
    }
  }

  // Dedup theo id. Ưu tiên bản superdeal (point rate cao hơn) khi trùng.
  const byId = new Map();
  for (const p of all) {
    const prev = byId.get(p.id);
    if (!prev) byId.set(p.id, p);
    else if (p.sourcePage === "superdeal" && prev.sourcePage !== "superdeal") byId.set(p.id, p);
  }
  const deduped = [...byId.values()];
  logger.info(`Tổng ${all.length} → sau dedup ${deduped.length} sản phẩm`);
  return deduped;
}

module.exports = { scrapeAll, scrapeSearch, scrapeSuperDeal };
