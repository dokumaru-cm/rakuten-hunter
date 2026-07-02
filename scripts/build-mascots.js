"use strict";

/**
 * Build mascot assets từ sheet gốc (nét sạch, nền trắng) → PNG transparent cắt sát.
 *
 * Vì sao: các file rời sailor-usagi-02..11.png bị viền đen lởm chởm (halo) → "lem".
 * Bản trên sheet nét gọn, nền trắng. Script này:
 *   1. Khử nền trắng bằng flood-fill từ 4 viền (nội thất trắng của nhân vật được
 *      bao bởi nét đen nên không bị xóa).
 *   2. Dọn fringe xám nhạt sát mép.
 *   3. Tách pose theo lưới cols x rows, loại chữ label bên dưới, cắt sát + padding.
 *
 * Cấu hình SHEETS bên dưới — mỗi sheet khai báo lưới + map pose → [row, col].
 * Chạy:  node scripts/build-mascots.js
 */

const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const ROOT = path.join(__dirname, "..");

// Mỗi entry: sheet nguồn, lưới, thư mục đích, map tên pose → vị trí [row, col].
const SHEETS = [
  {
    sheet: path.join(ROOT, "resource", "character", "usagi", "sailor-usagi-sheet-01.png"),
    outDir: path.join(ROOT, "assets", "mascot"),
    cols: 4,
    rows: 2,
    poses: {
      pointing: [0, 0],
      excited: [0, 1],
      surprised: [0, 2],
      winking: [0, 3],
      inviting: [1, 0],
    },
  },
  {
    sheet: path.join(ROOT, "assets", "mascot_2", "mascot_set_1.png"),
    outDir: path.join(ROOT, "assets", "mascot_2"),
    cols: 4,
    rows: 2,
    poses: {
      pointing: [0, 0],
      excited: [0, 1],
      surprised: [0, 2],
      winking: [0, 3],
      inviting: [1, 0],
      happy: [1, 1],
      sad: [1, 2],
      cute: [1, 3],
    },
  },
  {
    sheet: path.join(ROOT, "assets", "mascot_2", "mascot_set_2.png"),
    outDir: path.join(ROOT, "assets", "mascot_2"),
    cols: 2,
    rows: 1,
    poses: {
      hello: [0, 0],
      byebye: [0, 1],
    },
  },
];

const WHITE = 235; // ngưỡng coi là nền trắng để flood-fill
const FRINGE = 225; // ngưỡng dọn fringe sát mép

/** Khử nền trắng (flood-fill từ viền) + dọn fringe. Trả về ImageData đã sửa. */
function removeBackground(ctx, W, H) {
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const N = W * H;

  // 1. Flood-fill nền trắng từ viền.
  const bg = new Uint8Array(N);
  const isWhite = (i) => { const p = i * 4; return d[p] >= WHITE && d[p + 1] >= WHITE && d[p + 2] >= WHITE; };
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (bg[i] || !isWhite(i)) return;
    bg[i] = 1; stack.push(i);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const i = stack.pop(); const x = i % W, y = (i / W) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  for (let i = 0; i < N; i++) if (bg[i]) d[i * 4 + 3] = 0;

  // 2. Dọn fringe: pixel gần trắng, giáp nền → trong suốt.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; const p = i * 4;
      if (bg[i] || d[p + 3] === 0) continue;
      if (d[p] >= FRINGE && d[p + 1] >= FRINGE && d[p + 2] >= FRINGE) {
        if (bg[i - 1] || bg[i + 1] || bg[i - W] || bg[i + W]) d[p + 3] = 0;
      }
    }
  }
  return id;
}

/**
 * Xóa các mảnh lem từ ô kề: thành phần liên thông NHỎ chạm mép trái/phải của ô
 * (hình của pose bên cạnh tràn qua ranh giới lưới). Sparkle/tim nằm gọn trong ô
 * không chạm mép nên được giữ. Mutate trực tiếp alpha trong vùng ô.
 */
function dropEdgeBleed(id, W, cell) {
  const d = id.data;
  const { x0, x1, y0, y1 } = cell;
  const cw = x1 - x0, chh = y1 - y0;
  const label = new Int32Array(cw * chh).fill(-1);
  const comps = []; // {size, touchesEdge, pixels[]}
  const li = (x, y) => (y - y0) * cw + (x - x0);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (d[(y * W + x) * 4 + 3] <= 10 || label[li(x, y)] !== -1) continue;
      const idx = comps.length;
      const comp = { size: 0, touchesEdge: false, pixels: [] };
      comps.push(comp);
      const stack = [[x, y]];
      label[li(x, y)] = idx;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        comp.size++;
        comp.pixels.push(cy * W + cx);
        if (cx <= x0 + 1 || cx >= x1 - 2) comp.touchesEdge = true;
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue;
          if (d[(ny * W + nx) * 4 + 3] <= 10 || label[li(nx, ny)] !== -1) continue;
          label[li(nx, ny)] = idx;
          stack.push([nx, ny]);
        }
      }
    }
  }
  if (!comps.length) return;
  const maxSize = Math.max(...comps.map((c) => c.size));
  for (const c of comps) {
    // Nhỏ hơn hẳn nhân vật + chạm mép ô → là bleed, xóa.
    if (c.touchesEdge && c.size < maxSize * 0.5) {
      for (const pi of c.pixels) d[pi * 4 + 3] = 0;
    }
  }
}

/** Tách 1 pose từ ô lưới: tìm band nhân vật (bỏ label), cắt sát + padding. */
function extractPose(id, W, cell, outFile) {
  const d = id.data;
  const { x0, x1, y0, y1 } = cell;
  const alphaAt = (x, y) => d[(y * W + x) * 4 + 3] > 10;
  dropEdgeBleed(id, W, cell);

  // Row projection để lấy band nhân vật (label tách khỏi band bởi khoảng trống).
  const rowCount = new Array(y1);
  for (let y = y0; y < y1; y++) { let cnt = 0; for (let x = x0; x < x1; x++) if (alphaAt(x, y)) cnt++; rowCount[y] = cnt; }

  let bandTop = -1, bandBot = -1, y = y0;
  while (y < y1) {
    if (rowCount[y] > 3) {
      const start = y; let last = y, gap = 0;
      while (y < y1 && (rowCount[y] > 3 || gap < 20)) { if (rowCount[y] > 3) { last = y; gap = 0; } else gap++; y++; }
      if (last - start > 150) { bandTop = start; bandBot = last; break; }
    } else y++;
  }
  if (bandTop < 0) { bandTop = y0; bandBot = y1 - 1; }

  // Col bounds trong band.
  let left = x1, right = x0;
  for (let yy = bandTop; yy <= bandBot; yy++) for (let x = x0; x < x1; x++) if (alphaAt(x, yy)) { if (x < left) left = x; if (x > right) right = x; }

  const pad = 8;
  left = Math.max(x0, left - pad); right = Math.min(x1 - 1, right + pad);
  bandTop = Math.max(y0, bandTop - pad); bandBot = Math.min(y1 - 1, bandBot + pad);

  const w = right - left + 1, h = bandBot - bandTop + 1;
  const oc = createCanvas(w, h); const octx = oc.getContext("2d");
  octx.putImageData(id, -left, -bandTop, left, bandTop, w, h);
  fs.writeFileSync(outFile, oc.toBuffer("image/png"));
  return { w, h };
}

async function processSheet({ sheet, outDir, cols, rows, poses }) {
  if (!fs.existsSync(sheet)) {
    console.warn(`⏭️  Bỏ qua (không thấy sheet): ${sheet}`);
    return;
  }
  fs.mkdirSync(outDir, { recursive: true });
  const img = await loadImage(sheet);
  const W = img.width, H = img.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const id = removeBackground(ctx, W, H);

  const cw = W / cols, ch = H / rows;
  console.log(`📄 ${path.basename(sheet)} (${W}x${H}, lưới ${cols}x${rows})`);
  for (const [name, [r, c]] of Object.entries(poses)) {
    const cell = {
      x0: Math.floor(c * cw), x1: Math.floor((c + 1) * cw),
      y0: Math.floor(r * ch), y1: Math.floor((r + 1) * ch),
    };
    const outFile = path.join(outDir, `mascot_${name}.png`);
    const { w, h } = extractPose(id, W, cell, outFile);
    console.log(`   ✅ mascot_${name}.png  ${w}x${h}`);
  }
}

async function main() {
  for (const cfg of SHEETS) await processSheet(cfg);
  console.log("Xong.");
}

main().catch((e) => { console.error(e); process.exit(1); });
