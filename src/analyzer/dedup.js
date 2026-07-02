"use strict";

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../utils/config");
const { ensureDir } = require("../utils/helpers");

/**
 * Dedup registry — nhớ các deal đã "gửi" để không lặp lại.
 * Lưu ở data/sent_deals.json: { "<id>": "<ISO time>" }.
 */
function registryPath() {
  const cfg = loadConfig();
  ensureDir(cfg.paths.data);
  return path.join(cfg.paths.data, "sent_deals.json");
}

function loadRegistry() {
  const file = registryPath();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function saveRegistry(reg) {
  fs.writeFileSync(registryPath(), JSON.stringify(reg, null, 2), "utf8");
}

function isDuplicate(id) {
  return Object.prototype.hasOwnProperty.call(loadRegistry(), id);
}

function markAsSent(id) {
  const reg = loadRegistry();
  reg[id] = new Date().toISOString();
  saveRegistry(reg);
}

/** Lọc bỏ các deal đã gửi. */
function filterNew(deals) {
  const reg = loadRegistry();
  return deals.filter((d) => !Object.prototype.hasOwnProperty.call(reg, d.id));
}

module.exports = { isDuplicate, markAsSent, filterNew, loadRegistry };
