/** Gera os ícones do PWA a partir da dama azul. */
const fs = require("fs");
const path = require("path");
let sharp;
try { sharp = require("sharp"); } catch { console.log("instale sharp"); process.exit(0); }

const src = ["src/assets/king-blue-front.jpg", "src/assets/king-blue-front.png"]
  .map((p) => path.join(__dirname, "..", p))
  .find(fs.existsSync);
if (!src) { console.log("sprite da dama não encontrado"); process.exit(0); }

const out = path.join(__dirname, "..", "public");
(async () => {
  for (const size of [192, 512]) {
    const pad = Math.round(size * 0.1);
    await sharp({
      create: { width: size, height: size, channels: 4, background: "#0b1030" },
    })
      .composite([
        {
          input: await sharp(src)
            .resize(size - pad * 2, size - pad * 2, { fit: "contain", background: "#0b1030" })
            .toBuffer(),
          top: pad,
          left: pad,
        },
      ])
      .png()
      .toFile(path.join(out, `icon-${size}.png`));
  }
  console.log("ícones gerados: icon-192.png, icon-512.png");
})();
