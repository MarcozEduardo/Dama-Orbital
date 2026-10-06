import type { CSSProperties, RefObject } from "react";
import { Crosshair, Skull, Star } from "lucide-react";
import type { PieceObj, Player } from "../game/engine";
import type { SpriteSet } from "../game/sprites";

interface HudProps {
  player: Player;
  name: string;
  remaining: number;
  captured: PieceObj[];
  active: boolean;
  facingBottom: boolean;
  trayRef: RefObject<HTMLDivElement | null>;
  lastArrival: number;
  totalStars: number;
  sprites: SpriteSet;
}

export default function Hud({
  player,
  name,
  remaining,
  captured,
  active,
  facingBottom,
  trayRef,
  lastArrival,
  totalStars,
  sprites,
}: HudProps) {
  const hex = player === 1 ? "#22d3ee" : "#f43f5e";
  const soft = player === 1 ? "#7ef3ff" : "#ffb3c0";

  return (
    <aside
      className={`panel-metal hud-compact relative flex w-full gap-3 p-3 transition-shadow duration-500 lg:w-56 lg:flex-col ${
        active ? "shadow-[0_0_28px_-4px_var(--facglow)]" : "opacity-90"
      }`}
      style={{ "--facglow": `${hex}66` } as CSSProperties}
    >
      {/* cabeçalho da facção */}
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: hex, boxShadow: `0 0 10px ${hex}` }}
        />
        <div className="min-w-0">
          <div className="font-pixel truncate text-[8px] tracking-wider" style={{ color: soft }}>
            {name}
          </div>
          <div
            className={`font-pixel mt-1 inline-block rounded-sm px-1.5 py-[3px] text-[6px] tracking-widest ${
              active ? "bg-white/10" : "bg-black/40 text-white/35"
            }`}
            style={active ? { color: soft } : undefined}
          >
            {active ? (facingBottom ? "EM CAMPO" : "ATACANDO") : "AGUARDANDO"}
          </div>
        </div>
      </div>

      {/* placar */}
      <div className="hud-score-box flex flex-none items-center justify-center gap-3 rounded-md border border-white/10 bg-black/45 px-3 py-2 lg:flex-col lg:gap-1 lg:py-3">
        <span className="hud-count-label font-pixel text-[6px] tracking-[0.25em] text-white/40">UNIDADES</span>
        <span
          key={remaining}
          className="hud-count pop-in font-pixel text-2xl lg:text-3xl"
          style={{ color: soft, textShadow: `0 0 14px ${hex}` }}
        >
          {remaining}
        </span>
        <span className="flex items-center gap-1 text-amber-300" title="estrelas de veteranas">
          <Star size={11} fill="currentColor" />
          <span className="font-pixel text-[8px]">{totalStars}</span>
        </span>
      </div>

      {/* bancada de capturadas */}
      <div className="flex min-h-14 flex-1 flex-col gap-1 rounded-md border border-white/10 bg-black/35 p-2 lg:flex-none">
        <div className="flex items-center justify-between">
          <span className="hud-tray-title font-pixel flex items-center gap-1 text-[6px] tracking-[0.2em] text-white/40">
            <Skull size={9} />
            SAQUE
          </span>
          <span className="font-pixel text-[7px]" style={{ color: soft }}>
            {captured.length}
          </span>
        </div>
        <div
          key={lastArrival}
          ref={trayRef}
          className={`hud-tray flex min-h-9 flex-1 flex-wrap content-start items-start gap-y-0.5 pl-0.5 ${lastArrival ? "tray-hit" : ""}`}
        >
          {captured.slice(0, 12).map((p, i) => (
            <img
              key={`${p.id}-${i}`}
              src={sprites.front[p.player]}
              alt=""
              draggable={false}
              className="relative h-7 w-7 object-contain"
              style={{
                transform: `rotate(${((i * 53) % 17) - 8}deg)`,
                marginLeft: i % 6 === 0 ? 0 : -6,
                filter: "drop-shadow(0 2px 2px rgba(0,0,0,.6)) saturate(.9)",
                zIndex: i,
              }}
            />
          ))}
          {captured.length > 12 && (
            <span className="font-pixel ml-1 self-center rounded-sm bg-white/10 px-1 py-0.5 text-[6px] text-white/70">
              +{captured.length - 12}
            </span>
          )}
          {captured.length === 0 && (
            <span className="flex items-center gap-1 self-center text-[13px] text-white/25">
              <Crosshair size={12} />
              nenhuma peça saqueada
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
