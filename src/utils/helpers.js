"use strict";

const crypto = require("crypto");
const fs = require("fs");

/** Hash ổn định từ string (dùng làm dedup key / id). */
function hash(str) {
  return crypto.createHash("sha1").update(String(str || "")).digest("hex").slice(0, 16);
}

/** Delay bất đồng bộ. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Số nguyên ngẫu nhiên trong [min, max]. */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Delay ngẫu nhiên (anti-detection cho scraper). */
function randomDelay(minMs, maxMs) {
  return sleep(randomInt(minMs, maxMs));
}

/** Chọn 1 User-Agent ngẫu nhiên từ danh sách. */
function getRandomUA(list = []) {
  if (!list.length) return "Mozilla/5.0";
  return list[randomInt(0, list.length - 1)];
}

/** Format giá kiểu ¥1,234. */
function formatPrice(n) {
  const v = Number(n) || 0;
  return "¥" + v.toLocaleString("ja-JP");
}

/** Cắt chuỗi + thêm … nếu dài. */
function truncate(str, max) {
  const s = String(str || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Đảm bảo thư mục tồn tại (mkdir -p). */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Timestamp ISO theo giờ Nhật, dùng đặt tên file (YYYY-MM-DD_HH-mm). */
function stampForFilename(date = new Date()) {
  const s = date.toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" }); // "YYYY-MM-DD HH:mm:ss"
  return s.slice(0, 16).replace(" ", "_").replace(":", "-");
}

/** Escape HTML để nhét text người dùng an toàn vào template. */
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  hash,
  sleep,
  randomInt,
  randomDelay,
  getRandomUA,
  formatPrice,
  truncate,
  ensureDir,
  stampForFilename,
  escapeHtml,
};
