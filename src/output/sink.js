"use strict";

/**
 * OutputSink — interface (contract) cho mọi kênh đầu ra.
 *
 * Ý tưởng cốt lõi của re-plan: pipeline (scrape→score→content→image) KHÔNG
 * biết gì về đích đến. Nó chỉ gọi các method dưới đây. Nhờ vậy:
 *   - Phase 0-4 dùng LocalSink (ghi HTML/PNG ra ./output) — chạy offline.
 *   - Phase 5 chỉ cần thêm TelegramSink implement cùng contract, không sửa pipeline.
 *
 * Mọi sink con PHẢI kế thừa class này và override sendDeal().
 */
class OutputSink {
  /** Chuẩn bị (mở kết nối, tạo thư mục, reset state...). */
  async init() {}

  /**
   * Gửi 1 deal đã có đủ nội dung.
   * @param {object} deal    ScoredDeal
   * @param {object} content GeneratedContent (facebookPost, friendMessage, ...)
   * @param {Buffer|string|null} image  Buffer PNG | đường dẫn file | null
   */
  async sendDeal(deal, content, image) {
    throw new Error(`${this.constructor.name} chưa implement sendDeal()`);
  }

  /** Gửi tổng kết cuối phiên (tùy chọn). */
  async sendSummary(deals) {}

  /** Đóng/flush (LocalSink render index.html tại đây). */
  async close() {}
}

module.exports = { OutputSink };
