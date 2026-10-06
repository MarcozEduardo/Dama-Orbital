// ─────────────────────────────────────────────────────────────
//  SPRITES & TEXTURAS  ·  v3 "GUERRA TOTAL"
//  · Sprites PNG (Metal Slug style) com chroma-key em runtime
//  · Damas (kings) parrudas + recoloração por matiz em canvas
//  · Míssil e decalques de queimado gerados proceduralmente
//  · Cache em IndexedDB (fallback localStorage) → boot instantâneo
// ─────────────────────────────────────────────────────────────
import kingBlueFrontUrl from "../assets/king-blue-front.png";
import kingBlueBackUrl from "../assets/king-blue-back.png";
import kingRedFrontUrl from "../assets/king-red-front.png";
import bobbyHeadUrl from "../assets/bobby-head.png";
import type { Player } from "./engine";

// Sprites base ficam em public/sprites e são servidos na raiz do deploy.
const blueFrontUrl = "/sprites/piece-blue-front.png";
const blueBackUrl = "/sprites/piece-blue-back.png";
const redFrontUrl = "/sprites/piece-red-front.png";
const redBackUrl = "/sprites/piece-red-back.png";

const CACHE_VERSION = "damas-orbitais-sprites-v3";

export interface SpriteSet {
  front: Record<Player, string>;
  back: Record<Player, string>;
  kingFront: Record<Player, string>;
  kingBack: Record<Player, string>;
  bobby: string;
  missile: string;
  boardTexture: string;
  crown: string;
  star: string;
}

/** RNG determinístico (jitter de peças, faíscas, textura) */
export function hash01(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("img fail: " + src));
    img.src = src;
  });
}

// ── CACHE ────────────────────────────────────────────────────
function idb(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      if (!("indexedDB" in window)) return res(null);
      const req = indexedDB.open("damas-orbitais", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
      setTimeout(() => res(null), 1500);
    } catch {
      res(null);
    }
  });
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await idb();
    if (db) {
      const val = await new Promise<T | null>((res) => {
        const tx = db.transaction("kv", "readonly");
        const rq = tx.objectStore("kv").get(key);
        rq.onsuccess = () => res((rq.result as T) ?? null);
        rq.onerror = () => res(null);
      });
      if (val) return val;
    }
  } catch {
    /* segue pro fallback */
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await idb();
    if (db) {
      await new Promise<void>((res) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(value, key);
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      });
      return;
    }
  } catch {
    /* fallback */
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota estourada: segue sem cache */
  }
}

// ── CHROMA KEY ───────────────────────────────────────────────
/**
 * Remove o fundo sólido (magenta) por flood-fill a partir das bordas,
 * limpa halo, recorta e devolve PNG dataURL transparente.
 */
async function chromaKey(url: string, size = 224): Promise<string> {
  const img = await loadImage(url);
  const S = size;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const cx = cv.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0, S, S);
  const id = cx.getImageData(0, 0, S, S);
  const d = id.data;

  let bg = [0, 0, 0];
  for (const [px, py] of [
    [3, 3],
    [S - 4, 3],
    [3, S - 4],
    [S - 4, S - 4],
  ]) {
    const o = (py * S + px) * 4;
    bg = [bg[0] + d[o] / 4, bg[1] + d[o + 1] / 4, bg[2] + d[o + 2] / 4];
  }
  const dist = (o: number) => Math.hypot(d[o] - bg[0], d[o + 1] - bg[1], d[o + 2] - bg[2]);

  const TOL = 86;
  const visited = new Uint8Array(S * S);
  const stack: number[] = [];
  const tryPush = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = y * S + x;
    if (visited[i]) return;
    if (dist(i * 4) < TOL) {
      visited[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < S; x++) {
    tryPush(x, 0);
    tryPush(x, S - 1);
  }
  for (let y = 0; y < S; y++) {
    tryPush(0, y);
    tryPush(S - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    d[i * 4 + 3] = 0;
    const x = i % S;
    const y = (i / S) | 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }
  for (let i = 0; i < S * S; i++) if (d[i * 4 + 3] !== 0 && dist(i * 4) < 52) d[i * 4 + 3] = 0;
  for (let y = 1; y < S - 1; y++)
    for (let x = 1; x < S - 1; x++) {
      const i = y * S + x;
      if (d[i * 4 + 3] !== 255) continue;
      const hole =
        d[((y - 1) * S + x) * 4 + 3] === 0 ||
        d[((y + 1) * S + x) * 4 + 3] === 0 ||
        d[(y * S + x - 1) * 4 + 3] === 0 ||
        d[(y * S + x + 1) * 4 + 3] === 0;
      if (hole && dist(i * 4) < TOL * 1.7) d[i * 4 + 3] = 110;
    }
  cx.putImageData(id, 0, 0);

  let minX = S,
    minY = S,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (d[(y * S + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) throw new Error("sprite vazio");

  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(S - 1, maxX + pad);
  maxY = Math.min(S - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const side = Math.max(w, h);
  const out = document.createElement("canvas");
  out.width = out.height = side;
  const ox = out.getContext("2d")!;
  ox.imageSmoothingEnabled = false;
  ox.drawImage(cv, minX, minY, w, h, (side - w) / 2, side - h, w, h);
  return out.toDataURL("image/png");
}

// ── RECOLORAÇÃO POR MATIZ (dama vermelha de costas a partir da azul) ──
function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0;
  let s = 0;
  if (mx !== mn) {
    const dd = mx - mn;
    s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
    if (mx === r) h = ((g - b) / dd + (g < b ? 6 : 0)) * 60;
    else if (mx === g) h = ((b - r) / dd + 2) * 60;
    else h = ((r - g) / dd + 4) * 60;
  }
  return [h, s, l];
}

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number] = [0, 0, 0];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [Math.round((rgb[0] + m) * 255), Math.round((rgb[1] + m) * 255), Math.round((rgb[2] + m) * 255)];
}

/** Desloca apenas a faixa de matiz informada (preserva dourado e metal). */
async function recolorHue(
  dataUrl: string,
  range: [number, number],
  target: number,
  satMul = 1.12,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const cv = document.createElement("canvas");
  cv.width = img.width;
  cv.height = img.height;
  const cx = cv.getContext("2d", { willReadFrequently: true })!;
  cx.imageSmoothingEnabled = false;
  cx.drawImage(img, 0, 0);
  const id = cx.getImageData(0, 0, cv.width, cv.height);
  const d = id.data;
  const mid = (range[0] + range[1]) / 2;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    if (s < 0.12) continue; // cinza/metal: preserva
    if (h >= range[0] && h <= range[1]) {
      const [r, g, b] = hsl2rgb(target + (h - mid) * 0.35, Math.min(1, s * satMul), l);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }
  cx.putImageData(id, 0, 0);
  return cv.toDataURL("image/png");
}

// ── FALLBACKS PROCEDURAIS ────────────────────────────────────
const FC: Record<Player, { dark: string; mid: string; light: string; glow: string; trim: string }> = {
  1: { dark: "#0a4a5e", mid: "#1288ad", light: "#22d3ee", glow: "#a5f3fc", trim: "#e8fbff" },
  2: { dark: "#7c1626", mid: "#b81f3b", light: "#f43f5e", glow: "#ffb347", trim: "#f5b142" },
};

function proceduralPiece(player: Player, face: "front" | "back", king = false): string {
  const S = 120;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const cx = cv.getContext("2d")!;
  const C = FC[player];
  const rng = mulberry32(player * 977 + (face === "front" ? 13 : 71) + (king ? 400 : 0));
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    cx.fillStyle = col;
    cx.fillRect(x, y, w, h);
  };
  const circle = (x: number, y: number, r: number, col: string) => {
    cx.fillStyle = col;
    cx.beginPath();
    cx.arc(x, y, r, 0, Math.PI * 2);
    cx.fill();
  };
  const m = S / 2;
  const k = king ? 1.16 : 1;

  circle(m, 84, 46 * k, "#191724");
  circle(m, 80, 46 * k, "#2b2740");
  circle(m, 80, 40 * k, "#1e1a30");
  if (king) {
    // saia blindada da dama
    circle(m, 78, 44, "#3a3466");
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      rect(m + Math.cos(a) * 38 - 3, 74 + Math.sin(a) * 12, 6, 10, "#241f3d");
    }
  }
  circle(m, 76, 36 * k, C.dark);
  circle(m, 74, 36 * k, C.mid);
  circle(m, 62, 36 * k, C.dark);
  circle(m - 4, 58, 34 * k, C.mid);
  circle(m - 9, 52, 25 * k, C.light);
  circle(m - 13, 46, 13 * k, C.glow);

  if (king) {
    // pods de míssil nos ombros
    for (const sx of [-1, 1]) {
      rect(m + sx * 34 - 7, 44, 14, 17, "#241f3d");
      rect(m + sx * 34 - 5, 46, 10, 5, C.trim);
      rect(m + sx * 34 - 5, 53, 4, 6, "#e14b3a");
      rect(m + sx * 34 + 1, 53, 4, 6, "#e14b3a");
    }
    rect(m - 9, 70, 18, 9, "#d9a514");
    rect(m - 7, 72, 14, 5, "#ffe9a8");
  }

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    circle(m + Math.cos(a) * 31, 71 + Math.sin(a) * 9, 2.4, "#0c0a18");
  }
  if (face === "front") {
    rect(m - 21, 55, 42, 10, "#0c0a18");
    rect(m - 19, 57, 38, 6, C.glow);
    rect(m - 10, 57, 16, 6, "#ffffff");
  } else {
    rect(m - 19, 53, 38, 13, "#0c0a18");
    for (let i = 0; i < 4; i++) rect(m - 15 + i * 9, 55, 5, 9, "#332e4d");
    rect(m - 19, 51, 38, 2, C.trim);
  }
  rect(m + 17, 14, 3, 28, "#0c0a18");
  circle(m + 18.5, 12, 3.6, C.glow);
  for (let i = 0; i < 260; i++) {
    cx.fillStyle = rng() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.09)";
    cx.fillRect(Math.floor(rng() * S), Math.floor(rng() * S), 1.5, 1.5);
  }
  return cv.toDataURL("image/png");
}

function proceduralBobby(): string {
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const cx = cv.getContext("2d")!;
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    cx.fillStyle = c;
    cx.fillRect(x, y, w, h);
  };
  const circle = (x: number, y: number, r: number, c: string) => {
    cx.fillStyle = c;
    cx.beginPath();
    cx.arc(x, y, r, 0, Math.PI * 2);
    cx.fill();
  };
  circle(64, 58, 40, "#151238");
  circle(64, 54, 38, "#252052");
  circle(62, 48, 30, "#312a6b");
  rect(24, 58, 80, 30, "#252052");
  rect(40, 88, 48, 12, "#1b1740"); // queixo
  for (const sx of [-1, 1]) {
    circle(64 + sx * 42, 62, 12, "#151238");
    circle(64 + sx * 42, 60, 9, "#22d3ee");
    circle(64 + sx * 42, 58, 4, "#a5f3fc");
  }
  circle(50, 56, 9, "#ffffff");
  circle(78, 56, 9, "#ffffff");
  circle(50, 57, 4.5, "#0b1030");
  circle(78, 57, 4.5, "#0b1030");
  rect(40, 74, 48, 14, "#07120c");
  for (let i = 0; i < 11; i++)
    for (let j = 0; j < 3; j++)
      rect(42 + i * 4, 76 + j * 4, 2, 2, (i + j) % 3 === 0 ? "#39ff88" : "#0d3a22");
  rect(60, 8, 4, 14, "#151238");
  circle(62, 8, 4, "#39ff88");
  return cv.toDataURL("image/png");
}

async function keyOrFallback(
  url: string,
  player: Player,
  face: "front" | "back",
  king = false,
): Promise<string> {
  try {
    return await chromaKey(url);
  } catch {
    return proceduralPiece(player, face, king);
  }
}

// ── MÍSSIL (procedural, apontando para a DIREITA) ────────────
function makeMissile(): string {
  const W = 40;
  const H = 14;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext("2d")!;
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    cx.fillStyle = c;
    cx.fillRect(x, y, w, h);
  };
  // aletas
  rect(2, 1, 7, 4, "#c4402f");
  rect(2, 9, 7, 4, "#c4402f");
  rect(1, 5, 6, 4, "#3a3466");
  // corpo
  rect(6, 4, 24, 6, "#d9dbe8");
  rect(6, 4, 24, 2, "#ffffff");
  rect(6, 8, 24, 2, "#8b90ad");
  // faixa de perigo
  rect(16, 4, 3, 6, "#ffd24a");
  rect(21, 4, 2, 6, "#16111f");
  // ogiva
  rect(30, 4, 4, 6, "#e14b3a");
  rect(34, 5, 3, 4, "#ff6b52");
  rect(37, 6, 2, 2, "#ffb3a0");
  // bico do escape
  rect(4, 5, 2, 4, "#16111f");
  return cv.toDataURL("image/png");
}

// ── TABULEIRO ────────────────────────────────────────────────
function makeBoardTexture(): string {
  const T = 32;
  const S = T * 8;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const cx = cv.getContext("2d")!;
  const rng = mulberry32(1337);
  for (let ty = 0; ty < 8; ty++)
    for (let tx = 0; tx < 8; tx++) {
      const dark = (tx + ty) % 2 === 1;
      const x = tx * T;
      const y = ty * T;
      cx.fillStyle = dark ? "#161232" : "#252052";
      cx.fillRect(x, y, T, T);
      for (let i = 0; i < 30; i++) {
        cx.fillStyle = rng() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.13)";
        cx.fillRect(x + Math.floor(rng() * T), y + Math.floor(rng() * T), 1, 1);
      }
      cx.fillStyle = "rgba(255,255,255,0.09)";
      cx.fillRect(x, y, T, 1);
      cx.fillRect(x, y, 1, T);
      cx.fillStyle = "rgba(0,0,0,0.38)";
      cx.fillRect(x, y + T - 1, T, 1);
      cx.fillRect(x + T - 1, y, 1, T);
      if (dark)
        for (const [rx, ry] of [
          [3, 3],
          [T - 5, 3],
          [3, T - 5],
          [T - 5, T - 5],
        ]) {
          cx.fillStyle = "#3a3466";
          cx.fillRect(x + rx, y + ry, 2, 2);
          cx.fillStyle = "#5c54a0";
          cx.fillRect(x + rx, y + ry, 1, 1);
        }
      if (rng() < 0.28) {
        cx.fillStyle = "rgba(0,0,0,0.25)";
        let sx = x + 4 + Math.floor(rng() * (T - 10));
        let sy = y + 4 + Math.floor(rng() * (T - 10));
        for (let i = 0; i < 5; i++) {
          cx.fillRect(sx, sy, 2, 1);
          sx += rng() > 0.5 ? 2 : 1;
          sy += rng() > 0.5 ? 1 : -1;
        }
      }
    }
  cx.fillStyle = "rgba(0,0,0,0.42)";
  for (let i = 0; i <= 8; i++) {
    cx.fillRect(i * T - 1, 0, 2, S);
    cx.fillRect(0, i * T - 1, S, 2);
  }
  return cv.toDataURL("image/png");
}

function drawMatrix(art: string[], palette: Record<string, string>): string {
  const h = art.length;
  const w = art[0].length;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const cx = cv.getContext("2d")!;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = art[y][x];
      if (palette[ch]) {
        cx.fillStyle = palette[ch];
        cx.fillRect(x, y, 1, 1);
      }
    }
  return cv.toDataURL("image/png");
}

const makeCrown = () =>
  drawMatrix(
    [
      "..............",
      ".G....G....G..",
      ".GG...G...GG..",
      ".GGG.GGG.GGG..",
      ".GGGGGGGGGGG..",
      ".GGRGGGGGRGG..",
      ".GGGGGGGGGGG..",
      ".DDDDDDDDDDD..",
      "..............",
    ],
    { G: "#ffd24a", D: "#a86e12", R: "#ff4757" },
  );

const makeStar = () =>
  drawMatrix(["...y...", "..yyy..", "yyyyyyy", ".yyyyy.", "..yyy..", ".y...y."], { y: "#ffd24a" });

// ── LOADER ───────────────────────────────────────────────────
export async function loadSprites(onProgress?: (pct: number, label: string) => void): Promise<SpriteSet> {
  const cached = await cacheGet<SpriteSet>(CACHE_VERSION);
  if (cached?.missile && cached.kingFront) {
    onProgress?.(100, "CACHE LOCAL OK");
    return cached;
  }

  let done = 0;
  const total = 7;
  const step = (label: string) => {
    done++;
    onProgress?.(Math.round((done / total) * 100), label);
  };

  onProgress?.(4, "DESCOMPRIMINDO SPRITES");
  const [bf, bb, rf, rb] = await Promise.all([
    keyOrFallback(blueFrontUrl, 1, "front").then((v) => (step("TROPA ALIADA"), v)),
    keyOrFallback(blueBackUrl, 1, "back").then((v) => (step("TROPA ALIADA"), v)),
    keyOrFallback(redFrontUrl, 2, "front").then((v) => (step("TROPA INIMIGA"), v)),
    keyOrFallback(redBackUrl, 2, "back").then((v) => (step("TROPA INIMIGA"), v)),
  ]);

  const [kbf, kbb, krf] = await Promise.all([
    keyOrFallback(kingBlueFrontUrl, 1, "front", true),
    keyOrFallback(kingBlueBackUrl, 1, "back", true),
    keyOrFallback(kingRedFrontUrl, 2, "front", true),
  ]);
  step("BLINDANDO AS DAMAS");

  let krb: string;
  try {
    krb = await recolorHue(kbb, [150, 225], 350, 1.15);
  } catch {
    krb = proceduralPiece(2, "back", true);
  }
  step("CALIBRANDO TURBINAS");

  let bobby: string;
  try {
    bobby = await chromaKey(bobbyHeadUrl, 240);
  } catch {
    bobby = proceduralBobby();
  }
  step("ONLINE: BOBBY");

  const set: SpriteSet = {
    front: { 1: bf, 2: rf },
    back: { 1: bb, 2: rb },
    kingFront: { 1: kbf, 2: krf },
    kingBack: { 1: kbb, 2: krb },
    bobby,
    missile: makeMissile(),
    boardTexture: makeBoardTexture(),
    crown: makeCrown(),
    star: makeStar(),
  };
  void cacheSet(CACHE_VERSION, set);
  return set;
}
