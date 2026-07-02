# 📏 PROJECT RULES — Rakuten Hunter

> Claude **PHẢI đọc file này trước khi thực hiện bất kỳ task nào** trong dự án này.
> File được nạp tự động vào ngữ cảnh mỗi phiên. Khi có xung đột, RULES ở đây ưu tiên cao nhất.

---

## Rules

### Rule 1 — Quyền thao tác (Permissions)
Người dùng **mặc định approve mọi request** của Claude trong dự án này:
- ✅ Đọc file (Read), Viết file (Write), Sửa file (Edit), tạo thư mục
- ✅ Chạy lệnh shell / PowerShell / Node (build, test, chạy script)
- ✅ Tìm kiếm (Glob, Grep), di chuyển/đổi tên file

**NGOẠI LỆ — bắt buộc hỏi & chờ người dùng approve trước khi làm:**
1. 🗑️ **Xóa file / thư mục** (Remove-Item, rm, xóa nội dung phá hủy...) — luôn hỏi trước.
2. 🌐 **Truy cập web / mạng ngoài** — bắt buộc hỏi trước, NGOẠI TRỪ domain Rakuten:
   - ✅ **Domain Rakuten đã được pre-approve vĩnh viễn** — mọi thao tác liên quan Rakuten
     (`*.rakuten.co.jp`, `*.rakuten.com`: scrape, fetch, `npm run scrape`, xem trang...)
     **KHÔNG cần hỏi lại**, cứ chạy.
   - ⚠️ Mọi URL/API ngoài Rakuten (WebFetch/WebSearch site khác, gọi API Gemini,
     Telegram... khi tới phase đó) → nêu rõ đích, chờ approve mới chạy.

Ngoài 2 ngoại lệ trên, cứ thực hiện, không hỏi lại.

---

## Cách thêm rule mới
Người dùng nói "Rule tiếp theo: ..." → Claude thêm mục `### Rule N — ...` vào phần Rules ở trên, giữ nguyên định dạng.

---

## Ghi chú vận hành (không phải rule, chỉ tham chiếu nhanh)
- Ngôn ngữ trao đổi: tiếng Việt.
- Shell chính: PowerShell (Windows). Bash tool hay bị prompt → ưu tiên PowerShell.
- Tài liệu thiết kế: `REPORT_...md`, `docs/BASIC_DESIGN.md`, `docs/DETAILED_DESIGN.md`.
- Kế hoạch đang theo: chạy được mọi thứ *trước* khi setup Telegram (Telegram = Phase 5).
