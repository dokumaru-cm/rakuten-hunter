# 📋 Rakuten Hunter V1 — Detailed Design

> **Ngày:** 2026-06-30  
> **Trạng thái:** Chờ duyệt  
> **Phụ thuộc:** Basic Design đã duyệt

---

## 1. Project Structure

```
rakuten-hunter/
├── package.json
├── .env                           # Secrets (Gemini key, Telegram token)
├── .env.example                   # Template
├── config/
│   └── settings.json              # All config (scraping, scoring, image...)
├── assets/
│   └── mascot/                    # User cung cấp
│       ├── mascot_pointing.png
│       ├── mascot_excited.png
│       ├── mascot_surprised.png
│       ├── mascot_winking.png
│       └── mascot_inviting.png
├── src/
│   ├── index.js                   # Entry point — orchestrator
│   ├── scraper/
│   │   ├── index.js               # scrapeAll(), scrapeTarget()
│   │   ├── superdeal.js           # Super DEAL page parser
│   │   ├── search.js              # Search results parser
│   │   ├── ranking.js             # Ranking page parser
│   │   └── helpers.js             # Shared scraping utils (delay, UA, etc)
│   ├── analyzer/
│   │   ├── scorer.js              # scoreDeals(), calculateScore()
│   │   └── dedup.js               # isDuplicate(), markAsSent()
│   ├── content/
│   │   ├── ai-generator.js        # generateContent() — Gemini
│   │   ├── image-maker.js         # createPromoImage() — node-canvas
│   │   └── templates.js           # Prompt templates, text fallbacks
│   ├── telegram/
│   │   ├── bot.js                 # Bot setup, sendDeal(), sendSummary()
│   │   └── formatter.js           # formatCaption(), formatCopyText()
│   └── utils/
│       ├── logger.js              # Console logging with timestamps
│       ├── config.js              # Load & validate config
│       └── helpers.js             # hash(), sleep(), formatPrice()
├── data/
│   ├── scraped/                   # Raw scraped data per run
│   │   └── 2026-06-30_09-00.json
│   ├── sent_deals.json            # Dedup registry
│   └── images/                    # Downloaded product images (temp)
├── scripts/
│   ├── run.js                     # Full flow (scrape→score→content→telegram)
│   ├── scrape-only.js             # Test scraping
│   ├── test-image.js              # Test image generation
│   └── test-telegram.js           # Test telegram sending
└── docs/
    ├── BASIC_DESIGN.md
    └── DETAILED_DESIGN.md         # This file
```

---

## 2. File-by-File Specifications

### 2.1 `src/index.js` — Orchestrator

```javascript
/**
 * Main entry point. Chạy full pipeline:
 * 1. Scrape all targets
 * 2. Score & filter deals
 * 3. Generate content (AI + Image)  
 * 4. Send to Telegram
 * 
 * Có thể chạy 1 lần (node src/index.js) 
 * hoặc schedule bằng cron (node scripts/run.js)
 */

async function main() {
  // 1. Load config
  const config = loadConfig();
  
  // 2. Scrape
  logger.info("🕷️ Starting scrape...");
  const products = await scrapeAll(config.scraping);
  logger.info(`Found ${products.length} products`);
  
  // 3. Score & Filter
  const scored = scoreDeals(products);
  const topDeals = filterDeals(scored, config.scoring.threshold, config.scoring.maxDealsPerRun);
  logger.info(`Top deals: ${topDeals.length} (threshold: ${config.scoring.threshold})`);
  
  if (topDeals.length === 0) {
    logger.info("No new deals. Exiting.");
    return;
  }
  
  // 4. Generate content + image for each deal
  for (const deal of topDeals) {
    try {
      const content = await generateContent(deal);
      const mascotPose = selectMascotPose(deal);
      const image = await createPromoImage(deal, mascotPose);
      await sendDeal(deal, content, image);
      markAsSent(deal.id);
      logger.info(`✅ Sent: ${deal.itemName} (score: ${deal.score})`);
      
      // Delay giữa các message để tránh spam
      await sleep(2000);
    } catch (err) {
      logger.error(`❌ Failed: ${deal.itemName} — ${err.message}`);
    }
  }
  
  logger.info("🏁 Done!");
}
```

### 2.2 `src/scraper/superdeal.js` — Super DEAL Parser

```javascript
/**
 * Scrape trang Super DEAL.
 * URL: https://event.rakuten.co.jp/superdeal/
 * 
 * Cấu trúc trang (cần verify khi implement):
 * - Mỗi sản phẩm nằm trong div/card có class cụ thể
 * - Chứa: tên, giá, point rate %, hình ảnh, link
 * 
 * Strategy:
 * 1. Dùng Playwright (trang render JS nặng)
 * 2. Wait cho content load
 * 3. Extract tất cả product cards
 * 4. Parse từng card → ScrapedProduct
 * 5. Filter theo genre nếu cần
 */

async function scrapeSuperDeal(options = {}) {
  const url = "https://event.rakuten.co.jp/superdeal/";
  
  // Dùng Playwright vì trang này render bằng JS
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set Japanese locale
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja-JP" });
  
  await page.goto(url, { waitUntil: "networkidle" });
  
  // Extract product cards
  // SELECTOR: Cần verify trên trang thật — placeholder
  const products = await page.evaluate(() => {
    const cards = document.querySelectorAll("[data-deal-item]"); // Placeholder selector
    return Array.from(cards).map(card => ({
      itemName: card.querySelector(".item-name")?.textContent?.trim(),
      itemUrl: card.querySelector("a")?.href,
      imageUrl: card.querySelector("img")?.src,
      currentPrice: parseInt(card.querySelector(".price")?.textContent?.replace(/[^0-9]/g, "")),
      pointRate: parseInt(card.querySelector(".point-rate")?.textContent?.replace(/[^0-9]/g, "")),
      // ... more fields
    }));
  });
  
  await browser.close();
  
  return products.map(p => ({
    ...p,
    id: hash(p.itemUrl),
    isSuperDeal: true,
    pointAmount: Math.floor(p.currentPrice * (p.pointRate || 0) / 100),
    sourcePage: "superdeal",
    scrapedAt: new Date().toISOString(),
  }));
}
```

> [!NOTE]
> **CSS Selectors là placeholder.** Khi implement Phase 1, cần mở trang thật và xác định selectors chính xác.

### 2.3 `src/scraper/search.js` — Search Results Parser

```javascript
/**
 * Scrape search results.
 * URL: https://search.rakuten.co.jp/search/mall/{keyword}/
 * 
 * Strategy:
 * 1. Dùng Cheerio (search page thường có HTML tĩnh)
 * 2. Parse search result cards
 * 3. Extract: tên, giá gốc, giá sale, discount%, reviews
 * 
 * Params:
 * - keyword: "半額", "タイムセール", "在庫処分"
 * - genreId: Genre filter (optional)
 * - maxPages: Max pages to scrape (default 3)
 */

async function scrapeSearch(keyword, options = {}) {
  const { genreId, maxPages = 3 } = options;
  const allProducts = [];
  
  for (let page = 1; page <= maxPages; page++) {
    const url = buildSearchUrl(keyword, genreId, page);
    
    await sleep(randomDelay(3000, 8000)); // Anti-detection
    
    const html = await fetchWithRetry(url, {
      headers: { "User-Agent": getRandomUA() }
    });
    
    const $ = cheerio.load(html);
    
    // Parse product cards
    // SELECTOR: Cần verify — placeholder
    $(".searchresultitem").each((i, el) => {
      const product = {
        itemName: $(el).find(".title").text().trim(),
        itemUrl: $(el).find("a").attr("href"),
        currentPrice: parsePrice($(el).find(".important").text()),
        originalPrice: parsePrice($(el).find(".strike").text()),
        imageUrl: $(el).find("img").attr("src"),
        reviewCount: parseInt($(el).find(".review-count").text()) || 0,
        reviewAverage: parseFloat($(el).find(".review-avg").text()) || 0,
        // ...
      };
      
      product.discountPercent = product.originalPrice 
        ? Math.round((1 - product.currentPrice / product.originalPrice) * 100)
        : 0;
      
      allProducts.push({
        ...product,
        id: hash(product.itemUrl),
        sourcePage: "search",
        scrapedAt: new Date().toISOString(),
      });
    });
  }
  
  return allProducts;
}
```

### 2.4 `src/analyzer/scorer.js` — Deal Scoring

```javascript
/**
 * Chấm điểm deal. Logic chi tiết:
 */

function calculateScore(product) {
  let score = 0;
  const breakdown = { discount: 0, point: 0, review: 0, priceRange: 0, urgency: 0 };
  
  // 1. DISCOUNT (max 30)
  const d = product.discountPercent || 0;
  if (d >= 50) breakdown.discount = 30;
  else if (d >= 40) breakdown.discount = 25;
  else if (d >= 30) breakdown.discount = 20;
  else if (d >= 20) breakdown.discount = 15;
  else if (d >= 10) breakdown.discount = 8;
  
  // 2. POINT BACK (max 25)
  const p = product.pointRate || 0;
  if (p >= 40) breakdown.point = 25;
  else if (p >= 30) breakdown.point = 20;
  else if (p >= 20) breakdown.point = 15;
  else if (p >= 10) breakdown.point = 10;
  else if (p >= 5) breakdown.point = 5;
  
  // 3. REVIEW (max 20)
  const rc = product.reviewCount || 0;
  const ra = product.reviewAverage || 0;
  if (rc >= 100 && ra >= 4.5) breakdown.review = 20;
  else if (rc >= 50 && ra >= 4.0) breakdown.review = 15;
  else if (rc >= 20 && ra >= 3.5) breakdown.review = 10;
  else if (rc >= 5 && ra >= 3.0) breakdown.review = 5;
  
  // 4. PRICE RANGE (max 15) — sweet spot analysis
  const price = product.currentPrice || 0;
  if (price >= 1000 && price <= 5000) breakdown.priceRange = 15;       // Impulse buy
  else if (price > 5000 && price <= 15000) breakdown.priceRange = 12;  // Mid
  else if (price > 15000 && price <= 50000) breakdown.priceRange = 8;  // High
  else if (price > 50000) breakdown.priceRange = 5;                    // Luxury
  else breakdown.priceRange = 3;                                        // Too cheap
  
  // 5. URGENCY (max 10)
  if (product.isSuperDeal) breakdown.urgency += 5;
  if (product.dealEndTime) breakdown.urgency += 5;
  
  score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  
  // Effective price
  const pointAmount = Math.floor(product.currentPrice * (product.pointRate || 0) / 100);
  const effectivePrice = product.currentPrice - pointAmount;
  const basePrice = product.originalPrice || product.currentPrice;
  
  return {
    ...product,
    score: Math.min(score, 100),
    scoreBreakdown: breakdown,
    effectivePrice,
    pointAmount,
    savings: basePrice - effectivePrice,
    savingsPercent: Math.round((1 - effectivePrice / basePrice) * 100),
  };
}
```

### 2.5 `src/content/ai-generator.js` — Gemini Content

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Sinh content cho 1 deal.
 */
async function generateContent(deal) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = `Bạn là chuyên gia viết content quảng bá deal shopping trên Rakuten cho cộng đồng người Việt tại Nhật.

Viết bằng tiếng Việt, giữ nguyên tên sản phẩm tiếng Nhật.
Phong cách: hào hứng nhưng không giả tạo, thông tin chính xác.

Thông tin sản phẩm:
- Tên: ${deal.itemName}
- Giá gốc: ¥${deal.originalPrice?.toLocaleString() || "N/A"}
- Giá sale: ¥${deal.currentPrice.toLocaleString()}
- Giảm: ${deal.discountPercent}%
- Point back: ${deal.pointRate}% (= ¥${deal.pointAmount.toLocaleString()})
- Giá thực tế: ¥${deal.effectivePrice.toLocaleString()}
- Tiết kiệm: ${deal.savingsPercent}%
- Review: ${deal.reviewAverage}/5 (${deal.reviewCount} đánh giá)
- ${deal.isSuperDeal ? "🏷️ Super DEAL" : ""}
- ${deal.dealEndTime ? "⏰ Có giới hạn thời gian" : ""}

Tạo 2 phiên bản:

1. FACEBOOK_POST (150-200 từ):
- Bắt đầu bằng 【PR】
- Có emoji hợp lý (🔥💰⭐ v.v.)
- Kết thúc: #PR #楽天 #お得 #楽天ROOM #スーパーDEAL
- Có chỗ placeholder [LINK] cho link sản phẩm

2. FRIEND_MESSAGE (50-80 từ):
- Tone tự nhiên, như nhắn tin cho bạn thân
- Ghi rõ "(※ affiliate link nhé 😄)" ở cuối
- Có chỗ placeholder [LINK] cho link

Trả về JSON:
{ "facebookPost": "...", "friendMessage": "..." }`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Parse JSON từ response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch[0]);
  
  return {
    dealId: deal.id,
    facebookPost: parsed.facebookPost.replace("[LINK]", deal.itemUrl),
    friendMessage: parsed.friendMessage.replace("[LINK]", deal.itemUrl),
    hashtags: ["#PR", "#楽天", "#お得", "#楽天ROOM", "#スーパーDEAL"],
    productLink: deal.itemUrl,
    generatedAt: new Date().toISOString(),
  };
}
```

### 2.6 `src/content/image-maker.js` — Promo Image

```javascript
const { createCanvas, loadImage } = require("canvas");
const path = require("path");

/**
 * Tạo ảnh promo 1200x628.
 * 
 * Layers:
 * 1. Background gradient (theo category)
 * 2. Product image (250x250, center-left area)
 * 3. Deal badge (top-left): "50% OFF!" 
 * 4. Text: product name, prices, reviews
 * 5. CTA bar (bottom)
 * 6. Mascot (bottom-right)
 */

const WIDTH = 1200;
const HEIGHT = 628;

const CATEGORY_COLORS = {
  gia_dung:       { from: "#FF6B35", to: "#FF4D4D" },
  thuc_pham:      { from: "#4CAF50", to: "#2E7D32" },
  my_pham:        { from: "#E91E63", to: "#AD1457" },
  quan_ao_tre_em: { from: "#42A5F5", to: "#1565C0" },
  do_choi_tre_em: { from: "#FF9800", to: "#E65100" },
  default:        { from: "#FF4D4D", to: "#FF8C00" },
};

async function createPromoImage(deal, mascotPose = "pointing") {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  
  // === Layer 1: Background Gradient ===
  const colors = CATEGORY_COLORS[deal.genre] || CATEGORY_COLORS.default;
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, colors.from);
  gradient.addColorStop(1, colors.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  // === Layer 2: Product Image ===
  try {
    const productImg = await loadImage(deal.imageUrl);
    // White background circle behind product
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(200, 280, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(productImg, 70, 150, 260, 260);
  } catch (e) {
    // Fallback: empty product area
  }
  
  // === Layer 3: Deal Badge ===
  const badgeText = deal.discountPercent >= 10 
    ? `${deal.discountPercent}% OFF!` 
    : `${deal.pointRate}% Point!`;
  
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 30, 30, 250, 60, 12);
  ctx.fill();
  ctx.fillStyle = colors.from;
  ctx.font = "bold 32px 'Noto Sans JP', sans-serif";
  ctx.fillText(`🔥 ${badgeText}`, 50, 72);
  
  // === Layer 4: Text Info ===
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px 'Noto Sans JP', sans-serif";
  ctx.fillText(truncate(deal.itemName, 25), 380, 160);
  
  // Price
  ctx.font = "22px 'Noto Sans JP', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  if (deal.originalPrice) {
    ctx.fillText(`¥${deal.originalPrice.toLocaleString()}`, 380, 210);
    // Strikethrough
    const textWidth = ctx.measureText(`¥${deal.originalPrice.toLocaleString()}`).width;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(380, 205);
    ctx.lineTo(380 + textWidth, 205);
    ctx.stroke();
  }
  
  ctx.fillStyle = "#FFEB3B";
  ctx.font = "bold 42px 'Noto Sans JP', sans-serif";
  ctx.fillText(`¥${deal.currentPrice.toLocaleString()}`, 380, 270);
  
  // Point back
  if (deal.pointRate > 0) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px 'Noto Sans JP', sans-serif";
    ctx.fillText(`+ ${deal.pointRate}% ポイントバック!`, 380, 310);
  }
  
  // Reviews
  if (deal.reviewCount > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "20px 'Noto Sans JP', sans-serif";
    ctx.fillText(`⭐ ${deal.reviewAverage}/5 (${deal.reviewCount}件)`, 380, 360);
  }
  
  // === Layer 5: CTA Bar ===
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, HEIGHT - 80, WIDTH, 80);
  ctx.fillStyle = "#FFEB3B";
  ctx.font = "bold 30px 'Noto Sans JP', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `実質 ¥${deal.effectivePrice.toLocaleString()}! Tiết kiệm ${deal.savingsPercent}%!`,
    WIDTH / 2 - 50, HEIGHT - 35
  );
  ctx.textAlign = "left";
  
  // === Layer 6: Mascot ===
  try {
    const mascotPath = path.join(__dirname, "../../assets/mascot", `mascot_${mascotPose}.png`);
    const mascotImg = await loadImage(mascotPath);
    ctx.drawImage(mascotImg, WIDTH - 250, HEIGHT - 330, 220, 280);
  } catch (e) {
    // No mascot available — skip
  }
  
  return canvas.toBuffer("image/png");
}
```

### 2.7 `src/telegram/bot.js` — Telegram Integration

```javascript
const TelegramBot = require("node-telegram-bot-api");

let bot;

function initBot(token) {
  bot = new TelegramBot(token, { polling: false });
}

/**
 * Gửi 1 deal vào Telegram channel.
 * Format: Photo + Caption
 */
async function sendDeal(channelId, deal, content, imageBuffer) {
  const caption = formatCaption(deal, content);
  
  // Gửi ảnh + caption
  await bot.sendPhoto(channelId, imageBuffer, {
    caption: caption,
    parse_mode: "HTML",
  });
}

/**
 * Format caption cho Telegram message.
 */
function formatCaption(deal, content) {
  const hotLabel = deal.score >= 85 ? "🔥🔥🔥 SIÊU HOT " : "";
  
  return `${hotLabel}📦 <b>${deal.itemName}</b>
<i>${deal.shopName || ""}</i>

💰 ${deal.originalPrice ? `<s>¥${deal.originalPrice.toLocaleString()}</s> → ` : ""}¥${deal.currentPrice.toLocaleString()} (${deal.discountPercent}% OFF)
🎯 Point back: ${deal.pointRate}% (= ¥${deal.pointAmount.toLocaleString()})
💎 <b>Giá thực tế: ¥${deal.effectivePrice.toLocaleString()}</b>
⭐ ${deal.reviewAverage}/5 (${deal.reviewCount} reviews)
${deal.dealEndTime ? `⏰ Hạn: ${formatDate(deal.dealEndTime)}` : ""}

━━━ 📋 COPY FACEBOOK ━━━
<code>${content.facebookPost}</code>

━━━ 💬 GỬI BẠN BÈ ━━━
<code>${content.friendMessage}</code>

🔗 ${content.productLink}`;
}
```

> [!TIP]
> Dùng `<code>` tag trong Telegram → user tap vào là **tự động copy** toàn bộ text. Rất tiện cho việc copy-paste lên Facebook.

### 2.8 `scripts/run.js` — Scheduled Runner

```javascript
const cron = require("node-cron");

// Schedule: 6 lần/ngày
const SCHEDULE = {
  "06:00": { targets: ["superdeal", "ranking"] },
  "09:00": { targets: ["superdeal", "search_half"] },
  "12:00": { targets: ["superdeal", "search_category"] },
  "15:00": { targets: ["superdeal", "search_timesale"] },
  "18:00": { targets: ["superdeal", "search_category"] },
  "21:00": { targets: ["superdeal", "search_half"], summary: true },
};

for (const [time, config] of Object.entries(SCHEDULE)) {
  const [hour, minute] = time.split(":");
  cron.schedule(`${minute} ${hour} * * *`, async () => {
    await runPipeline(config.targets);
    if (config.summary) await sendDailySummary();
  }, { timezone: "Asia/Tokyo" });
}
```

---

## 3. Error Handling

| Scenario | Handling |
|----------|----------|
| Scraping fails (network) | Retry 3 lần, delay 10s. Log error. Skip target. |
| Rakuten blocks request | Log warning. Tăng delay. Skip session. |
| Gemini API error | Fallback về template text (không dùng AI) |
| Image generation fails | Gửi message text-only (không ảnh) |
| Telegram send fails | Retry 2 lần. Log error. Lưu deal để gửi lại sau. |
| No deals found | Log. Không gửi gì. Chờ run tiếp. |

---

## 4. Fallback Content Template

Khi Gemini API không khả dụng, dùng template:

```javascript
const FALLBACK_FB_TEMPLATE = `【PR】🔥 {itemName}

💰 {originalPrice} → ¥{currentPrice} ({discountPercent}% OFF!)
🎯 Point back {pointRate}% → Thực tế chỉ ¥{effectivePrice}!
⭐ Review {reviewAverage}/5 ({reviewCount} đánh giá)

👉 {productLink}

#PR #楽天 #お得 #スーパーDEAL`;

const FALLBACK_FRIEND_TEMPLATE = `Ê, deal này ngon nè!
{itemName} chỉ ¥{currentPrice} + {pointRate}% point back
= thực tế ¥{effectivePrice}!
Link: {productLink}
(※ affiliate link nhé 😄)`;
```

---

## 5. Configuration File

```json
{
  "scraping": {
    "targets": {
      "superdeal": "https://event.rakuten.co.jp/superdeal/",
      "search_half": "https://search.rakuten.co.jp/search/mall/半額/",
      "search_timesale": "https://search.rakuten.co.jp/search/mall/タイムセール/",
      "ranking": "https://ranking.rakuten.co.jp/"
    },
    "genres": {
      "gia_dung": { "id": "100804", "keywords": ["キッチン", "掃除", "収納"] },
      "thuc_pham": { "id": "100227", "keywords": ["お菓子", "ドリンク", "米"] },
      "my_pham": { "id": "100939", "keywords": ["スキンケア", "メイク"] },
      "quan_ao_tre_em": { "id": "100533", "keywords": ["子供服", "ベビー服"] },
      "do_choi_tre_em": { "id": "101164", "keywords": ["知育玩具", "ゲーム"] }
    },
    "delays": { "minMs": 3000, "maxMs": 8000 },
    "maxPagesPerTarget": 3,
    "userAgents": [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    ]
  },
  "scoring": {
    "threshold": 70,
    "hotDealThreshold": 85,
    "maxDealsPerRun": 10
  },
  "content": {
    "language": "vi",
    "geminiModel": "gemini-2.0-flash"
  },
  "image": {
    "width": 1200,
    "height": 628,
    "mascotDir": "./assets/mascot/"
  },
  "schedule": {
    "timezone": "Asia/Tokyo",
    "runs": [
      { "cron": "0 6 * * *", "targets": ["superdeal", "ranking"] },
      { "cron": "0 9 * * *", "targets": ["superdeal", "search_half"] },
      { "cron": "0 12 * * *", "targets": ["superdeal", "search_category"] },
      { "cron": "0 15 * * *", "targets": ["superdeal", "search_timesale"] },
      { "cron": "0 18 * * *", "targets": ["superdeal", "search_category"] },
      { "cron": "0 21 * * *", "targets": ["superdeal", "search_half"], "summary": true }
    ]
  }
}
```

---

## 6. Dependencies (package.json)

```json
{
  "name": "rakuten-hunter",
  "version": "1.0.0",
  "description": "Rakuten deal hunter → Telegram channel",
  "main": "src/index.js",
  "scripts": {
    "start": "node scripts/run.js",
    "scrape": "node scripts/scrape-only.js",
    "test:image": "node scripts/test-image.js",
    "test:telegram": "node scripts/test-telegram.js",
    "dev": "node src/index.js"
  },
  "dependencies": {
    "axios": "^1.9.0",
    "cheerio": "^1.0.0",
    "playwright": "^1.48.0",
    "node-cron": "^3.0.3",
    "node-telegram-bot-api": "^0.66.0",
    "canvas": "^2.11.0",
    "@google/generative-ai": "^0.21.0",
    "dotenv": "^16.4.0"
  }
}
```

---

## 7. Implementation Tasks

### Phase 1: Setup + Scraper (Tuần 1)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 1.1 | Init project, npm install, cấu trúc thư mục | `package.json`, folders | 1h |
| 1.2 | Config module | `src/utils/config.js`, `config/settings.json` | 1h |
| 1.3 | Logger + helpers | `src/utils/logger.js`, `helpers.js` | 1h |
| 1.4 | Scraper helpers (delay, UA, fetch) | `src/scraper/helpers.js` | 2h |
| 1.5 | Super DEAL scraper | `src/scraper/superdeal.js` | 4h |
| 1.6 | Search scraper | `src/scraper/search.js` | 3h |
| 1.7 | Ranking scraper | `src/scraper/ranking.js` | 2h |
| 1.8 | Scraper orchestrator | `src/scraper/index.js` | 1h |
| 1.9 | Test: scrape-only script | `scripts/scrape-only.js` | 1h |

### Phase 2: Scoring + Dedup (Tuần 2)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 2.1 | Scoring algorithm | `src/analyzer/scorer.js` | 3h |
| 2.2 | Dedup system | `src/analyzer/dedup.js` | 2h |
| 2.3 | Test scoring với real data | Manual test | 2h |

### Phase 3: Content + Image (Tuần 3)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 3.1 | Gemini integration | `src/content/ai-generator.js` | 3h |
| 3.2 | Fallback templates | `src/content/templates.js` | 1h |
| 3.3 | Image maker (node-canvas) | `src/content/image-maker.js` | 5h |
| 3.4 | Mascot pose selection | Trong `image-maker.js` | 1h |
| 3.5 | Test image generation | `scripts/test-image.js` | 1h |

### Phase 4: Telegram + Orchestrator (Tuần 4)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 4.1 | Telegram bot setup | `src/telegram/bot.js` | 2h |
| 4.2 | Message formatter | `src/telegram/formatter.js` | 2h |
| 4.3 | Main orchestrator | `src/index.js` | 2h |
| 4.4 | Cron scheduler | `scripts/run.js` | 1h |
| 4.5 | End-to-end test | Manual test | 2h |

### Phase 5: Polish (Tuần 5-6)

| # | Task | Effort |
|---|------|--------|
| 5.1 | Điều chỉnh scoring threshold | 2h |
| 5.2 | Tinh chỉnh AI prompts | 2h |
| 5.3 | Cải thiện image layout | 2h |
| 5.4 | Error handling & retry | 2h |
| 5.5 | Documentation | 1h |

---

## 8. Mascot Asset Requirements

> [!IMPORTANT]
> Cần user cung cấp **trước Phase 3**:

| # | File | Mô tả | Format |
|---|------|-------|--------|
| 1 | `mascot_pointing.png` | Mascot chỉ tay sang trái | PNG, transparent, ~400x500px |
| 2 | `mascot_excited.png` | Mascot hào hứng (2 tay giơ lên) | PNG, transparent, ~400x500px |
| 3 | `mascot_surprised.png` | Mascot ngạc nhiên (miệng chữ O) | PNG, transparent, ~400x500px |
| 4 | `mascot_winking.png` | Mascot nháy mắt | PNG, transparent, ~400x500px |
| 5 | `mascot_inviting.png` | Mascot vẫy tay/chào mời | PNG, transparent, ~400x500px |

Nếu chưa có đủ 5 pose, có thể bắt đầu với 1 pose (pointing) và thêm dần.
