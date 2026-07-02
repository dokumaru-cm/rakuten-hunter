"use strict";

const { fetchWithRetry, extractInitialState, buildSearchUrl } = require("./helpers");
const { hash, randomDelay } = require("../utils/helpers");
const logger = require("../utils/logger");

// Map genre id top-level của Rakuten → category nội bộ.
const GENRE_MAP = {
  100804: "gia_dung",
  100227: "thuc_pham",
  100939: "my_pham",
  100533: "quan_ao_tre_em",
  101164: "do_choi_tre_em",
};

/** Chọn category nội bộ từ mảng genres của item. */
function mapGenre(genres = []) {
  for (const g of genres) {
    if (GENRE_MAP[g.id]) return GENRE_MAP[g.id];
  }
  return "other";
}

/** Nhãn category đọc được (top-level Rakuten) — dùng để phân biệt "loại sản phẩm". */
function genreLabel(genres = []) {
  const top = genres.find((g) => Number(g.id) >= 100000 && g.name);
  return top ? top.name : "その他";
}

/** Ảnh: ưu tiên url, thay ${width}x${height} nếu là resizable. */
function pickImage(images = []) {
  const img = images[0];
  if (!img) return "";
  if (img.resizable_url) return img.resizable_url.replace("${width}x${height}", "600x600");
  return img.url || "";
}

/** 1 item JSON (ichibaSearch) → ScrapedProduct. */
function mapItem(it, sourcePage) {
  const price = Number(it.price) || 0;
  const pointCount = Number(it.point?.count) || 0;
  const pointRate = price > 0 ? Math.round((pointCount / price) * 100) : 0;
  const itemUrl = it.url || it.originalItemUrl || "";

  return {
    id: hash(itemUrl),
    itemUrl,
    itemName: it.name || "",
    shopName: it.shop?.name || "",
    imageUrl: pickImage(it.images),
    genre: mapGenre(it.genres),
    genreName: genreLabel(it.genres),
    currentPrice: price,
    // Search JSON không expose giá gốc → null (design đã lường trước).
    originalPrice: null,
    discountPercent: 0,
    pointRate,
    pointAmount: pointCount,
    // Super DEAL nhận biết qua dealMultiplier (search thường không có; page superdeal sẽ có).
    isSuperDeal: Boolean(it.point?.dealMultiplier),
    reviewCount: Number(it.review?.numReviews) || 0,
    reviewAverage: Number(it.review?.score) || 0,
    dealEndTime: it.sale?.end || null,
    scrapedAt: new Date().toISOString(),
    sourcePage,
    isSoldOut: Boolean(it.isSoldOut),
  };
}

/**
 * Fetch 1 URL search (bất kỳ dạng nào của search.rakuten.co.jp) → ScrapedProduct[].
 * Dùng chung cho search theo keyword lẫn Super DEAL (mk=...dealsearch...).
 * Trả null nếu không tìm thấy items (để caller quyết định dừng vòng lặp).
 *
 * @param {string} url
 * @param {string} sourcePage  "search" | "superdeal"
 * @param {object} opts { userAgents }
 * @returns {Promise<ScrapedProduct[]|null>}
 */
async function fetchAndMap(url, sourcePage, opts = {}) {
  const { userAgents = [] } = opts;
  const html = await fetchWithRetry(url, { userAgents });
  const state = extractInitialState(html);
  const items = state?.state?.data?.ichibaSearch?.items;
  if (!Array.isArray(items)) return null;
  return items.filter((it) => !it.isSoldOut).map((it) => mapItem(it, sourcePage));
}

/**
 * Scrape 1 keyword search.
 * @param {string} keyword  vd "半額", "タイムセール"
 * @param {object} opts { maxPages, delays, userAgents }
 * @returns {Promise<ScrapedProduct[]>}
 */
async function scrapeSearch(keyword, opts = {}) {
  const { maxPages = 1, delays = { minMs: 3000, maxMs: 8000 }, userAgents = [] } = opts;
  const out = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = buildSearchUrl(keyword, { page });
    if (page > 1) await randomDelay(delays.minMs, delays.maxMs);

    logger.info(`🕷️  search "${keyword}" p${page} → ${url}`);
    const mapped = await fetchAndMap(url, "search", { userAgents });
    if (!mapped) {
      logger.warn(`Không tìm thấy ichibaSearch.items (layout đổi?) — keyword "${keyword}" p${page}`);
      break;
    }
    out.push(...mapped);
    logger.info(`   +${mapped.length} sản phẩm (tổng ${out.length})`);
    if (mapped.length === 0) break;
  }

  return out;
}

module.exports = { scrapeSearch, fetchAndMap, mapItem, mapGenre, genreLabel };
