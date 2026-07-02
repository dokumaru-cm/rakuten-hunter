"use strict";

/**
 * Logger tối giản, in ra console kèm timestamp (giờ Nhật) + level màu.
 * Không phụ thuộc thư viện ngoài.
 */

const LEVELS = {
  debug: { label: "DEBUG", color: "\x1b[90m" },
  info: { label: "INFO ", color: "\x1b[36m" },
  warn: { label: "WARN ", color: "\x1b[33m" },
  error: { label: "ERROR", color: "\x1b[31m" },
};
const RESET = "\x1b[0m";

function ts() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function log(level, ...args) {
  const l = LEVELS[level] || LEVELS.info;
  // eslint-disable-next-line no-console
  console.log(`${l.color}[${ts()}] ${l.label}${RESET}`, ...args);
}

module.exports = {
  debug: (...a) => log("debug", ...a),
  info: (...a) => log("info", ...a),
  warn: (...a) => log("warn", ...a),
  error: (...a) => log("error", ...a),
};
