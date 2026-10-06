// ─────────────────────────────────────────────────────────────
//  CONTAGEM REGRESSIVA 3 · 2 · 1 · FIGHT!
//  Roda sobre o tabuleiro e dá o respiro final de renderização.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { sfx } from "../game/audio";

export default function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);

  useEffect(() => {
    sfx.beep();
    const timers: number[] = [];
    timers.push(window.setTimeout(() => (setN(2), sfx.beep()), 800));
    timers.push(window.setTimeout(() => (setN(1), sfx.beep()), 1600));
    timers.push(window.setTimeout(() => (setN(0), sfx.fight()), 2400));
    timers.push(window.setTimeout(onDone, 3350));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[65] flex items-center justify-center">
      <div className="absolute inset-0 rounded-xl bg-black/45 backdrop-blur-[1px]" />
      {n > 0 ? (
        <div key={n} className="count-pop relative">
          <span className="font-pixel text-[92px] text-white drop-shadow-[0_0_30px_rgba(34,211,238,.9)] sm:text-[130px]">
            {n}
          </span>
          <span className="count-ring absolute left-1/2 top-1/2" />
        </div>
      ) : (
        <div key="fight" className="fight-pop relative text-center">
          <span className="gold-text font-pixel text-4xl sm:text-6xl">FIGHT!</span>
          <div className="font-pixel mt-3 text-[8px] tracking-[0.35em] text-cyan-200">
            PROTEJAM A ALIANÇA
          </div>
        </div>
      )}
    </div>
  );
}
