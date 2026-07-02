"use strict";

const { getRandomUA, sleep } = require("../utils/helpers");
const logger = require("../utils/logger");

/**
 * Tiện ích dùng chung cho scraper.
 *
 * Phát hiện quan trọng (Phase 1): trang search.rakuten.co.jp trả HTML tĩnh
 * (status 200) có nhúng sẵn JSON trong `window.__INITIAL_STATE__`. Danh sách
 * sản phẩm nằm ở state.data.ichibaSearch.items. => KHÔNG cần Playwright/JS render,
 * chỉ cần fetch + trích JSON. Ổn định hơn nhiều so với parse CSS selector.
 */

/** Fetch có retry + timeout + User-Agent giả. */
async function fetchWithRetry(url, { userAgents = [], retries = 3, timeoutMs = 20000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": getRandomUA(userAgents),
          "Accept-Language": "ja-JP,ja;q=0.9",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      clearTimeout(t);
      if (res.status === 429 || res.status === 503) {
        throw new Error(`Bị giới hạn tốc độ (HTTP ${res.status})`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      logger.warn(`fetch lỗi (thử ${attempt}/${retries}): ${err.message} — ${url}`);
      if (attempt < retries) await sleep(2000 * attempt);
    }
  }
  throw lastErr;
}

/** Trích 1 object JSON gán cho `window.<KEY>` bằng cân bằng ngoặc (an toàn với chuỗi). */
function extractInitialState(html, key = "window.__INITIAL_STATE__") {
  const i = html.indexOf(key);
  if (i === -1) return null;
  const start = html.indexOf("{", i);
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let p = start; p < html.length; p++) {
    const c = html[p];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) { end = p + 1; break; }
    }
  }
  if (end === -1) return null;
  try {
    return JSON.parse(html.slice(start, end));
  } catch (e) {
    logger.warn(`Parse INITIAL_STATE thất bại: ${e.message}`);
    return null;
  }
}

/** Dựng URL search Rakuten. */
function buildSearchUrl(keyword, { page = 1 } = {}) {
  const base = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`;
  return page > 1 ? `${base}?p=${page}` : base;
}

/**
 * Dựng URL search lọc sẵn Super DEAL theo bậc point-back.
 * Nguồn: trang superdeal trỏ tới search.rakuten.co.jp/search/mall/?mk=2026dealsearch{tier}&f=13
 * @param {number} tier  20 | 30 | 40 | 50 (% point back tối thiểu)
 */
function buildDealSearchUrl(tier, { page = 1 } = {}) {
  const base = `https://search.rakuten.co.jp/search/mall/?mk=2026dealsearch${tier}&f=13`;
  return page > 1 ? `${base}&p=${page}` : base;
}

module.exports = { fetchWithRetry, extractInitialState, buildSearchUrl, buildDealSearchUrl };
