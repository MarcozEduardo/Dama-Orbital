/**
 * Otimiza os sprites de arte para uso web.
 *
 *   node scripts/optimize-assets.cjs
 *
 * Reamostra com Lanczos3 e converte para JPEG (mozjpeg, 4:4:4 para preservar
 * as bordas duras do pixel art). O fundo magenta é removido em runtime pelo
 * chroma-key de src/game/sprites.ts, então não precisamos de alpha aqui —
 * é o que permite trocar PNG por JPEG e cortar ~98% do peso.
 *
 * Requer: npm install --no-save sharp
 */
const fs = require("fs");
const path = require("path");

let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error("Instale o sharp primeiro:  npm install --no-save sharp");
  process.exit(1);
}

const DIR = path.join(__dirname, "..", "src", "assets");
const PUBLIC_SPRITES = path.join(__dirname, "..", "public", "sprites");

// [arquivo, lado máximo em px, qualidade]
const JOBS = [
  ["piece-blue-front", 240, 92],
  ["piece-blue-back", 240, 92],
  ["piece-red-front", 240, 92],
  ["piece-red-back", 240, 92],
  ["king-blue-front", 256, 92],
  ["king-blue-back", 256, 92],
  ["king-red-front", 256, 92],
  ["bobby-head", 256, 92],
  ["marcao", 420, 84],
  ["hangar-bg", 720, 72],
];

(async () => {
  // se a arte bruta estiver em public/sprites, traz para src/assets
  if (fs.existsSync(PUBLIC_SPRITES)) {
    for (const f of fs.readdirSync(PUBLIC_SPRITES)) {
      fs.renameSync(path.join(PUBLIC_SPRITES, f), path.join(DIR, f));
    }
    fs.rmSync(path.join(__dirname, "..", "public"), { recursive: true, force: true });
  }

  let before = 0;
  let after = 0;
  let done = 0;

  for (const [name, size, quality] of JOBS) {
    const src = path.join(DIR, `${name}.png`);
    const out = path.join(DIR, `${name}.jpg`);
    if (!fs.existsSync(src)) continue; // já otimizado

    before += fs.statSync(src).size;
    await sharp(src)
      .resize(size, size, { fit: "inside", kernel: "lanczos3" })
      .jpeg({ quality, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toFile(out);
    fs.unlinkSync(src);
    after += fs.statSync(out).size;
    done++;
  }

  if (done === 0) {
    console.log("Nada a fazer: os assets já estão otimizados.");
    return;
  }
  console.log(
    `${done} imagens: ${(before / 1048576).toFixed(1)}MB -> ${(after / 1024).toFixed(0)}KB ` +
      `(-${(100 - (after / before) * 100).toFixed(1)}%)`,
  );
})();
