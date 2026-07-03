"use strict";

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../utils/config");
const { ensureDir } = require("../utils/helpers");

/**
 * Content cache — lưu bài AI đã sinh theo deal id để KHÔNG gọi lại Gemini
 * cho cùng sản phẩm ở các lần chạy sau (tiết kiệm free tier).
 *
 * File: data/content-cache.json
 *   { "<dealId>": { facebookPost, friendMessage, price, generatedAt } }
 *
 * Entry bị coi là hết hạn khi:
 *   - quá TTL (config.content.cacheTtlDays, mặc định 7 ngày), hoặc
 *   - GIÁ sản phẩm đã đổi (nội dung cũ nêu giá sai → phải viết lại).
 */

function cachePath() {
  const cfg = loadConfig();
  ensureDir(cfg.paths.data);
  return path.join(cfg.paths.data, "content-cache.json");
}

let mem = null;

function loadCache() {
  if (mem) return mem;
  try {
    mem = JSON.parse(fs.readFileSync(cachePath(), "utf8"));
  } catch {
    mem = {};
  }
  return mem;
}

function persist() {
  fs.writeFileSync(cachePath(), JSON.stringify(loadCache(), null, 2), "utf8");
}

/** Lấy entry còn hiệu lực cho deal (đúng giá, chưa quá TTL). Trả null nếu không có. */
function getCached(deal, ttlDays = 7) {
  const e = loadCache()[deal.id];
  if (!e) return null;
  if (e.price !== deal.currentPrice) return null;
  const age = Date.now() - new Date(e.generatedAt).getTime();
  if (age > ttlDays * 24 * 3600 * 1000) return null;
  return e;
}

/** Lưu bài AI vừa sinh cho deal. */
function saveCached(deal, { facebookPost, friendMessage }) {
  loadCache()[deal.id] = {
    facebookPost,
    friendMessage,
    price: deal.currentPrice,
    generatedAt: new Date().toISOString(),
  };
  persist();
}

/** Dọn entry quá hạn (gọi định kỳ cho file khỏi phình). */
function pruneCache(ttlDays = 7) {
  const c = loadCache();
  const now = Date.now();
  let removed = 0;
  for (const [id, e] of Object.entries(c)) {
    if (now - new Date(e.generatedAt).getTime() > ttlDays * 24 * 3600 * 1000) {
      delete c[id];
      removed++;
    }
  }
  if (removed) persist();
  return removed;
}

/** Toàn bộ cache (cho API hydrate của local server). */
function allCached() {
  return loadCache();
}

module.exports = { getCached, saveCached, pruneCache, allCached };
