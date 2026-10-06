// ─────────────────────────────────────────────────────────────
//  PLACA HOLOGRÁFICA BÔNUS
//  Entra voando em flash → segura → desintegra em partículas que
//  viajam até a peça que virou DAMA.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { hash01 } from "../game/sprites";
import { sfx } from "../game/audio";

interface Props {
  /** ponto de destino em coordenadas de tela (px) */
  target: { x: number; y: number };
  accent: string;
  /** "mine" = eu conquistei a dama · "rival" = o oponente conquistou */
  tone?: "neutral" | "mine" | "rival";
  ownerName?: string;
  onDone: () => void;
}

/** tempo parado na tela: dá pra ler o nome com calma */
const HOLD = 2900;
/** desintegração + viagem das partículas até a peça */
const DISSOLVE = 1250;
export const HOLO_TOTAL = HOLD + DISSOLVE;

export default function HoloPlaque({ target, accent, tone = "neutral", ownerName, onDone }: Props) {
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    sfx.holo();
    const t1 = window.setTimeout(() => {
      setPhase("out");
      sfx.disintegrate();
    }, HOLD);
    const t2 = window.setTimeout(onDone, HOLD + DISSOLVE);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  const particles = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        ox: (hash01(i * 13 + 1) - 0.5) * 340,
        oy: (hash01(i * 29 + 7) - 0.5) * 90,
        delay: hash01(i * 7 + 3) * 260,
        size: 2 + Math.round(hash01(i * 17 + 5) * 4),
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[88] flex items-center justify-center">
      {/* a placa */}
      <div
        className={phase === "in" ? "holo-in" : "holo-out"}
        style={{ "--accent": accent } as CSSProperties}
      >
        <div className={`holo-plate holo-${tone} relative px-6 py-4 sm:px-10 sm:py-6`}>
          <div className="holo-scan pointer-events-none absolute inset-0" />
          <div className="relative text-center">
            <div className="holo-title font-pixel text-[11px] leading-relaxed sm:text-xl">
              {tone === "mine"
                ? "OPA! VOCÊ CONQUISTOU UMA DAMA"
                : tone === "rival"
                  ? "CARAMBA, BICHO!"
                  : "OPA!!! TEMOS DAMA."}
            </div>
            {tone !== "neutral" && (
              <div className="font-pixel mt-2 text-[8px] leading-relaxed text-white/70 sm:text-[10px]">
                {tone === "mine"
                  ? "VAMOS TURBINÁ-LA"
                  : `${ownerName || "O OPONENTE"} FEZ UMA DAMA · VAI TURBINAR A PEÇA`}
              </div>
            )}
            <div className="mt-3 h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
            <div className="gold-text font-pixel mt-3 text-[10px] sm:text-base">
              PORTFÓLIO MARCOS EDUARDO
            </div>
            <div className="font-pixel mt-2 text-[6px] tracking-[0.3em] text-cyan-300/70 sm:text-[8px]">
              ★ BONUS UNLOCKED ★
            </div>
            {/* barrinha de leitura: mostra quanto falta pra placa se desfazer */}
            <div className="mx-auto mt-3 h-[3px] w-2/3 overflow-hidden rounded-full bg-cyan-950/70">
              <div
                className="h-full rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]"
                style={{ animation: `holoRead ${HOLD}ms linear both` }}
              />
            </div>
          </div>
          {/* cantos */}
          <span className="holo-corner" style={{ top: -2, left: -2, borderWidth: "3px 0 0 3px" }} />
          <span className="holo-corner" style={{ top: -2, right: -2, borderWidth: "3px 3px 0 0" }} />
          <span className="holo-corner" style={{ bottom: -2, left: -2, borderWidth: "0 0 3px 3px" }} />
          <span className="holo-corner" style={{ bottom: -2, right: -2, borderWidth: "0 3px 3px 0" }} />
        </div>
      </div>

      {/* partículas rumo à peça */}
      {phase === "out" &&
        particles.map((p, i) => (
          <span
            key={i}
            className="holo-particle"
            style={
              {
                width: p.size,
                height: p.size,
                left: `calc(50% + ${p.ox}px)`,
                top: `calc(50% + ${p.oy}px)`,
                "--dx": `${target.x - (window.innerWidth / 2 + p.ox)}px`,
                "--dy": `${target.y - (window.innerHeight / 2 + p.oy)}px`,
                animationDelay: `${p.delay}ms`,
              } as CSSProperties
            }
          />
        ))}
    </div>
  );
}
