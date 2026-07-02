"use strict";

const fs = require("fs");
const path = require("path");
const { OutputSink } = require("./sink");
const { ensureDir, escapeHtml, formatPrice, stampForFilename } = require("../utils/helpers");
const logger = require("../utils/logger");

/**
 * LocalSink — catalog cục bộ (Phase 0-4) thay cho Telegram.
 *
 * - Hiển thị TẤT CẢ sản phẩm (search / filter / sort client-side).
 * - Deal "featured" (top hot) có ảnh promo mascot + bài Facebook/message để copy.
 * - Deal thường dùng thumbnail Rakuten + thông tin sale/point rõ ràng.
 * - close(): render output/index.html.
 */
class LocalSink extends OutputSink {
  constructor(outputDir) {
    super();
    this.outputDir = outputDir;
    this.imagesDir = path.join(outputDir, "images");
    this.deals = [];
  }

  async init() {
    ensureDir(this.outputDir);
    ensureDir(this.imagesDir);
    this.deals = [];
    logger.info(`LocalSink → ${this.outputDir}`);
  }

  async sendDeal(deal, content, image) {
    let imageFile = null;
    if (image) {
      const fname = `${deal.id || "deal"}.png`;
      const dest = path.join(this.imagesDir, fname);
      if (Buffer.isBuffer(image)) {
        fs.writeFileSync(dest, image);
        imageFile = path.posix.join("images", fname);
      } else if (typeof image === "string" && fs.existsSync(image)) {
        fs.copyFileSync(image, dest);
        imageFile = path.posix.join("images", fname);
      }
    }
    this.deals.push({ deal, content: content || {}, imageFile });
  }

  async close() {
    this.deals.sort((a, b) => (b.deal.score || 0) - (a.deal.score || 0));
    const html = renderPage(this.deals);
    const indexPath = path.join(this.outputDir, "index.html");
    fs.writeFileSync(indexPath, html, "utf8");
    logger.info(`✅ Đã ghi ${this.deals.length} sản phẩm → ${indexPath}`);
    return indexPath;
  }
}

/* ----------------------------- HTML rendering ----------------------------- */

/**
 * Hàng hành động cho 1 loại content (Facebook / Bạn bè): nút copy nhanh + nút 👁
 * mở dialog xem đầy đủ. Text thật nằm trong <pre> ẩn (kind="fb"|"msg") để JS đọc
 * qua textContent — nội dung KHÔNG hiển thị trực tiếp trên card.
 */
function contentRow(label, icon, text, kind) {
  if (!text) return "";
  return `
      <div class="actions">
        <button class="actbtn" data-kind="${kind}" onclick="quickCopy(this)">${icon} Copy ${escapeHtml(label)}</button>
        <button class="eyebtn" data-kind="${kind}" onclick="openModal(this)" title="Xem nội dung ${escapeHtml(label)}">👁</button>
      </div>
      <pre class="raw hidden" data-kind="${kind}" data-label="${escapeHtml(label)}">${escapeHtml(text)}</pre>`;
}

function renderCard({ deal, content, imageFile }) {
  const hot = (deal.score || 0) >= 85;
  const featured = Boolean(imageFile);
  const img = imageFile
    ? `<img class="promo" src="${escapeHtml(imageFile)}" alt="promo" loading="lazy">`
    : deal.imageUrl
      ? `<img class="promo thumb" src="${escapeHtml(deal.imageUrl)}" alt="${escapeHtml(deal.itemName)}" loading="lazy">`
      : `<div class="promo noimg">no image</div>`;

  // Chips sale / point / super deal.
  const chips = [];
  if (deal.isSuperDeal) chips.push(`<span class="chip sd">SUPER DEAL</span>`);
  if (deal.discountPercent > 0) chips.push(`<span class="chip sale">SALE −${escapeHtml(String(deal.discountPercent))}%</span>`);
  if (deal.pointRate > 0) chips.push(`<span class="chip point">ポイント +${escapeHtml(String(deal.pointRate))}% (${formatPrice(deal.pointAmount)})</span>`);
  if (deal.dealEndTime) chips.push(`<span class="chip time">期間限定</span>`);

  const priceHtml = deal.originalPrice && deal.originalPrice > deal.currentPrice
    ? `<span class="strike">${formatPrice(deal.originalPrice)}</span> <span class="cur">${formatPrice(deal.currentPrice)}</span>`
    : `<span class="cur">${formatPrice(deal.currentPrice)}</span>`;

  const searchKey = `${deal.itemName || ""} ${deal.shopName || ""}`.toLowerCase();

  return `
  <article class="card${hot ? " hot" : ""}${featured ? " featured" : ""}"
    data-name="${escapeHtml(searchKey)}"
    data-genre="${escapeHtml(deal.genreName || "")}"
    data-source="${escapeHtml(deal.sourcePage || "")}"
    data-score="${deal.score || 0}"
    data-price="${deal.currentPrice || 0}"
    data-discount="${deal.discountPercent || 0}"
    data-point="${deal.pointRate || 0}"
    data-sale="${deal.discountPercent > 0 ? 1 : 0}">
    <div class="imgwrap">${img}<span class="scorebadge${hot ? " hot" : ""}">${escapeHtml(String(deal.score ?? "?"))}</span></div>
    <div class="body">
      <div class="chips">${chips.join(" ")}</div>
      <h2>${escapeHtml(deal.itemName || "(no name)")}</h2>
      <div class="shop">${escapeHtml(deal.shopName || "")} · <span class="genre">${escapeHtml(deal.genreName || "")}</span></div>
      <div class="price">${priceHtml}</div>
      <div class="eff">💎 Thực tế <b>${formatPrice(deal.effectivePrice)}</b>${deal.savingsPercent > 0 ? ` · tiết kiệm ${escapeHtml(String(deal.savingsPercent))}%` : ""}</div>
      <div class="rev">${deal.reviewCount > 0 ? `★ ${escapeHtml(String(deal.reviewAverage))}/5 (${escapeHtml(String(deal.reviewCount))})` : "chưa có review"}
        · <a href="${escapeHtml(deal.itemUrl || "#")}" target="_blank" rel="noopener">Rakuten ↗</a></div>
      ${contentRow("Facebook", "📘", content.facebookPost, "fb")}
      ${contentRow("tin nhắn", "💬", content.friendMessage, "msg")}
    </div>
  </article>`;
}

function renderPage(deals) {
  const cards = deals.map(renderCard).join("\n");
  const when = stampForFilename();
  const genres = [...new Set(deals.map((d) => d.deal.genreName).filter(Boolean))].sort();
  const genreOpts = ['<option value="all">Tất cả loại</option>']
    .concat(genres.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`))
    .join("");
  const featuredCount = deals.filter((d) => d.imageFile).length;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rakuten Hunter — ${deals.length} deals</title>
<style>
  :root { --bg:#0f1115; --card:#1a1d24; --line:#2a2f3a; --txt:#e6e8ec; --muted:#9aa3b2;
          --hot:#ff5252; --sale:#ff5252; --point:#ffb300; --sd:#7c4dff; --blue:#4aa8ff; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--txt);
         font-family:"Segoe UI", system-ui, "Noto Sans JP", sans-serif; }
  header { position:sticky; top:0; z-index:10; background:rgba(15,17,21,.96);
           backdrop-filter:blur(6px); border-bottom:1px solid var(--line); padding:14px 20px; }
  h1 { font-size:18px; margin:0 0 10px; }
  h1 small { color:var(--muted); font-weight:400; font-size:13px; }
  .toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .toolbar input[type=search], .toolbar select, .toolbar label {
    background:var(--card); color:var(--txt); border:1px solid var(--line);
    border-radius:8px; padding:7px 10px; font-size:13px; }
  .toolbar input[type=search] { min-width:240px; flex:1; }
  .toolbar label { display:flex; align-items:center; gap:6px; cursor:pointer; }
  #count { color:var(--muted); font-size:13px; margin-left:auto; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr));
          gap:16px; padding:20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px;
          overflow:hidden; display:flex; flex-direction:column; }
  .card.hot { border-color:var(--hot); }
  .imgwrap { position:relative; }
  .promo { width:100%; display:block; }
  .promo.thumb { aspect-ratio:1/1; object-fit:contain; background:#fff; }
  .promo.noimg { aspect-ratio:1200/628; display:flex; align-items:center; justify-content:center; color:var(--muted); }
  .scorebadge { position:absolute; top:8px; right:8px; background:rgba(0,0,0,.7);
    color:#fff; font-size:12px; font-weight:700; padding:3px 9px; border-radius:20px; }
  .scorebadge.hot { background:var(--hot); }
  .body { padding:12px 14px 16px; display:flex; flex-direction:column; gap:7px; }
  .chips { display:flex; flex-wrap:wrap; gap:5px; }
  .chip { font-size:11px; font-weight:700; padding:3px 8px; border-radius:6px; color:#fff; }
  .chip.sale { background:var(--sale); } .chip.point { background:var(--point); color:#1a1d24; }
  .chip.sd { background:var(--sd); } .chip.time { background:#455a64; }
  h2 { font-size:13.5px; line-height:1.4; margin:0; font-weight:600;
       display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .shop { color:var(--muted); font-size:11.5px; } .genre { color:var(--blue); }
  .price { font-size:13px; } .price .strike { text-decoration:line-through; color:var(--muted); margin-right:6px; }
  .price .cur { font-size:20px; font-weight:800; color:#ffd54f; }
  .eff { font-size:12.5px; } .rev { font-size:12px; color:var(--muted); } .rev a { color:var(--blue); }
  .actions { display:flex; gap:6px; margin-top:2px; }
  .actbtn { flex:1; background:#2b6cff; color:#fff; border:0; border-radius:7px;
            padding:7px 8px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap;
            overflow:hidden; text-overflow:ellipsis; }
  .actbtn.ok { background:#22a06b; }
  .eyebtn { background:var(--card); color:var(--txt); border:1px solid var(--line);
            border-radius:7px; width:36px; font-size:15px; cursor:pointer; flex:0 0 auto; }
  .eyebtn:hover { border-color:var(--blue); }
  pre { margin:0; padding:9px; white-space:pre-wrap; word-break:break-word; font-family:inherit; font-size:11.5px; line-height:1.55; }
  .hidden { display:none !important; }
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:100;
                   display:flex; align-items:center; justify-content:center; padding:20px; }
  .modal { background:var(--card); border:1px solid var(--line); border-radius:14px;
           max-width:560px; width:100%; max-height:80vh; display:flex; flex-direction:column; overflow:hidden; }
  .modal-head { padding:14px 18px; font-size:14px; font-weight:700; border-bottom:1px solid var(--line); }
  .modal-body { padding:14px 18px; overflow:auto; }
  .modal-body pre { padding:0; font-size:13px; line-height:1.7; }
  .modal-actions { display:flex; gap:8px; padding:14px 18px; border-top:1px solid var(--line); }
  .modal-actions .actbtn { flex:1; padding:10px; font-size:13px; }
  .modal-actions .pgbtn { flex:0 0 auto; padding:0 18px; }
  .pager { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; align-items:center; padding:8px 20px 40px; }
  .pgbtn { background:var(--card); color:var(--txt); border:1px solid var(--line);
           border-radius:8px; min-width:36px; height:36px; padding:0 10px; font-size:13px; cursor:pointer; }
  .pgbtn:hover:not(:disabled) { border-color:var(--blue); }
  .pgbtn.active { background:var(--blue); border-color:var(--blue); color:#001; font-weight:700; }
  .pgbtn:disabled { opacity:.4; cursor:default; }
  .pgell { color:var(--muted); padding:0 2px; }
</style>
</head>
<body>
<header>
  <h1>🐰 Rakuten Hunter <small>${deals.length} sản phẩm (đều có bài viết) · ${featuredCount} có ảnh promo · ${when} JST</small></h1>
  <div class="toolbar">
    <input type="search" id="q" placeholder="🔍 Tìm theo tên sản phẩm / shop...">
    <select id="genre">${genreOpts}</select>
    <select id="source">
      <option value="all">Mọi nguồn</option>
      <option value="superdeal">Super DEAL</option>
      <option value="search">Search</option>
    </select>
    <select id="sort">
      <option value="score">Sắp xếp: Điểm ↓</option>
      <option value="price-asc">Giá ↑</option>
      <option value="price-desc">Giá ↓</option>
      <option value="discount">Giảm % ↓</option>
      <option value="point">Point % ↓</option>
    </select>
    <label><input type="checkbox" id="saleOnly"> Chỉ hàng giảm giá</label>
    <label><input type="checkbox" id="featOnly"> Chỉ deal có ảnh promo</label>
    <label>Điểm ≥ <input type="range" id="minScore" min="0" max="100" step="5" value="0" style="width:90px"><span id="minScoreVal">0</span></label>
    <span id="count"></span>
  </div>
</header>
<div class="grid" id="grid">
${cards || '<p style="color:var(--muted)">Không có sản phẩm.</p>'}
</div>
<div class="pager" id="pager"></div>

<div class="modal-overlay hidden" id="modalOverlay">
  <div class="modal">
    <div class="modal-head" id="modalTitle"></div>
    <div class="modal-body"><pre id="modalText"></pre></div>
    <div class="modal-actions">
      <button class="actbtn" id="modalCopyBtn">Copy</button>
      <button class="pgbtn" id="modalCloseBtn">Đóng</button>
    </div>
  </div>
</div>

<script>
  const PER_PAGE = 20;
  let page = 1;
  const grid = document.getElementById('grid'), pager = document.getElementById('pager');
  const cards = [...grid.querySelectorAll('.card')];
  const q = document.getElementById('q'), genre = document.getElementById('genre');
  const source = document.getElementById('source'), sortSel = document.getElementById('sort');
  const saleOnly = document.getElementById('saleOnly'), featOnly = document.getElementById('featOnly');
  const minScore = document.getElementById('minScore'), minScoreVal = document.getElementById('minScoreVal');
  const count = document.getElementById('count');

  function pass(c){
    const term = q.value.trim().toLowerCase();
    if (term && !c.dataset.name.includes(term)) return false;
    if (genre.value !== 'all' && c.dataset.genre !== genre.value) return false;
    if (source.value !== 'all' && c.dataset.source !== source.value) return false;
    if (saleOnly.checked && c.dataset.sale !== '1') return false;
    if (featOnly.checked && !c.classList.contains('featured')) return false;
    if (+c.dataset.score < +minScore.value) return false;
    return true;
  }
  function applySort(){
    const key = sortSel.value;
    const val = (c) => ({
      score:+c.dataset.score, 'price-asc':+c.dataset.price, 'price-desc':+c.dataset.price,
      discount:+c.dataset.discount, point:+c.dataset.point
    })[key];
    const asc = key === 'price-asc';
    [...grid.querySelectorAll('.card')].sort((a,b) => asc ? val(a)-val(b) : val(b)-val(a))
      .forEach(c => grid.appendChild(c));
  }
  function update(){
    minScoreVal.textContent = minScore.value;
    const dom = [...grid.querySelectorAll('.card')];
    const visible = dom.filter(pass);
    const pages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
    page = Math.min(Math.max(1, page), pages);
    const start = (page - 1) * PER_PAGE;
    const slice = new Set(visible.slice(start, start + PER_PAGE));
    dom.forEach(c => c.classList.toggle('hidden', !slice.has(c)));
    count.textContent = visible.length + ' sản phẩm · trang ' + page + '/' + pages;
    renderPager(pages);
  }
  function renderPager(pages){
    pager.innerHTML = '';
    if (pages <= 1) return;
    const mk = (label, target, opts={}) => {
      const b = document.createElement('button');
      b.textContent = label; b.className = 'pgbtn' + (opts.active ? ' active' : '');
      if (opts.disabled) b.disabled = true;
      else b.onclick = () => { page = target; update(); window.scrollTo({top:0, behavior:'smooth'}); };
      return b;
    };
    pager.appendChild(mk('‹', page - 1, { disabled: page === 1 }));
    const nums = new Set([1, pages]);
    for (let i = page - 2; i <= page + 2; i++) if (i >= 1 && i <= pages) nums.add(i);
    let prev = 0;
    for (const n of [...nums].sort((a,b)=>a-b)) {
      if (n - prev > 1) { const s = document.createElement('span'); s.textContent = '…'; s.className = 'pgell'; pager.appendChild(s); }
      pager.appendChild(mk(n, n, { active: n === page })); prev = n;
    }
    pager.appendChild(mk('›', page + 1, { disabled: page === pages }));
  }
  [q,genre,source,saleOnly,featOnly,minScore].forEach(el => el.addEventListener('input', () => { page = 1; update(); }));
  sortSel.addEventListener('change', () => { applySort(); page = 1; update(); });
  // --- Copy nhanh trên card (không mở dialog) ---
  function copyPlain(text, onDone){
    navigator.clipboard.writeText(text).then(onDone);
  }
  function flashBtn(btn, okLabel){
    const orig = btn.textContent;
    btn.textContent = okLabel; btn.classList.add('ok');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('ok'); }, 1400);
  }
  function quickCopy(btn){
    const pre = btn.closest('.body').querySelector('pre.raw[data-kind="' + btn.dataset.kind + '"]');
    copyPlain(pre.textContent, () => flashBtn(btn, 'Đã copy ✓'));
  }
  window.quickCopy = quickCopy;

  // --- Dialog xem nội dung đầy đủ ---
  const overlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalText = document.getElementById('modalText');
  const modalCopyBtn = document.getElementById('modalCopyBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  function openModal(btn){
    const pre = btn.closest('.body').querySelector('pre.raw[data-kind="' + btn.dataset.kind + '"]');
    modalTitle.textContent = pre.dataset.label;
    modalText.textContent = pre.textContent;
    overlay.classList.remove('hidden');
  }
  function closeModal(){ overlay.classList.add('hidden'); }
  window.openModal = openModal;

  modalCopyBtn.addEventListener('click', () => copyPlain(modalText.textContent, () => flashBtn(modalCopyBtn, 'Đã copy ✓')));
  modalCloseBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  update();
</script>
</body>
</html>`;
}

module.exports = { LocalSink };
