"use strict";

/**
 * Local server — xem catalog + tạo bài AI on-demand từng sản phẩm.
 *
 * Chạy:  npm run serve   → mở http://localhost:3210
 *
 * API:
 *   GET  /api/cache     → toàn bộ bài AI đã cache (trang tự hydrate khi load)
 *   GET  /api/quota     → { used, limit } quota Gemini hôm nay
 *   POST /api/generate  → { id } → sinh bài AI cho 1 sản phẩm, lưu cache, trả content
 *
 * Nút "⚡ Tạo bài AI" trên trang gọi các API này. Mở file index.html trực tiếp
 * (không qua server) thì nút sẽ báo cần chạy serve — mọi thứ khác vẫn hoạt động.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../src/utils/config");
const { calculateScore } = require("../src/analyzer/scorer");
const { generateContent } = require("../src/content/ai-generator");
const { allCached } = require("../src/content/content-cache");
const quota = require("../src/content/quota-tracker");
const logger = require("../src/utils/logger");

const PORT = 3210;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
};

function latestScraped(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

async function handleGenerate(req, res, config) {
  let body = "";
  for await (const chunk of req) body += chunk;
  let id;
  try {
    id = JSON.parse(body).id;
  } catch {
    return json(res, 400, { error: "Body phải là JSON { id }" });
  }
  if (!id) return json(res, 400, { error: "Thiếu id sản phẩm" });

  if (!config.content?.useAI || !config.secrets?.geminiApiKey) {
    return json(res, 503, { error: "AI đang tắt (useAI=false) hoặc thiếu GEMINI_API_KEY" });
  }

  const snapshotFile = latestScraped(path.join(config.paths.data, "scraped"));
  if (!snapshotFile) return json(res, 404, { error: "Chưa có dữ liệu scrape" });
  const products = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
  const product = products.find((p) => p.id === id);
  if (!product) return json(res, 404, { error: `Không tìm thấy sản phẩm ${id} trong snapshot mới nhất` });

  const deal = calculateScore(product);
  const content = await generateContent(deal, config); // cache-first, quota guard bên trong
  if (content.via === "template") {
    return json(res, 503, {
      error: `Không gọi được Gemini (quota hôm nay: ${quota.getTodayCount()}/${quota.getDailyLimit()} — nếu đã chạm ngưỡng thì chờ reset 0h JST)`,
    });
  }
  logger.info(`⚡ On-demand AI [${content.via}]: ${deal.itemName.slice(0, 40)}`);
  return json(res, 200, {
    facebookPost: content.facebookPost,
    friendMessage: content.friendMessage,
    via: content.via,
  });
}

async function main() {
  const config = loadConfig();
  const outDir = config.paths.output;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${PORT}`);

      if (url.pathname === "/api/cache") return json(res, 200, allCached());
      if (url.pathname === "/api/quota") {
        return json(res, 200, { used: quota.getTodayCount(), limit: quota.getDailyLimit() });
      }
      if (url.pathname === "/api/generate" && req.method === "POST") {
        return await handleGenerate(req, res, config);
      }

      // Static: phục vụ thư mục output/
      let file = path.join(outDir, decodeURIComponent(url.pathname));
      if (url.pathname === "/") file = path.join(outDir, "index.html");
      const resolved = path.resolve(file);
      if (!resolved.startsWith(path.resolve(outDir)) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        res.writeHead(404);
        return res.end("404");
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(resolved)] || "application/octet-stream" });
      fs.createReadStream(resolved).pipe(res);
    } catch (err) {
      logger.error(`serve lỗi: ${err.message}`);
      json(res, 500, { error: err.message });
    }
  });

  server.listen(PORT, () => {
    logger.info(`🌐 Catalog: http://localhost:${PORT}`);
    logger.info(`⚡ Quota Gemini hôm nay: ${quota.getTodayCount()}/${quota.getDailyLimit()}`);
    logger.info("Ctrl+C để dừng.");
  });
}

main().catch((err) => {
  logger.error(err.stack || err.message);
  process.exit(1);
});
