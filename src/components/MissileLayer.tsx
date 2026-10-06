// ─────────────────────────────────────────────────────────────
//  MISSILE LAYER — motor de partículas em <canvas> com rAF
//  · mísseis teleguiados (bezier quadrática) e rasantes (flyby)
//  · rastro de fogo/fumaça que apaga sozinho
//  · explosões com anéis de choque e estilhaços
//  Coordenadas em % do tabuleiro (0..100) → resolve em qualquer tamanho.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";

export interface MissileSpec {
  id: number;
  /** origem em % */
  sx: number;
  sy: number;
  /** alvo em % */
  tx: number;
  ty: number;
  /** ms */
  dur: number;
}

interface Props {
  missiles: MissileSpec[];
  missileSprite: string;
  onImpact: (m: MissileSpec) => void;
}

interface Live {
  spec: MissileSpec;
  t0: number;
  cx: number;
  cy: number; // ponto de controle da bezier
  from: { x: number; y: number };
  to: { x: number; y: number };
  impacted: boolean;
}

interface Explosion {
  x: number;
  y: number;
  t0: number;
  power: number;
}

const RES = 560; // resolução interna do canvas

export default function MissileLayer({ missiles, missileSprite, onImpact }: Props) {
  const trailRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<Map<number, Live>>(new Map());
  const boomRef = useRef<Explosion[]>([]);
  const seenRef = useRef<Set<number>>(new Set());
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef(0);
  const onImpactRef = useRef(onImpact);
  onImpactRef.current = onImpact;

  // carrega sprite do míssil
  useEffect(() => {
    const img = new Image();
    img.src = missileSprite;
    img.onload = () => (spriteRef.current = img);
  }, [missileSprite]);

  // registra novos mísseis
  useEffect(() => {
    for (const m of missiles) {
      if (seenRef.current.has(m.id)) continue;
      seenRef.current.add(m.id);
      const from = { x: m.sx, y: m.sy };
      const to = { x: m.tx, y: m.ty };
      // ponto de controle: desvia perpendicular → curva de teleguiado
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const side = (m.id % 2 === 0 ? 1 : -1) * 0.42;
      const cx = (from.x + to.x) / 2 + (-dy / len) * len * side;
      const cy = (from.y + to.y) / 2 + (dx / len) * len * side;
      liveRef.current.set(m.id, { spec: m, t0: performance.now(), cx, cy, from, to, impacted: false });
    }
  }, [missiles]);

  useEffect(() => {
    const trail = trailRef.current!;
    const fx = fxRef.current!;
    trail.width = trail.height = RES;
    fx.width = fx.height = RES;
    const tc = trail.getContext("2d")!;
    const fc = fx.getContext("2d")!;
    fc.imageSmoothingEnabled = false;
    tc.imageSmoothingEnabled = false;

    let last = performance.now();

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const dt = Math.min(64, now - last);
      last = now;

      // ── apaga o rastro gradualmente
      tc.globalCompositeOperation = "destination-out";
      tc.fillStyle = `rgba(0,0,0,${0.055 * (dt / 16)})`;
      tc.fillRect(0, 0, RES, RES);
      tc.globalCompositeOperation = "source-over";

      fc.clearRect(0, 0, RES, RES);

      const P = RES / 100; // % → px

      // ── mísseis
      for (const [id, L] of liveRef.current) {
        const t = Math.min(1, (now - L.t0) / L.spec.dur);
        const u = 1 - t;
        const x = u * u * L.from.x + 2 * u * t * L.cx + t * t * L.to.x;
        const y = u * u * L.from.y + 2 * u * t * L.cy + t * t * L.to.y;
        // derivada → ângulo
        const ddx = 2 * u * (L.cx - L.from.x) + 2 * t * (L.to.x - L.cx);
        const ddy = 2 * u * (L.cy - L.from.y) + 2 * t * (L.to.y - L.cy);
        const ang = Math.atan2(ddy, ddx);

        // rastro: chama + fumaça saindo da traseira
        const bx = (x - Math.cos(ang) * 3.4) * P;
        const by = (y - Math.sin(ang) * 3.4) * P;
        const puffs = 3;
        for (let i = 0; i < puffs; i++) {
          const jx = (Math.random() - 0.5) * 7;
          const jy = (Math.random() - 0.5) * 7;
          const r = 3 + Math.random() * 6;
          const heat = Math.random();
          tc.globalAlpha = 0.5 + Math.random() * 0.35;
          tc.fillStyle =
            heat > 0.72 ? "#fff3c4" : heat > 0.45 ? "#ffd24a" : heat > 0.2 ? "#ff8a2b" : "#7a4a2e";
          tc.beginPath();
          tc.arc(bx + jx, by + jy, r, 0, Math.PI * 2);
          tc.fill();
        }
        tc.globalAlpha = 1;

        // jato de fogo (na camada de FX, mais vivo)
        const flameLen = 16 + Math.random() * 12;
        const grad = fc.createLinearGradient(
          bx,
          by,
          bx - Math.cos(ang) * flameLen,
          by - Math.sin(ang) * flameLen,
        );
        grad.addColorStop(0, "rgba(255,255,220,.95)");
        grad.addColorStop(0.35, "rgba(255,190,60,.8)");
        grad.addColorStop(1, "rgba(255,80,20,0)");
        fc.save();
        fc.translate(bx, by);
        fc.rotate(ang);
        fc.fillStyle = grad;
        fc.beginPath();
        fc.moveTo(0, -5);
        fc.lineTo(-flameLen, 0);
        fc.lineTo(0, 5);
        fc.closePath();
        fc.fill();
        fc.restore();

        // sprite do míssil
        const img = spriteRef.current;
        fc.save();
        fc.translate(x * P, y * P);
        fc.rotate(ang);
        if (img) {
          const w = 34;
          const h = (img.height / img.width) * w;
          fc.drawImage(img, -w / 2, -h / 2, w, h);
        } else {
          fc.fillStyle = "#e8ecff";
          fc.fillRect(-12, -3, 24, 6);
          fc.fillStyle = "#e14b3a";
          fc.fillRect(8, -3, 6, 6);
        }
        fc.restore();

        // impacto
        if (t >= 1 && !L.impacted) {
          L.impacted = true;
          boomRef.current.push({ x: L.to.x, y: L.to.y, t0: now, power: 1 });
          onImpactRef.current(L.spec);
        }
        if (t >= 1 && now - L.t0 > L.spec.dur + 60) liveRef.current.delete(id);
      }

      // ── explosões
      boomRef.current = boomRef.current.filter((b) => {
        const life = (now - b.t0) / (420 * b.power + 180);
        if (life > 1) return false;
        const x = b.x * P;
        const y = b.y * P;
        const R0 = (18 + 42 * b.power) * (0.35 + life * 1.5);

        // bola de fogo
        const g = fc.createRadialGradient(x, y, 0, x, y, R0);
        const a = (1 - life) * 0.95;
        g.addColorStop(0, `rgba(255,255,230,${a})`);
        g.addColorStop(0.3, `rgba(255,206,84,${a * 0.9})`);
        g.addColorStop(0.62, `rgba(255,96,26,${a * 0.65})`);
        g.addColorStop(1, "rgba(120,30,10,0)");
        fc.fillStyle = g;
        fc.beginPath();
        fc.arc(x, y, R0, 0, Math.PI * 2);
        fc.fill();

        // anel de choque
        fc.strokeStyle = `rgba(255,240,200,${(1 - life) * 0.55})`;
        fc.lineWidth = 3 * (1 - life) + 0.6;
        fc.beginPath();
        fc.arc(x, y, R0 * 1.5, 0, Math.PI * 2);
        fc.stroke();

        // estilhaços
        const n = Math.round(9 * b.power) + 4;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + b.t0;
          const d = R0 * (1.1 + life * 1.7);
          const sz = Math.max(1, 4 * (1 - life));
          fc.fillStyle = i % 3 === 0 ? "#fff3c4" : i % 3 === 1 ? "#ffb03a" : "#ff5a2b";
          fc.globalAlpha = 1 - life;
          fc.fillRect(x + Math.cos(ang) * d, y + Math.sin(ang) * d, sz, sz);
        }
        fc.globalAlpha = 1;

        // marca fresca no rastro (fica queimado)
        if (life < 0.12) {
          tc.globalAlpha = 0.5;
          tc.fillStyle = "#1a0d07";
          tc.beginPath();
          tc.arc(x, y, R0 * 0.55, 0, Math.PI * 2);
          tc.fill();
          tc.globalAlpha = 1;
        }
        return true;
      });
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-[45]">
      <canvas ref={trailRef} className="absolute inset-0 h-full w-full" style={{ opacity: 0.92 }} />
      <canvas ref={fxRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
