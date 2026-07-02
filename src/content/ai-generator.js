"use strict";

const { loadConfig } = require("../utils/config");
const { formatPrice } = require("../utils/helpers");
const { HASHTAGS, fallbackFacebook, fallbackFriend } = require("./templates");
const logger = require("../utils/logger");

/**
 * Sinh nội dung cho 1 deal → GeneratedContent.
 *
 * Mặc định chạy MIỄN PHÍ bằng template (config.content.useAI = false).
 * Khi bật useAI=true và có GEMINI_API_KEY → dùng Gemini; lỗi thì tự fallback template.
 *
 * linkMode "raw" (hiện tại): dùng thẳng deal.itemUrl.
 * (V2: "room" → chèn placeholder [ROOM_LINK] cho bạn dán link ROOM.)
 */
async function generateContent(deal, cfg = null, options = {}) {
  const config = cfg || loadConfig();
  const link = resolveLink(deal, config);

  let facebookPost;
  let friendMessage;
  let via = "template";

  if (config.content?.useAI && config.secrets?.geminiApiKey && !options.forceTemplate) {
    try {
      const ai = await generateWithGemini(deal, link, config);
      facebookPost = ai.facebookPost;
      friendMessage = ai.friendMessage;
      via = "gemini";
    } catch (err) {
      logger.warn(`Gemini lỗi (${err.message}) → fallback template`);
    }
  }

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

async function generateWithGemini(deal, link, config) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(config.secrets.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: config.content.geminiModel || "gemini-2.0-flash" });

  const prompt = `Bạn là chuyên gia viết content quảng bá deal Rakuten cho cộng đồng người Việt tại Nhật.
Viết bằng tiếng Việt, GIỮ NGUYÊN tên sản phẩm tiếng Nhật. Phong cách hào hứng nhưng trung thực, thông tin chính xác.

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
