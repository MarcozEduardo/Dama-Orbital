// ─────────────────────────────────────────────────────────────
//  TELA DE GUERRA — monitor CRT sobre o painel do menu.
//  Mostra duas damas se enfrentando em loop (mira → tiro →
//  explosão → falha de sinal), como se a guerra já rolasse.
//  Quando há diálogo, a tela vira terminal de mensagens.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";

interface Props {
  blueSprite: string;
  redSprite: string;
  /** desliga a animação de batalha e escurece (modo terminal) */
  dimmed?: boolean;
  className?: string;
}

const W = 320;
const H = 108;

export default function WarScreen({ blueSprite, redSprite, dimmed = false, className = "" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dimRef = useRef(dimmed);
  dimRef.current = dimmed;

  useEffect(() => {
    const cv = ref.current!;
    cv.width = W;
    cv.height = H;
    const cx = cv.getContext("2d")!;
    cx.imageSmoothingEnabled = false;

    const blue = new Image();
    blue.src = blueSprite;
    const red = new Image();
    red.src = redSprite;

    let raf = 0;
    const t0 = performance.now();
    // partículas de explosão
    let boom: { x: number; y: number; t: number } | null = null;
    let glitchUntil = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const t = (now - t0) / 1000;
      const cycle = t % 6.2; // duração de uma "cena"

      // fundo do CRT
      cx.fillStyle = dimRef.current ? "#04120f" : "#061a16";
      cx.fillRect(0, 0, W, H);

      // grade de fundo
      cx.strokeStyle = "rgba(60,255,170,.07)";
      cx.lineWidth = 1;
      for (let x = 0; x < W; x += 16) {
        cx.beginPath();
        cx.moveTo(x + 0.5, 0);
        cx.lineTo(x + 0.5, H);
        cx.stroke();
      }
      for (let y = 0; y < H; y += 12) {
        cx.beginPath();
        cx.moveTo(0, y + 0.5);
        cx.lineTo(W, y + 0.5);
        cx.stroke();
      }

      if (!dimRef.current) {
        // chão
        cx.fillStyle = "rgba(30,120,90,.25)";
        cx.fillRect(0, H - 20, W, 20);

        const bx = 52 + Math.sin(t * 1.6) * 3;
        const rx = W - 52 + Math.sin(t * 1.3 + 2) * 3;
        const by = H - 34;

        // ── fase de mira: laser da azul na vermelha ──
        if (cycle > 1.1 && cycle < 2.3) {
          const p = (cycle - 1.1) / 1.2;
          cx.strokeStyle = `rgba(255,70,70,${0.35 + Math.sin(t * 30) * 0.25})`;
          cx.lineWidth = 1;
          cx.beginPath();
          cx.moveTo(bx + 14, by - 6);
          cx.lineTo(bx + 14 + (rx - bx - 22) * p, by - 6);
          cx.stroke();
          // reticula
          cx.strokeStyle = "#ff4d4d";
          cx.beginPath();
          cx.arc(rx - 4, by - 8, 11 - p * 4, 0, Math.PI * 2);
          cx.stroke();
        }

        // ── tiro ──
        if (cycle > 2.3 && cycle < 3.0) {
          const p = (cycle - 2.3) / 0.7;
          const mx = bx + 16 + (rx - bx - 24) * p;
          const my = by - 8 - Math.sin(p * Math.PI) * 14;
          // rastro
          const g = cx.createLinearGradient(mx - 22, my, mx, my);
          g.addColorStop(0, "rgba(255,140,30,0)");
          g.addColorStop(1, "rgba(255,220,120,.9)");
          cx.fillStyle = g;
          cx.fillRect(mx - 22, my - 2, 22, 4);
          cx.fillStyle = "#ffe9a8";
          cx.fillRect(mx, my - 2, 6, 4);
          cx.fillStyle = "#e14b3a";
          cx.fillRect(mx + 5, my - 2, 3, 4);
          if (p > 0.93 && !boom) {
            boom = { x: rx - 4, y: by - 10, t: now };
            glitchUntil = now + 420;
          }
        }
        if (cycle < 0.2) boom = null;

        // ── peças ──
        const drawPiece = (img: HTMLImageElement, x: number, hit: boolean) => {
          if (!img.complete || !img.naturalWidth) {
            cx.fillStyle = hit ? "#f43f5e" : "#22d3ee";
            cx.fillRect(x - 10, by - 20, 20, 22);
            return;
          }
          const h = 40;
          const w = (img.naturalWidth / img.naturalHeight) * h;
          cx.save();
          if (hit) {
            cx.globalAlpha = 0.35 + Math.random() * 0.4;
            cx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3);
          }
          cx.drawImage(img, x - w / 2, by - h + 4, w, h);
          cx.restore();
        };
        const hitNow = !!boom && now - boom.t < 500;
        drawPiece(blue, bx, false);
        drawPiece(red, rx, hitNow);

        // ── explosão ──
        if (boom) {
          const age = (now - boom.t) / 620;
          if (age < 1) {
            const R = 8 + age * 42;
            const g = cx.createRadialGradient(boom.x, boom.y, 0, boom.x, boom.y, R);
            const a = 1 - age;
            g.addColorStop(0, `rgba(255,255,220,${a})`);
            g.addColorStop(0.4, `rgba(255,190,60,${a * 0.8})`);
            g.addColorStop(1, "rgba(255,60,20,0)");
            cx.fillStyle = g;
            cx.beginPath();
            cx.arc(boom.x, boom.y, R, 0, Math.PI * 2);
            cx.fill();
            for (let i = 0; i < 10; i++) {
              const ang = (i / 10) * Math.PI * 2;
              const d = R * (1 + age);
              cx.fillStyle = i % 2 ? "#ffd24a" : "#ff6b3a";
              cx.globalAlpha = 1 - age;
              cx.fillRect(boom.x + Math.cos(ang) * d, boom.y + Math.sin(ang) * d, 3, 3);
            }
            cx.globalAlpha = 1;
          }
        }
      }

      // ── falha de sinal ──
      if (now < glitchUntil || Math.random() < 0.006) {
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const y = Math.random() * H;
          const h = 2 + Math.random() * 7;
          const dx = (Math.random() - 0.5) * 22;
          const slice = cx.getImageData(0, y, W, h);
          cx.putImageData(slice, dx, y);
        }
        cx.fillStyle = "rgba(120,255,200,.07)";
        cx.fillRect(0, Math.random() * H, W, 2);
      }

      // varredura
      const sweep = ((now / 26) % (H + 40)) - 20;
      const sg = cx.createLinearGradient(0, sweep - 14, 0, sweep + 14);
      sg.addColorStop(0, "rgba(120,255,200,0)");
      sg.addColorStop(0.5, "rgba(120,255,200,.09)");
      sg.addColorStop(1, "rgba(120,255,200,0)");
      cx.fillStyle = sg;
      cx.fillRect(0, sweep - 14, W, 28);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [blueSprite, redSprite]);

  return <canvas ref={ref} className={`h-full w-full ${className}`} style={{ imageRendering: "pixelated" }} />;
}
