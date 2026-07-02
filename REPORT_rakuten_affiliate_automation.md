# 🎯 Rakuten Affiliate Automation System — Research Report

> **Ngày tạo:** 2026-06-29  
> **Mục tiêu:** Scrape Rakuten tìm sản phẩm sale lớn & point cao → Đăng lên Rakuten ROOM (tạo link affiliate) → Sinh bài đăng cho Facebook, TikTok, gửi bạn bè
> **Phương pháp chính:** Web Scraping (ưu tiên) + Rakuten ROOM làm trung tâm affiliate

---

## 📑 Mục lục

1. [Tổng quan thị trường](#1-tổng-quan-thị-trường)
2. [Hệ sinh thái Rakuten — Cơ chế Sale & Point](#2-hệ-sinh-thái-rakuten--cơ-chế-sale--point)
3. [Rakuten Affiliate — Cách hoạt động & Phí hoa hồng](#3-rakuten-affiliate--cách-hoạt-động--phí-hoa-hồng)
4. [Web Scraping — Chiến lược quét dữ liệu](#4-web-scraping--chiến-lược-quét-dữ-liệu)
5. [Kiến trúc hệ thống đề xuất](#5-kiến-trúc-hệ-thống-đề-xuất)
6. [Vấn đề pháp lý & Compliance](#6-vấn-đề-pháp-lý--compliance)
7. [Chiến lược nội dung cho từng nền tảng](#7-chiến-lược-nội-dung-cho-từng-nền-tảng)
8. [Rủi ro & Giải pháp](#8-rủi-ro--giải-pháp)
9. [Roadmap triển khai](#9-roadmap-triển-khai)
10. [Kết luận & Khuyến nghị](#10-kết-luận--khuyến-nghị)

---

## 1. Tổng quan thị trường

### 1.1 Rakuten Ichiba — Vị thế trên thị trường

| Chỉ số | Giá trị |
|---------|---------|
| **Tổng GMV (2025)** | ~6 nghìn tỷ JPY/năm |
| **Số shop trên sàn** | ~57,000+ |
| **Số thành viên Rakuten** | ~100 triệu+ (hệ sinh thái) |
| **Thị phần EC Nhật** | #2 (sau Amazon JP) |

### 1.2 Tại sao Rakuten Affiliate có tiềm năng?

- **Hệ sinh thái point khổng lồ:** Rakuten Point là "tiền tệ" phổ biến nhất Nhật Bản, được dùng ở 500,000+ cửa hàng offline
- **Sự kiện sale thường xuyên:** Super SALE (4 lần/năm), お買い物マラソン (1-2 lần/tháng), Super DEAL (hàng ngày)
- **Người Nhật rất yêu "deal hunting":** Văn hóa tìm kiếm "お得" (bargain) cực kỳ mạnh
- **Cộng đồng Rakuten ROOM:** Nền tảng affiliate tích hợp sẵn, rất phù hợp để chia sẻ sản phẩm

### 1.3 Đối tượng mục tiêu

| Phân khúc | Đặc điểm | Nền tảng chính |
|-----------|-----------|----------------|
| Bà nội trợ 30-50 tuổi | Hay mua đồ gia dụng, thực phẩm, mỹ phẩm | Facebook, Instagram, 楽天ROOM |
| Giới trẻ 20-30 tuổi | Gadget, thời trang, beauty | TikTok, Instagram, X (Twitter) |
| Người Việt tại Nhật | Tìm deal, mua hàng Nhật | Facebook Group, Zalo |
| Otaku / Hobbyist | Anime goods, game, figure | X, TikTok |

---

## 2. Hệ sinh thái Rakuten — Cơ chế Sale & Point

### 2.1 Các loại "Sale lớn" trên Rakuten

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAKUTEN SALE ECOSYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 楽天スーパーSALE (Super SALE)                                │
│     Tần suất: 4 lần/năm (tháng 3, 6, 9, 12)                    │
│     Đặc điểm: Half-price items, coupon rain, shop買いまわり      │
│     Discount: Lên tới 50-80% OFF                                │
│                                                                 │
│  🟠 お買い物マラソン (Shopping Marathon)                          │
│     Tần suất: 1-2 lần/tháng                                     │
│     Đặc điểm: Mua càng nhiều shop → Point càng cao (max 10倍)   │
│     Trigger: Mua ≥ ¥1,000/shop                                  │
│                                                                 │
│  🟡 楽天スーパーDEAL (Super DEAL)                                │
│     Tần suất: Hàng ngày (rotating)                              │
│     Đặc điểm: Point back 10%~50% trên giá bán                  │
│     API flag: dealFlag = 1                                      │
│                                                                 │
│  🟢 SPU (Super Point Up Program)                                │
│     Đặc điểm: Dùng nhiều service Rakuten → Point base tăng     │
│     Cách hoạt động: Rakuten Card +2x, Mobile +4x, v.v.         │
│                                                                 │
│  🔵 5と0のつく日 (Ngày có số 5 và 0)                             │
│     Tần suất: 6 lần/tháng (5, 10, 15, 20, 25, 30)              │
│     Đặc điểm: +2倍 point khi dùng Rakuten Card                 │
│                                                                 │
│  🟣 勝ったら倍 (Khi đội bóng thắng)                              │
│     Đặc điểm: Rakuten Eagles/Vissel Kobe thắng → +1~3倍        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Cách tính tổng Point Rate

```
Ví dụ mua hàng ¥10,000 trong Super SALE:

  Base point:           1x  (100 pt)
+ SPU (Rakuten Card):  +2x  (200 pt)
+ SPU (Mobile):        +4x  (400 pt)
+ 買いまわり 10 shop:   +9x  (900 pt)
+ 5のつく日:            +2x  (200 pt)
+ Super DEAL 30%:       30%  (3,000 pt)
+ Shop coupon:          -20% (-2,000 yen OFF)
─────────────────────────────────
Tổng: ~4,800 pt + ¥2,000 OFF trên ¥10,000
→ Thực tế tiết kiệm ~48% + 20% = ~68% giá trị!
```

> [!IMPORTANT]
> **Đây chính là "selling point" khi quảng bá sản phẩm.** Người dùng không chỉ quan tâm giá giảm mà còn cực kỳ hứng thú với tổng point có thể nhận được.

---

## 3. Rakuten Affiliate — Cách hoạt động & Phí hoa hồng

### 3.1 Tổng quan chương trình

| Mục | Chi tiết |
|-----|----------|
| **Tên chương trình** | 楽天アフィリエイト |
| **Đăng ký** | Miễn phí, cần tài khoản Rakuten |
| **Hình thức thanh toán** | 楽天キャッシュ (Rakuten Cash) — có thể chuyển sang tiền mặt khi đạt ngưỡng |
| **Cookie duration** | 24 giờ (click → mua trong 24h) |
| **Cross-device** | ✅ Có tracking cross-device |

### 3.2 Phí hoa hồng theo danh mục

| Danh mục sản phẩm | Phí hoa hồng cơ bản | Phí nâng cao (料率UP) |
|-------------------|---------------------|----------------------|
| Thời trang / Mỹ phẩm | 4% | Lên tới 20% |
| Thực phẩm / Đồ uống | 4% | 8~15% |
| Gia dụng / Nội thất | 3% | 5~10% |
| Điện tử / Gadget | 2% | 3~5% |
| Sách / DVD | 3% | 5~8% |
| Du lịch (Rakuten Travel) | 1% | 2~3% |

### 3.3 Giới hạn quan trọng

> [!WARNING]
> - **Giới hạn/sản phẩm:** Tối đa **¥1,000** hoa hồng per product per đơn hàng
> - **Giới hạn/tháng/user:** Tối đa **¥3,000** hoa hồng từ cùng 1 user/tháng
> - **Ngoại lệ:** Sản phẩm có tag 「料率UP」 có thể vượt giới hạn trên

### 3.4 SNS được phép sử dụng

Rakuten chỉ cho phép affiliate link trên các nền tảng **đã đăng ký và được duyệt**:

| Nền tảng | Được phép? | Ghi chú |
|----------|-----------|---------|
| 楽天ROOM | ✅ | Nền tảng affiliate tích hợp chính thức |
| Instagram | ✅ | Profile bio, Stories, post caption |
| X (Twitter) | ✅ | Tweet, profile |
| TikTok | ✅ | Bio link, video description |
| Facebook | ✅ | Page post, group post (admin) |
| YouTube | ✅ | Description, pinned comment |
| Pinterest | ✅ | Pin description |
| Threads | ✅ | Post |
| Blog cá nhân | ✅ | Cần đăng ký URL |
| LINE Group | ❌ | Không được phép |
| DM / Private message | ❌ | Cấm tuyệt đối |

---

## 4. Web Scraping — Chiến lược quét dữ liệu

### 4.1 Tại sao chọn Scraping thay vì API?

| Tiêu chí | 🕷️ Web Scraping | 🔌 API |
|----------|-----------------|--------|
| **Dữ liệu coupon/flash sale** | ✅ Lấy được tất cả | ❌ Không có endpoint |
| **Giá gốc (trước giảm)** | ✅ Hiện trên trang | ❌ Thường thiếu |
| **Trang event đặc biệt** | ✅ Super SALE, Marathon | ❌ Hạn chế |
| **Tự do thời gian chạy** | ✅ Chạy chậm, ổn định | ⚠️ Rate limit nghiêm ngặt |
| **Không cần đăng ký key** | ✅ | ❌ Cần App ID + Access Key |
| **Bảo trì khi site đổi layout** | ⚠️ Cần cập nhật selector | ✅ Ổn định hơn |

> [!NOTE]
> API vẫn được giữ lại như **phương án backup** nếu cần. Nhưng core system sẽ dựa trên scraping.

### 4.2 Các trang mục tiêu cần quét

```
┌─────────────────────────────────────────────────────────────────────┐
│                   SCRAPING TARGETS MAP                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🎯 TARGET 1: 楽天スーパーDEAL (Ưu tiên cao nhất)                    │
│  URL: https://event.rakuten.co.jp/superdeal/                       │
│  Dữ liệu: Point back 10%~50%, giá, tên SP, hình ảnh, review       │
│  Tần suất quét: Mỗi 2-4 giờ (SP thay đổi hàng ngày)               │
│  Sub-pages:                                                        │
│    /superdeal/timesale/     → Deal giới hạn thời gian              │
│    /superdeal/ranking/      → Ranking theo point rate               │
│    /superdeal/?l-id=genre_X → Lọc theo genre                       │
│                                                                     │
│  🎯 TARGET 2: Trang tìm kiếm với từ khóa sale                      │
│  URL: https://search.rakuten.co.jp/search/mall/{keyword}/          │
│  Keywords: "半額", "50%OFF", "タイムセール", "在庫処分"                │
│  Dữ liệu: Giá gốc, giá sale, % giảm, review, shop                 │
│  Tần suất quét: Mỗi 4-6 giờ                                       │
│                                                                     │
│  🎯 TARGET 3: RaCoupon — Trang coupon chính thức                    │
│  URL: https://coupon.rakuten.co.jp/                                │
│  Dữ liệu: Mã coupon, % giảm, điều kiện sử dụng, hạn sử dụng      │
│  Tần suất quét: Mỗi 6-12 giờ                                      │
│                                                                     │
│  🎯 TARGET 4: Ranking sản phẩm bán chạy                            │
│  URL: https://ranking.rakuten.co.jp/                               │
│  Dữ liệu: Top products theo genre, giá, trend                     │
│  Tần suất quét: 1 lần/ngày                                        │
│                                                                     │
│  🎯 TARGET 5: Trang event (khi có sự kiện)                          │
│  URL: https://event.rakuten.co.jp/campaign/supersale/              │
│       https://event.rakuten.co.jp/campaign/point-up/marathon/      │
│  Dữ liệu: Sản phẩm featured, half-price items, special coupons    │
│  Tần suất quét: Chỉ trong thời gian event                         │
│                                                                     │
│  🎯 TARGET 6: Trang chi tiết sản phẩm (khi cần thêm info)          │
│  URL: https://item.rakuten.co.jp/{shop}/{item_id}/                 │
│  Dữ liệu: Mô tả chi tiết, ảnh lớn, specs, review chi tiết        │
│  Tần suất quét: On-demand (khi deal score cao)                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Dữ liệu cần extract từ mỗi sản phẩm

```python
@dataclass
class ScrapedProduct:
    """Cấu trúc dữ liệu cho mỗi sản phẩm được scrape."""
    
    # === Thông tin cơ bản ===
    item_name: str              # 商品名
    item_url: str               # URL gốc trên Rakuten
    shop_name: str              # Tên shop
    shop_url: str               # URL shop
    image_urls: list[str]       # Danh sách ảnh sản phẩm
    
    # === Giá & Giảm giá ===
    current_price: int          # Giá hiện tại (円)
    original_price: int | None  # Giá gốc (trước giảm)
    discount_percent: int       # % giảm giá (tính từ giá gốc)
    
    # === Point ===
    point_rate: int             # % point back (Super DEAL)
    point_amount: int           # Số point nhận được
    is_super_deal: bool         # Có phải Super DEAL?
    
    # === Review ===
    review_count: int           # Số review
    review_average: float       # Điểm review trung bình
    
    # === Thời gian ===
    deal_start: str | None      # Thời gian bắt đầu deal
    deal_end: str | None        # Thời gian kết hợp deal
    scraped_at: str             # Thời gian scrape
    
    # === Coupon (nếu có) ===
    coupon_discount: int | None # Giảm thêm từ coupon
    coupon_code: str | None     # Mã coupon
    
    # === Metadata ===
    source_page: str            # Scrape từ trang nào
    genre: str                  # Category/Genre
    deal_score: int             # Điểm hấp dẫn (0-100)
```

### 4.4 Công cụ scraping đề xuất

| Công cụ | Dùng khi | Ưu điểm |
|---------|----------|--------|
| **Playwright** (Python) | Trang dùng JS rendering (Super DEAL, Event pages) | Render JS đầy đủ, headless browser, anti-detect tốt |
| **BeautifulSoup + requests** | Trang tĩnh (search results, ranking) | Nhanh, nhẹ, đơn giản |
| **Selectolax / lxml** | Parse HTML nhanh | Nhanh gấp 10x BeautifulSoup |

> [!TIP]
> **Khuyến nghị:** Dùng **Playwright** cho tất cả vì Rakuten render nhiều nội dung bằng JavaScript. Có thể chạy headless, tốc độ chấp nhận được nếu có thời gian chờ.

### 4.5 Chiến lược anti-block khi scraping

```python
# Cấu hình anti-detection cho Playwright
SCRAPER_CONFIG = {
    # 1. Fake browser fingerprint
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
    "viewport": {"width": 1920, "height": 1080},
    "locale": "ja-JP",
    "timezone_id": "Asia/Tokyo",
    
    # 2. Tốc độ "con người"
    "min_delay_between_pages": 3,    # Tối thiểu 3 giây/trang
    "max_delay_between_pages": 8,    # Tối đa 8 giây/trang  
    "random_delay": True,             # Delay ngẫu nhiên
    
    # 3. Session management
    "rotate_user_agent": True,        # Đổi UA mỗi session
    "max_pages_per_session": 50,      # Restart browser sau 50 trang
    "use_cookies": True,              # Giữ cookies như người thật
    
    # 4. Giới hạn tổng
    "max_pages_per_hour": 100,        # Max 100 trang/giờ
    "max_pages_per_day": 1000,        # Max 1000 trang/ngày
    "respect_robots_txt": True,       # Tôn trọng robots.txt
}
```

> [!WARNING]
> **Lưu ý:** Scraping Rakuten không vi phạm pháp luật Nhật Bản nếu:
> - Không gây quá tải server (chạy chậm, có delay)
> - Không vượt qua hệ thống bảo mật (CAPTCHA, login wall)
> - Không dùng dữ liệu để cạnh tranh trực tiếp với Rakuten
> - Chỉ dùng dữ liệu công khai (giá, tên, hình ảnh)
>
> Tuy nhiên, nếu bị block IP thì chấp nhận, KHÔNG dùng proxy farm.

---

## 5. Kiến trúc hệ thống đề xuất — ROOM-Centric

### 5.1 Core Flow: Scrape → ROOM → Share

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  RAKUTEN HUNTER — ROOM-CENTRIC FLOW                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STEP 1: SCRAPE (Tự động)                                                │
│  ┌─────────────────────────────────────────────────────────┐             │
│  │  Playwright/BeautifulSoup quét các trang Rakuten:       │             │
│  │  • Super DEAL  • Search "半額"  • Ranking  • Coupons    │             │
│  │  → Extract: tên, giá, giá gốc, point%, review, ảnh     │             │
│  │  → Lưu vào SQLite database                             │             │
│  └──────────────────────────┬──────────────────────────────┘             │
│                             ▼                                            │
│  STEP 2: SCORE & FILTER (Tự động)                                        │
│  ┌─────────────────────────────────────────────────────────┐             │
│  │  Deal Scoring Engine:                                   │             │
│  │  • Discount %  • Point rate  • Reviews  • Price range   │             │
│  │  → Chỉ giữ lại deals có score >= 70/100                │             │
│  │  → Loại trùng lặp (đã đăng trước đó)                   │             │
│  │  → Output: Top 5-10 deals/ngày                         │             │
│  └──────────────────────────┬──────────────────────────────┘             │
│                             ▼                                            │
│  STEP 3: ĐĂNG LÊN RAKUTEN ROOM (Thủ công / Bán tự động)                 │
│  ┌─────────────────────────────────────────────────────────┐             │
│  │  👤 Bạn mở Rakuten ROOM → Thêm sản phẩm vào ROOM       │             │
│  │  • Hệ thống gợi ý URL sản phẩm cần thêm                │             │
│  │  • Viết comment ngắn (AI hỗ trợ draft)                  │             │
│  │  • ROOM tự động tạo affiliate link!                     │             │
│  │  → Output: room.rakuten.co.jp/yourname/items/XXXXX     │             │
│  └──────────────────────────┬──────────────────────────────┘             │
│                             ▼                                            │
│  STEP 4: SINH NỘI DUNG BÀI ĐĂNG (Tự động)                               │
│  ┌─────────────────────────────────────────────────────────┐             │
│  │  AI Content Generator nhận:                             │             │
│  │  • Product data (từ scraping)                           │             │
│  │  • ROOM link (từ step 3)                                │             │
│  │  → Sinh ra bài đăng cho:                                │             │
│  │    📘 Facebook (bài dài, có link)                        │             │
│  │    🎵 TikTok (script video 30-60s)                      │             │
│  │    💬 Message cho bạn bè (ngắn gọn, thân thiện)         │             │
│  │  → Auto-inject: 【PR】tag + #hashtags                    │             │
│  └──────────────────────────┬──────────────────────────────┘             │
│                             ▼                                            │
│  STEP 5: REVIEW & ĐĂNG (Thủ công)                                        │
│  ┌─────────────────────────────────────────────────────────┐             │
│  │  👤 Bạn review nội dung → Chỉnh sửa nếu cần            │             │
│  │  → Copy-paste lên Facebook / TikTok                     │             │
│  │  → Hoặc gửi cho bạn bè qua LINE/Messenger              │             │
│  └─────────────────────────────────────────────────────────┘             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Tại sao ROOM là trung tâm?**
> - ROOM **tự động tạo affiliate link** — không cần API, không cần xử lý thủ công
> - ROOM là nền tảng **chính thức của Rakuten** — an toàn 100%, không lo bị BAN
> - ROOM link có thể **share ở bất kỳ đâu** (FB, TikTok, LINE, v.v.)
> - ROOM tracking **hoạt động tốt** — click từ mọi nguồn đều được ghi nhận

### 5.2 Tech Stack đề xuất

| Layer | Công nghệ | Lý do |
|-------|-----------|-------|
| **Language** | Python 3.12+ | Mạnh về scraping, data processing, AI integration |
| **Scraping** | Playwright (chính) + BeautifulSoup (phụ) | JS rendering + lightweight parsing |
| **Database** | SQLite | Đơn giản, không cần server, portable |
| **AI Content** | OpenAI API / Claude API / Gemini | Sinh bài đăng đa nền tảng |
| **Image Processing** | Pillow | Tạo ảnh banner deal |
| **CLI Dashboard** | Rich (Python) hoặc Streamlit | Xem deals, approve content |
| **Scheduler** | APScheduler hoặc Windows Task Scheduler | Chạy scraping định kỳ |
| **Notification** | LINE Notify / Discord Webhook | Alert khi phát hiện deal hot |

### 5.3 Deal Scoring Algorithm

```python
def calculate_deal_score(product: ScrapedProduct) -> int:
    """
    Tính điểm "hot" của deal để quyết định có đăng lên ROOM hay không.
    Score 0-100. Chỉ đề xuất đăng ROOM nếu score >= 70.
    """
    score = 0
    
    # 1. Discount rate (max 30 pts)
    if product.discount_percent >= 50:
        score += 30
    elif product.discount_percent >= 30:
        score += 20
    elif product.discount_percent >= 20:
        score += 10
    
    # 2. Point back rate — Super DEAL (max 25 pts)
    if product.point_rate >= 40:
        score += 25
    elif product.point_rate >= 30:
        score += 20
    elif product.point_rate >= 20:
        score += 15
    elif product.point_rate >= 10:
        score += 8
    
    # 3. Review quality — xã hội chứng thực (max 20 pts)
    if product.review_count >= 100 and product.review_average >= 4.5:
        score += 20
    elif product.review_count >= 50 and product.review_average >= 4.0:
        score += 15
    elif product.review_count >= 10 and product.review_average >= 3.5:
        score += 8
    
    # 4. Price range — tầm giá hấp dẫn (max 15 pts)
    if 1000 <= product.current_price <= 5000:     # Impulse buy
        score += 15
    elif 5000 < product.current_price <= 15000:   # Mid range
        score += 12
    elif product.current_price > 15000:           # High ticket
        score += 8
    
    # 5. Urgency / Time-limited (max 10 pts)
    if product.is_super_deal:
        score += 5
    if product.deal_end:   # Có deadline
        score += 5
    
    return min(score, 100)
```

### 5.4 Content Generation — Từ ROOM link ra bài đăng

```
┌──────────────────────────────────────────────────────────────┐
│          CONTENT GENERATION (với ROOM link)                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  INPUT:                                                      │
│  ┌────────────────────────────────────────┐                  │
│  │ • Product data (từ scraping DB)        │                  │
│  │ • ROOM link: room.rakuten.co.jp/...    │                  │
│  │ • Ảnh sản phẩm (đã download)           │                  │
│  └───────────────────┬────────────────────┘                  │
│                      ▼                                       │
│  AI GENERATES 3 VERSIONS:                                    │
│                                                              │
│  📘 Facebook Post                                            │
│  ┌────────────────────────────────────────┐                  │
│  │ 【PR】🔥 今治タオル6枚 — ¥2,980!       │                  │
│  │ 通常¥5,980 → 50%OFF + 30%ポイントバック │                  │
│  │ ⭐ 4.72 (1,250件レビュー)               │                  │
│  │ 実質 ¥2,086で買える！                   │                  │
│  │ 👉 https://room.rakuten.co.jp/...      │                  │
│  │ #PR #楽天ROOM #お得                    │                  │
│  └────────────────────────────────────────┘                  │
│                                                              │
│  🎵 TikTok Script                                            │
│  ┌────────────────────────────────────────┐                  │
│  │ [0-3s] Hook: "¥2,086で今治タオル6枚!?" │                  │
│  │ [3-15s] 商品紹介 + 価格breakdown        │                  │
│  │ [15-25s] レビュー紹介                   │                  │
│  │ [25-30s] CTA: "プロフのリンクから！"     │                  │
│  │ Caption: 【PR】... #楽天ROOM            │                  │
│  └────────────────────────────────────────┘                  │
│                                                              │
│  💬 Message cho bạn bè                                       │
│  ┌────────────────────────────────────────┐                  │
│  │ Ê, cái này đang sale nè!              │                  │
│  │ 今治タオル 6枚 chỉ ¥2,980             │                  │
│  │ + point back 30% → thực tế ¥2,086!    │                  │
│  │ Review 4.72⭐ ngon lắm                 │                  │
│  │ Link: https://room.rakuten.co.jp/...  │                  │
│  │ (※ affiliate link nhé 😄)              │                  │
│  └────────────────────────────────────────┘                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Khi gửi cho bạn bè:** Rakuten **cấm** gửi affiliate link qua LINE group/DM nếu là spam. Nhưng gửi **cá nhân cho bạn bè thật** với mục đích chia sẻ deal thì chấp nhận được — miễn là không spam hàng loạt và có ghi rõ đây là affiliate link.

---

## 6. Vấn đề pháp lý & Compliance

### 6.1 Luật ステマ規制 (Stealth Marketing Regulation)

> [!CAUTION]
> **Đây là rủi ro pháp lý LỚN NHẤT.** Từ 01/10/2023, Nhật Bản đã ban hành quy định chống quảng cáo ẩn (stealth marketing) theo **景品表示法** (Act Against Unjustifiable Premiums and Misleading Representations).

**Vi phạm sẽ bị:**
- 📋 Lệnh đình chỉ (措置命令) — buộc ngừng quảng cáo + đăng đính chính
- 💰 Phạt tiền (課徴金) — tính trên doanh thu
- ⚖️ Truy tố hình sự — trong trường hợp nghiêm trọng (từ 2024)

**Cách tuân thủ — BẮT BUỘC:**

```
✅ ĐÚNG:
┌─────────────────────────────────────────┐
│  【PR】今治タオル 6枚セットが30%ポイントバック！│
│                                          │
│  (nội dung bài viết...)                  │
│                                          │
│  #PR #広告 #楽天アフィリエイト #AD         │
└─────────────────────────────────────────┘

❌ SAI:
┌─────────────────────────────────────────┐
│  友達に教えてもらった最高のタオル！         │
│  (giả vờ review tự nhiên, không ghi PR)  │
│                                          │
│  → 違法！景品表示法違反！                  │
└─────────────────────────────────────────┘
```

### 6.2 Quy định của Rakuten Affiliate

| Hành vi | Tình trạng | Hậu quả |
|---------|-----------|---------|
| Tự động đăng bài bằng bot | 🔴 **CẤM** | Account BAN + Mất toàn bộ thu nhập |
| Spam link trong comment/reply | 🔴 **CẤM** | Account BAN |
| Repost/quote nhiều lần cùng nội dung | 🔴 **CẤM** | Account BAN |
| Đăng link trong DM/LINE group | 🔴 **CẤM** | Account BAN |
| Dụ dỗ "mua qua link tôi" | 🔴 **CẤM** | Account BAN |
| Dùng AI sinh nội dung + **người review** trước khi đăng | 🟡 **Chấp nhận được** | OK nếu nội dung có chất lượng |
| Đăng thủ công với PR tag | 🟢 **OK** | Tuân thủ |
| Dùng Rakuten ROOM | 🟢 **OK** | Nền tảng chính thức |

### 6.3 Quy định của các nền tảng social media

| Nền tảng | Yêu cầu cụ thể |
|----------|----------------|
| **Facebook** | Nếu là Page, cần tuân thủ Facebook Branded Content policy. Ghi rõ "PR" hoặc "Affiliate" |
| **TikTok** | Cần bật "Branded Content" toggle khi post. TikTok Shop nếu có thì ưu tiên |
| **Instagram** | Sử dụng "Paid Partnership" label hoặc ghi rõ #PR #AD |
| **X (Twitter)** | Ghi rõ 【PR】 hoặc 【広告】 ở đầu tweet |

### 6.4 Ma trận tuân thủ

```
┌────────────────────────────────────────────────────────┐
│              COMPLIANCE CHECKLIST                       │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Mỗi bài đăng PHẢI có:                                │
│                                                        │
│  ☐ Tag 「PR」hoặc「広告」ở ĐẦU bài viết                │
│  ☐ Hashtag #PR hoặc #AD                               │
│  ☐ Nội dung phản ánh ĐÚNG sản phẩm (không phóng đại)  │
│  ☐ Giá và điều kiện sale được ghi chính xác            │
│  ☐ Thời hạn sale nếu có time-limit                    │
│  ☐ KHÔNG giả vờ là review tự nhiên                     │
│  ☐ KHÔNG spam (max 3-5 bài/ngày tùy nền tảng)         │
│  ☐ Đăng bằng tay hoặc semi-auto (KHÔNG full auto)     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 7. Chiến lược nội dung cho từng nền tảng

### 7.1 Facebook

**Đối tượng:** Người Việt tại Nhật, bà nội trợ, cộng đồng mua sắm

**Format bài đăng mẫu:**
```
【PR・楽天アフィリエイト】

🔥 今治タオル 6枚セット - Khăn Imabari cao cấp!
━━━━━━━━━━━━━━━━

💰 Giá: ¥2,980 (thường ¥5,980)
🎯 Point back: 30% (= ¥894 point!)
⭐ Review: 4.72/5 (1,250 reviews)
⏰ Hạn: Còn 2 ngày!

✨ Thực tế bạn chỉ trả: ¥2,086!

👉 Link mua: [affiliate link]

#楽天 #スーパーDEAL #お得 #PR
━━━━━━━━━━━━━━━━
```

**Tần suất:** 3-5 bài/ngày, tập trung giờ 12h-13h và 20h-22h

### 7.2 TikTok

**Đối tượng:** Giới trẻ, impulse buyer

**Format:**
```
[Video Script - 30-60 giây]

Hook (0-3s):  "Bạn biết mua cái này ở Rakuten giảm 50% không?"
Problem (3-8s): "Bình thường giá ¥5,980..."  
Solution (8-20s): "Nhưng hôm nay Super DEAL back 30% point!"
              + Show sản phẩm, show giá, show point calculation
Proof (20-30s): "Review 4.7 sao, 1200+ người đã mua"
CTA (30-35s): "Link ở bio, nhanh kẻo hết! #PR"

Caption: 【PR】楽天スーパーDEAL 30%ポイントバック！
         #楽天 #お得 #PR #タイムセール
```

**Tần suất:** 1-2 video/ngày, post lúc 18h-21h

### 7.3 Instagram

**Đối tượng:** Visual-oriented shopper

**Format:**
- **Feed post:** Ảnh sản phẩm đẹp + caption chi tiết + 「PR」tag
- **Story:** Quick deal alert với sticker countdown
- **Reel:** Tương tự TikTok format

### 7.4 楽天ROOM

**Đối tượng:** Rakuten ecosystem users

**Format:**
- Chọn sản phẩm vào ROOM
- Viết comment review ngắn gọn, hữu ích
- Tạo Collection theo theme (mùa, event, category)
- Dùng ảnh tự chụp nếu có

> [!TIP]
> **Rakuten ROOM là kênh an toàn nhất** vì nó là nền tảng affiliate chính thức. Affiliate link được tạo tự động, không lo vi phạm quy định.

### 7.5 Content Calendar (Lịch nội dung)

```
┌──────────────────────────────────────────────────────┐
│            MONTHLY CONTENT CALENDAR                   │
├──────┬───────────────────────────────────────────────┤
│ Ngày │ Hoạt động                                     │
├──────┼───────────────────────────────────────────────┤
│ 1    │ Tổng hợp deal đầu tháng                       │
│ 5    │ 🔴 5のつく日 — Push deal + point bonus         │
│ 10   │ 🔴 10のつく日 — Push deal                      │
│ 15   │ 🔴 15のつく日 — Push deal                      │
│ 20   │ 🔴 20のつく日 — Push deal                      │
│ 25   │ 🔴 25のつく日 — Push deal                      │
│ 30   │ 🔴 30のつく日 + Tổng kết tháng                 │
│      │                                               │
│ ★    │ お買い物マラソン (1-2 lần/tháng, tuỳ lịch)     │
│      │ → Chuẩn bị nội dung 3 ngày trước              │
│      │ → Post intensive trong event                  │
│      │                                               │
│ ★★   │ スーパーSALE (3/6/9/12月)                      │
│      │ → Chuẩn bị nội dung 1 tuần trước              │
│      │ → Post intensive 7-10 ngày event              │
│ 毎日  │ Super DEAL daily check + post                 │
└──────┴───────────────────────────────────────────────┘
```

---

## 8. Rủi ro & Giải pháp

### 8.1 Ma trận rủi ro

| # | Rủi ro | Mức độ | Xác suất | Giải pháp |
|---|--------|--------|----------|-----------|
| 1 | Account BAN do auto-posting | 🔴 Cao | Cao nếu full-auto | **Semi-auto**: AI sinh content → Người duyệt → Đăng thủ công |
| 2 | Vi phạm ステマ規制 | 🔴 Cao | Trung bình | **Luôn ghi PR/AD** ở đầu mọi bài đăng |
| 3 | Rakuten đổi layout HTML | 🟡 Trung bình | Trung bình | Thiết kế selector linh hoạt, monitor lỗi, cập nhật kịp thời |
| 4 | Bị block IP khi scraping | 🟡 Trung bình | Thấp (nếu chạy chậm) | Delay 3-8s/trang, rotate User-Agent, giới hạn 100 trang/giờ |
| 5 | Doanh thu thấp do cap ¥1,000/item | 🟡 Trung bình | Cao | Tập trung số lượng, chọn sản phẩm 料率UP |
| 6 | Content bị detect là AI-generated | 🟡 Trung bình | Trung bình | Human review + edit trước khi post |
| 7 | Giá/deal thay đổi sau khi post | 🟡 Trung bình | Trung bình | Re-check deal trước khi post, thêm disclaimer |
| 8 | Cạnh tranh cao | 🟡 Trung bình | Cao | Chọn niche cụ thể, content chất lượng cao |

### 8.2 Chiến lược "Semi-Automation" (An toàn)

```
┌──────────────────────────────────────────────────────────────┐
│           SEMI-AUTOMATION WORKFLOW (Scraping + ROOM)          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🤖 AUTOMATED (Máy làm):                                    │
│  ├── Scrape Rakuten mỗi 2-4 giờ (chạy chậm, an toàn)       │
│  ├── Score & rank deals → Top 5-10/ngày                     │
│  ├── Gợi ý sản phẩm cần thêm vào ROOM                      │
│  ├── Generate draft content (AI) cho FB/TikTok/Message      │
│  ├── Tạo ảnh banner deal (Pillow)                           │
│  └── Lưu lịch sử & tránh trùng lặp                         │
│                                                              │
│  👤 MANUAL (Người làm — ~30-60 phút/ngày):                   │
│  ├── Xem danh sách deal hot → Chọn sản phẩm thích           │
│  ├── Thêm vào Rakuten ROOM (click, viết comment)            │
│  ├── Copy ROOM link → Paste vào content đã được sinh        │
│  ├── Review & edit nội dung cho tự nhiên                     │
│  ├── Đăng lên FB / TikTok / Gửi bạn bè                     │
│  └── Respond to comments/engagement                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Roadmap triển khai

### Phase 1: Foundation — Scraping Core (Tuần 1-2) 🏗️

| Task | Chi tiết | Ưu tiên |
|------|----------|---------|
| Tạo tài khoản Rakuten ROOM | Đăng ký ROOM, setup profile | P0 |
| Setup project | Python project, venv, cấu trúc thư mục | P0 |
| Playwright setup | Cài đặt Playwright, config browser headless | P0 |
| Super DEAL scraper | Scrape trang Super DEAL → extract product data | P0 |
| Database setup | SQLite schema cho products, history | P0 |
| Test thử ROOM | Đăng thủ công 5-10 sản phẩm lên ROOM, xác nhận flow | P0 |

**Deliverable:** Scrape được Super DEAL page + đã quen flow đăng ROOM

### Phase 2: Deal Discovery Engine (Tuần 3-4) 🔍

| Task | Chi tiết | Ưu tiên |
|------|----------|---------|
| Search page scraper | Scrape search results với keywords "半額", "タイムセール" | P0 |
| Coupon page scraper | Scrape RaCoupon page | P1 |
| Ranking scraper | Scrape ranking page | P1 |
| Deal Scorer | Implement scoring algorithm (score 0-100) | P0 |
| Deduplication | Tránh gợi ý sản phẩm đã đăng ROOM | P0 |
| CLI output | Hiển thị top deals mỗi ngày trong terminal | P1 |

**Deliverable:** Hệ thống tự tìm + xếp hạng top deals mỗi ngày

### Phase 3: Content Generation (Tuần 5-6) ✍️

| Task | Chi tiết | Ưu tiên |
|------|----------|---------|
| AI content engine | Sinh bài đăng FB/TikTok/Message từ product data + ROOM link | P0 |
| Template system | Template cho mỗi nền tảng + cho message bạn bè | P0 |
| PR/AD auto-inject | Tự động gắn 【PR】 vào mọi content | P0 |
| Image banner | Tạo ảnh deal banner bằng Pillow | P2 |

**Deliverable:** Nhập ROOM link → Ra bài đăng hoàn chỉnh cho FB/TikTok/bạn bè

### Phase 4: Dashboard & Automation (Tuần 7-8) 📱

| Task | Chi tiết | Ưu tiên |
|------|----------|---------|
| CLI/Web dashboard | Xem deals, copy content, track đã đăng | P1 |
| Scheduled scraping | Windows Task Scheduler chạy scraper định kỳ | P1 |
| Notification | LINE/Discord alert khi có deal score >= 80 | P2 |
| Event-mode | Tự động tăng tần suất scrape khi Super SALE/Marathon | P2 |

**Deliverable:** Hệ thống chạy tự động, chỉ cần mở lên xem deal + đăng ROOM + copy bài

### Phase 5: Optimization (Tuần 9+) 📈

| Task | Chi tiết | Ưu tiên |
|------|----------|---------|
| Niche specialization | Tập trung vào category convert tốt | P1 |
| Content A/B | Test format content khác nhau | P2 |
| ROOM profile build | Xây dựng follower trên ROOM | P1 |
| Multi-platform | Mở rộng sang Instagram, X | P2 |
| Analytics | Theo dõi click/conversion từ ROOM dashboard | P1 |

### Timeline tổng thể

```
Week  1  2  3  4  5  6  7  8  9  10 11 12
      ├──┤                                    Phase 1: Scraping Core
         ├─────┤                              Phase 2: Deal Engine
               ├─────┤                        Phase 3: Content Gen
                     ├─────┤                  Phase 4: Dashboard
                           ├──────────────▶   Phase 5: Optimization
      
      ▲              ▲                    
      │              │                    
   Scrape works   Full flow: Scrape→ROOM→Post
```

---

## 10. Kết luận & Khuyến nghị

### 10.1 Khả thi?

| Khía cạnh | Đánh giá | Ghi chú |
|-----------|----------|---------|
| **Kỹ thuật** | ✅ Hoàn toàn khả thi | Scraping + ROOM — không phụ thuộc API |
| **Pháp lý** | ⚠️ Cần cẩn thận | Phải tuân thủ ステマ規制 + Rakuten ToS |
| **Doanh thu** | 🤷 Tuỳ quy mô | Cap ¥1,000/item → cần volume lớn |
| **Cạnh tranh** | ⚠️ Trung bình-cao | Nhiều người đã làm, cần USP |

### 10.2 Ước tính doanh thu

```
Scenario: 5 bài/ngày × 30 ngày = 150 bài/tháng

Pessimistic (tháng đầu):
  150 bài × 5 clicks/bài = 750 clicks
  × 2% conversion = 15 orders
  × ¥500 avg commission = ¥7,500/tháng

Realistic (sau 3-6 tháng, có following):
  150 bài × 50 clicks/bài = 7,500 clicks
  × 3% conversion = 225 orders
  × ¥600 avg commission = ¥135,000/tháng

Optimistic (sau 1 năm, multi-platform):
  300 bài × 100 clicks/bài = 30,000 clicks
  × 4% conversion = 1,200 orders
  × ¥700 avg commission = ¥840,000/tháng
```

### 10.3 Khuyến nghị hành động

> [!IMPORTANT]
> **Top 5 điều cần làm NGAY:**
> 
> 1. **Tạo tài khoản Rakuten ROOM** — Miễn phí, là trung tâm affiliate
> 2. **Chọn 2-3 niche category** — Đừng làm "everything store", hãy chuyên môn hoá
> 3. **Thử đăng 5-10 sản phẩm lên ROOM bằng tay** — Hiểu flow trước khi tự động hoá
> 4. **Setup Python + Playwright** — Bắt đầu scrape Super DEAL page
> 5. **Luôn ghi PR/AD khi share link ROOM** — Không có ngoại lệ

> [!WARNING]
> **TUYỆT ĐỐI KHÔNG:**
> - Dùng bot tự động đăng bài 100% không có người review
> - Giả vờ review sản phẩm "tự nhiên" mà không ghi PR
> - Spam link affiliate trong comment/reply/DM
> - Copy nội dung từ shop mà không thêm giá trị

---

## Phụ lục A: Tài liệu tham khảo

| Nguồn | Link |
|-------|------|
| Rakuten ROOM (đăng ký) | https://room.rakuten.co.jp/ |
| Rakuten Affiliate (đăng ký) | https://affiliate.rakuten.co.jp/ |
| Rakuten Affiliate Guidelines | https://affiliate.rakuten.co.jp/guideline/ |
| Rakuten Super DEAL | https://event.rakuten.co.jp/superdeal/ |
| RaCoupon (Coupon page) | https://coupon.rakuten.co.jp/ |
| Rakuten Ranking | https://ranking.rakuten.co.jp/ |
| 景品表示法 (Consumer Affairs Agency) | https://www.caa.go.jp/policies/policy/representation/ |
| Playwright Python Docs | https://playwright.dev/python/ |
| Rakuten Developers (backup API) | https://webservice.rakuten.co.jp/ |

## Phụ lục B: Scraping Target URLs

```python
# Các URL chính cần scrape
SCRAPE_TARGETS = {
    # Super DEAL — Ưu tiên #1
    "super_deal_all": "https://event.rakuten.co.jp/superdeal/",
    "super_deal_timesale": "https://event.rakuten.co.jp/superdeal/timesale/",
    "super_deal_ranking": "https://event.rakuten.co.jp/superdeal/ranking/",
    
    # Search với keywords sale
    "search_half_price": "https://search.rakuten.co.jp/search/mall/半額/",
    "search_50off": "https://search.rakuten.co.jp/search/mall/50%25OFF/",
    "search_timesale": "https://search.rakuten.co.jp/search/mall/タイムセール/",
    "search_clearance": "https://search.rakuten.co.jp/search/mall/在庫処分/",
    
    # Coupon page
    "coupon_main": "https://coupon.rakuten.co.jp/",
    
    # Ranking
    "ranking_overall": "https://ranking.rakuten.co.jp/",
}

# Event URLs (chỉ khi có event)
EVENT_TARGETS = {
    "super_sale": "https://event.rakuten.co.jp/campaign/supersale/",
    "marathon": "https://event.rakuten.co.jp/campaign/point-up/marathon/",
}
```

## Phụ lục C: Checklist trước khi Go-Live

- [ ] Tài khoản Rakuten ROOM đã tạo & profile đã setup
- [ ] Đã thử đăng 5-10 sản phẩm lên ROOM bằng tay
- [ ] Python + Playwright đã cài đặt & chạy được
- [ ] Scraper Super DEAL hoạt động, extract đúng dữ liệu
- [ ] SQLite database schema đã tạo
- [ ] Deal scoring algorithm đã implement
- [ ] AI content engine đã kết nối (OpenAI/Claude/Gemini)
- [ ] Template bài đăng có 【PR】tag cho mọi platform
- [ ] Hiểu rõ ステマ規制 và cam kết tuân thủ
- [ ] Workflow: Scrape → Xem deal → Đăng ROOM → Copy content → Post

## Phụ lục D: Project Structure

```
rakuten-hunter/
├── REPORT_rakuten_affiliate_automation.md  # Báo cáo này
├── requirements.txt
├── config.py                  # Cấu hình (URLs, thresholds, API keys)
├── src/
│   ├── scraper/
│   │   ├── base_scraper.py    # Base class cho scraping
│   │   ├── superdeal.py       # Scraper trang Super DEAL
│   │   ├── search.py          # Scraper search results
│   │   ├── coupon.py          # Scraper coupon page
│   │   └── ranking.py         # Scraper ranking page
│   ├── analyzer/
│   │   ├── scorer.py          # Deal scoring algorithm
│   │   └── dedup.py           # Deduplication logic
│   ├── content/
│   │   ├── generator.py       # AI content generation
│   │   ├── templates.py       # Templates cho FB/TikTok/Message
│   │   └── image_maker.py     # Tạo banner ảnh
│   └── db/
│       ├── models.py          # SQLite models
│       └── database.py        # DB operations
├── data/
│   └── deals.db               # SQLite database
├── output/
│   ├── daily_deals/           # Top deals mỗi ngày
│   └── posts/                 # Bài đăng đã sinh
└── scripts/
    ├── run_scraper.py         # Chạy scraper
    ├── show_deals.py          # Xem top deals hôm nay
    └── generate_posts.py      # Sinh bài đăng từ ROOM link
```

---

> **Tài liệu này được tạo ngày 2026-06-29, cập nhật 2026-06-30.**  
> **Phương pháp chính:** Web Scraping + Rakuten ROOM (không phụ thuộc API)  
> Lưu ý: Quy định và cấu trúc trang Rakuten có thể thay đổi. Luôn kiểm tra nguồn chính thức trước khi triển khai.
