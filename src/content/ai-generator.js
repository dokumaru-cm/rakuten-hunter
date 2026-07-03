"use strict";

const { loadConfig } = require("../utils/config");
const { formatPrice } = require("../utils/helpers");
const { HASHTAGS, fallbackFacebook, fallbackFriend } = require("./templates");
const { getCached, saveCached } = require("./content-cache");
const quota = require("./quota-tracker");
const logger = require("../utils/logger");

let quotaBlockWarned = false;

/**
 * Sinh nội dung cho 1 deal → GeneratedContent.
 *
 * Thứ tự ưu tiên (tiết kiệm free tier tối đa):
 *   1. CACHE  — deal đã có bài AI (đúng giá, trong TTL) → dùng lại, 0 request.
 *   2. GEMINI — chỉ khi useAI=true, có key, CHƯA chạm 95% quota ngày.
 *   3. TEMPLATE — mặc định/fallback, miễn phí tức thì.
 *
 * options.forceTemplate: bỏ qua AI (dùng cho sản phẩm không-featured).
 */
async function generateContent(deal, cfg = null, options = {}) {
  const config = cfg || loadConfig();
  const link = resolveLink(deal, config);
  const ttlDays = config.content?.cacheTtlDays || 7;

  let facebookPost;
  let friendMessage;
  let via = "template";

  const aiEligible = config.content?.useAI && config.secrets?.geminiApiKey && !options.forceTemplate;

  // 1. Cache trước — không tốn request.
  if (aiEligible) {
    const cached = getCached(deal, ttlDays);
    if (cached) {
      facebookPost = cached.facebookPost;
      friendMessage = cached.friendMessage;
      via = "cache";
    }
  }

  // 2. Gemini — có quota guard.
  if (aiEligible && !facebookPost) {
    if (!quota.canCall()) {
      if (!quotaBlockWarned) {
        quotaBlockWarned = true;
        logger.warn(`🛑 Gemini đã chạm ngưỡng an toàn (${quota.getTodayCount()}/${quota.getDailyLimit()} hôm nay) — các bài còn lại dùng template. Reset 0h JST.`);
      }
    } else {
      try {
        const ai = await generateWithGeminiRetry(deal, link, config);
        facebookPost = ai.facebookPost;
        friendMessage = ai.friendMessage;
        via = "gemini";
        saveCached(deal, ai);
      } catch (err) {
        logger.warn(`Gemini lỗi (${String(err.message).slice(0, 140)}) → fallback template`);
      }
    }
  }

  // 3. Template.
  if (!facebookPost) facebookPost = fallbackFacebook(deal, link);
  if (!friendMessage) friendMessage = fallbackFriend(deal, link);

  return {
    dealId: deal.id,
    facebookPost,
    friendMessage,
    hashtags: HASHTAGS,
    productLink: link,
    via,
    generatedAt: new Date().toISOString(),
  };
}

function resolveLink(deal, config) {
  const mode = config.content?.linkMode || "raw";
  if (mode === "room") return "[ROOM_LINK]"; // V2: dán link ROOM sau khi thêm vào ROOM
  return deal.itemUrl;
}

/**
 * Gọi Gemini với 1 lần retry khi bị giới hạn tốc độ (429) hoặc quá tải (503).
 * Chờ theo retryDelay server gợi ý (nếu parse được), mặc định 30s.
 */
async function generateWithGeminiRetry(deal, link, config) {
  const { sleep } = require("../utils/helpers");
  try {
    return await generateWithGemini(deal, link, config);
  } catch (err) {
    const msg = String(err.message || "");
    if (!/429|503|Too Many Requests|overloaded|high demand/i.test(msg)) throw err;
    const m = msg.match(/retry(?:Delay)?[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*s/i);
    const waitMs = Math.min(60000, Math.ceil((m ? parseFloat(m[1]) : 30) * 1000) + 1000);
    logger.warn(`Gemini bị giới hạn, chờ ${Math.round(waitMs / 1000)}s rồi thử lại...`);
    await sleep(waitMs);
    return await generateWithGemini(deal, link, config);
  }
}

async function generateWithGemini(deal, link, config) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(config.secrets.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: config.content.geminiModel || "gemini-2.5-flash" });
  quota.countCall(); // đếm MỌI lần thử (kể cả lỗi) — ước lượng an toàn

  const prompt = `Bạn là chuyên gia viết content quảng bá deal Rakuten cho cộng đồng người Việt tại Nhật.
Viết bằng tiếng Việt, GIỮ NGUYÊN tên sản phẩm tiếng Nhật (rút gọn tên nếu quá dài, bỏ phần khuyến mãi trong tên). Phong cách hào hứng nhưng trung thực, thông tin chính xác.
KHÔNG dùng ký hiệu markdown (*, **, _, #) — Facebook không hiển thị được; viết text thuần + emoji.

Thông tin:
- Tên: ${deal.itemName}
- Giá sale: ${formatPrice(deal.currentPrice)}${deal.originalPrice ? ` (giá gốc ${formatPrice(deal.originalPrice)}, giảm ${deal.discountPercent}%)` : ""}
- Point back: ${deal.pointRate}% = ${formatPrice(deal.pointAmount)}
- Giá thực tế: ${formatPrice(deal.effectivePrice)} (tiết kiệm ${deal.savingsPercent}%)
- Review: ${deal.reviewAverage}/5 (${deal.reviewCount})
${deal.isSuperDeal ? "- Super DEAL" : ""}${deal.dealEndTime ? "\n- Có giới hạn thời gian" : ""}

Tạo 2 phiên bản, dùng ${link} làm link:
1. FACEBOOK_POST (120-180 từ): mở đầu 【PR】, emoji hợp lý, kết thúc bằng ${HASHTAGS.join(" ")}.
2. FRIEND_MESSAGE (40-70 từ): tone nhắn bạn thân, cuối ghi "(※ affiliate link nhé 😄)".

Trả về DUY NHẤT JSON: { "facebookPost": "...", "friendMessage": "..." }`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Không parse được JSON từ Gemini");
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.facebookPost || !parsed.friendMessage) throw new Error("JSON thiếu field");
  return parsed;
}

/** Sinh content cho nhiều deal. */
async function generateBatch(deals, cfg = null) {
  const config = cfg || loadConfig();
  const out = [];
  for (const deal of deals) out.push(await generateContent(deal, config));
  return out;
}

module.exports = { generateContent, generateBatch };
