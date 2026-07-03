"use strict";

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../utils/config");
const { ensureDir } = require("../utils/helpers");
const logger = require("../utils/logger");

/**
 * Quota tracker — đếm số lần gọi Gemini theo NGÀY (múi giờ JST, khớp reset của Google).
 *
 * File: data/gemini-usage.json  → { "2026-07-03": 42, ... }
 * - Đếm MỌI lần thử gọi (kể cả bị 429) → ước lượng thiên về an toàn.
 * - Warning khi vượt 80% hạn mức; CHẶN CỨNG khi chạm 95% (chừa chỗ cho retry lẻ)
 *   → generator tự fallback template, không bao giờ vượt free tier.
 */

function usagePath() {
  const cfg = loadConfig();
  ensureDir(cfg.paths.data);
  return path.join(cfg.paths.data, "gemini-usage.json");
}

function todayKey() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD
}

function loadUsage() {
  try {
    return JSON.parse(fs.readFileSync(usagePath(), "utf8"));
  } catch {
    return {};
  }
}

function saveUsage(u) {
  // Chỉ giữ 14 ngày gần nhất cho gọn.
  const keys = Object.keys(u).sort().slice(-14);
  const trimmed = {};
  for (const k of keys) trimmed[k] = u[k];
  fs.writeFileSync(usagePath(), JSON.stringify(trimmed, null, 2), "utf8");
}

/** Số request đã dùng hôm nay. */
function getTodayCount() {
  return loadUsage()[todayKey()] || 0;
}

/** Hạn mức/ngày từ config (mặc định 250 — free tier gemini-2.5-flash). */
function getDailyLimit() {
  const cfg = loadConfig();
  return cfg.content?.dailyQuota || 250;
}

let warned80 = false;

/** Ghi nhận 1 lần gọi API. Log warning khi vượt 80% hạn mức. */
function countCall() {
  const u = loadUsage();
  const k = todayKey();
  u[k] = (u[k] || 0) + 1;
  saveUsage(u);

  const limit = getDailyLimit();
  if (!warned80 && u[k] >= limit * 0.8 && u[k] < limit * 0.95) {
    warned80 = true;
    logger.warn(`⚠️ Gemini đã dùng ${u[k]}/${limit} request hôm nay (≥80% free tier)`);
  }
  return u[k];
}

/** Còn được phép gọi AI không? (chặn từ 95% để chừa chỗ retry) */
function canCall() {
  const used = getTodayCount();
  const limit = getDailyLimit();
  if (used >= Math.floor(limit * 0.95)) {
    return false;
  }
  return true;
}

module.exports = { countCall, canCall, getTodayCount, getDailyLimit };
