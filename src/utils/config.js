"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const CONFIG_PATH = path.join(ROOT, "config", "settings.json");

// Nạp .env nếu có (không bắt buộc ở Phase 0-4).
try {
  require("dotenv").config({ path: path.join(ROOT, ".env") });
} catch (_) {
  /* dotenv chưa cài hoặc chưa có .env — bỏ qua, Phase 0 không cần */
}

let cached = null;

/** Đọc & cache config từ config/settings.json. */
function loadConfig() {
  if (cached) return cached;
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Không tìm thấy config: ${CONFIG_PATH}`);
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    throw new Error(`config/settings.json không phải JSON hợp lệ: ${e.message}`);
  }
  validate(cfg);
  cfg.paths = {
    root: ROOT,
    assets: path.join(ROOT, "assets"),
    mascot: path.join(ROOT, "assets", "mascot"),
    data: path.join(ROOT, "data"),
    output: path.resolve(ROOT, cfg.output?.dir || "./output"),
  };
  cfg.secrets = {
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
    telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || "",
  };
  cached = cfg;
  return cfg;
}

function validate(cfg) {
  const errors = [];
  if (!cfg.scoring || typeof cfg.scoring.threshold !== "number") {
    errors.push("scoring.threshold thiếu hoặc không phải số");
  }
  if (!cfg.output || !cfg.output.sink) {
    errors.push("output.sink thiếu");
  }
  if (errors.length) {
    throw new Error("Config không hợp lệ:\n - " + errors.join("\n - "));
  }
}

module.exports = { loadConfig, CONFIG_PATH, ROOT };
