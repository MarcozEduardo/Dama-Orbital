// ─────────────────────────────────────────────────────────────
//  SPRITE SHEET EM SVG · controles industriais pixel art
//  Feito em vetor com shapeRendering="crispEdges" para manter o
//  visual de sprite sem depender de PNG externo.
// ─────────────────────────────────────────────────────────────

interface IconProps {
  className?: string;
  size?: number | string;
}

const base = (className = "") => `pixelated ${className}`;

/** Rebites de canto reaproveitados por vários controles */
function Screws({ points }: { points: [number, number][] }) {
  return (
    <>
      {points.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 2} y={y - 2} width="4" height="4" fill="#0e0b1c" />
          <rect x={x - 1} y={y - 1} width="2" height="2" fill="#7d76ad" />
        </g>
      ))}
    </>
  );
}

/** CHAVE DOURADA — destaque da home */
export function KeySprite({ className, size = 48, lit = true }: IconProps & { lit?: boolean }) {
  const gold = lit ? "#ffd24a" : "#8a8272";
  const goldDark = lit ? "#a86e12" : "#5b5340";
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={base(className)} shapeRendering="crispEdges">
      <circle cx="24" cy="25" r="21" fill="#2a2410" />
      <circle cx="24" cy="24" r="21" fill={lit ? "#c99a1c" : "#4a4438"} />
      <circle cx="24" cy="24" r="18" fill="#3d3110" />
      <Screws points={[[24, 6], [42, 24], [24, 42], [6, 24]]} />
      <g className={lit ? "key-turn" : undefined} style={{ transformOrigin: "18px 18px" }}>
        {/* cabeça da chave */}
        <circle cx="18" cy="18" r="8" fill={goldDark} />
        <circle cx="18" cy="17" r="8" fill={gold} />
        <circle cx="18" cy="17" r="3.5" fill="#3d3110" />
        <circle cx="15.5" cy="14.5" r="1.6" fill="#fff3c4" />
        {/* haste */}
        <rect x="20" y="21" width="15" height="4" fill={goldDark} transform="rotate(45 20 21)" />
        <rect x="20" y="21" width="15" height="2" fill={gold} transform="rotate(45 20 21)" />
        {/* dentes */}
        <rect x="29" y="30" width="4" height="6" fill={gold} />
        <rect x="33" y="34" width="6" height="4" fill={gold} />
        <rect x="33" y="30" width="3" height="3" fill={goldDark} />
      </g>
    </svg>
  );
}

/** RÁDIO — walkie-talkie */
export function RadioSprite({ className, size = 24, active = true }: IconProps & { active?: boolean }) {
  const body = active ? "#2f6f52" : "#3a3653";
  const light = active ? "#39ff88" : "#4b4666";
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={base(className)} shapeRendering="crispEdges">
      {/* antena */}
      <rect x="21" y="2" width="3" height="9" fill="#1b1830" />
      <rect x="21.5" y="2" width="1" height="9" fill="#6f68a8" />
      <rect x="20" y="1" width="5" height="2" fill={light} />
      {/* corpo */}
      <rect x="7" y="9" width="18" height="21" rx="2" fill="#141130" />
      <rect x="7" y="8" width="18" height="21" rx="2" fill={body} />
      <rect x="9" y="10" width="14" height="7" fill="#0b1a14" />
      {/* grade do alto-falante */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <rect key={`${row}-${col}`} x={10 + col * 3} y={11 + row * 2} width="2" height="1" fill={light} opacity={0.75} />
        )),
      )}
      {/* botão de transmitir */}
      <rect x="10" y="19" width="12" height="4" rx="1" fill="#7a1f2b" />
      <rect x="10" y="19" width="12" height="2" rx="1" fill="#e14b3a" />
      {/* leds */}
      <rect x="10" y="25" width="3" height="3" fill={light} />
      <rect x="15" y="25" width="3" height="3" fill="#1d6b3c" />
      <rect x="20" y="25" width="3" height="3" fill="#ffd24a" />
      {active && <rect x="26" y="12" width="2" height="2" fill={light} className="radio-blip" />}
    </svg>
  );
}

/** SEMÁFORO — LED com base de metal e parafusos */
export function SignalLight({
  state,
  size = 34,
  className,
}: {
  state: "go" | "wait";
  size?: number;
  className?: string;
}) {
  const go = state === "go";
  return (
    <svg viewBox="0 0 28 44" width={size} height={(Number(size) / 28) * 44} className={base(className)} shapeRendering="crispEdges">
      {/* caixa */}
      <rect x="2" y="2" width="24" height="40" rx="3" fill="#0e0b1c" />
      <rect x="2" y="1" width="24" height="40" rx="3" fill="#3a3466" />
      <rect x="4" y="3" width="20" height="36" rx="2" fill="#1b1830" />
      <Screws points={[[6, 5], [22, 5], [6, 37], [22, 37]]} />
      {/* lente vermelha */}
      <circle cx="14" cy="13" r="7" fill="#160a0d" />
      <circle cx="14" cy="13" r="6" fill={go ? "#3d1017" : "#ff2f45"} />
      {!go && <circle cx="12" cy="11" r="2.2" fill="#ffb3c0" />}
      {/* lente verde */}
      <circle cx="14" cy="29" r="7" fill="#08160f" />
      <circle cx="14" cy="29" r="6" fill={go ? "#39ff88" : "#0d3a22"} />
      {go && <circle cx="12" cy="27" r="2.2" fill="#d5ffe8" />}
      {/* brilho neon */}
      <circle
        cx="14"
        cy={go ? 29 : 13}
        r="9"
        fill="none"
        stroke={go ? "#39ff88" : "#ff2f45"}
        strokeWidth="1"
        opacity="0.5"
        className="led-halo"
      />
    </svg>
  );
}

/** ANTENA DE SINAL — oscila conforme o estado do canal */
export function AntennaSprite({
  bars = 3,
  size = 22,
  className,
}: {
  bars?: 0 | 1 | 2 | 3;
  size?: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={base(className)} shapeRendering="crispEdges">
      <rect x="11" y="4" width="2" height="16" fill="#6f68a8" />
      <rect x="7" y="19" width="10" height="3" rx="1" fill="#3a3466" />
      <circle cx="12" cy="3" r="2" fill={bars > 0 ? "#7ef3ff" : "#4b4666"} />
      {[1, 2, 3].map((level) => (
        <path
          key={level}
          d={`M ${12 - level * 3.4} ${11 - level * 2.2} A ${level * 3.4} ${level * 3.4} 0 0 1 ${12 + level * 3.4} ${11 - level * 2.2}`}
          fill="none"
          stroke={bars >= level ? "#7ef3ff" : "#332e4d"}
          strokeWidth="1.6"
          className={bars >= level ? "antenna-wave" : undefined}
          style={{ animationDelay: `${level * 0.18}s` }}
        />
      ))}
    </svg>
  );
}

/** BOTÃO X — cancelar conexão */
export function DisconnectSprite({ size = 26, className }: IconProps) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} className={base(className)} shapeRendering="crispEdges">
      <circle cx="14" cy="15" r="12" fill="#2a0d12" />
      <circle cx="14" cy="14" r="12" fill="#b8202f" />
      <circle cx="14" cy="14" r="9.5" fill="#e14b3a" />
      <circle cx="11" cy="11" r="3" fill="#ff8f7a" opacity="0.85" />
      <rect x="8" y="12.5" width="12" height="3" fill="#fff" transform="rotate(45 14 14)" />
      <rect x="8" y="12.5" width="12" height="3" fill="#fff" transform="rotate(-45 14 14)" />
    </svg>
  );
}

/** LÁPIS — editar nome */
export function PencilSprite({ size = 18, className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={base(className)} shapeRendering="crispEdges">
      <rect x="3" y="14" width="4" height="4" fill="#ffd24a" />
      <rect x="4" y="15" width="2" height="2" fill="#fff3c4" />
      <rect x="6" y="6" width="9" height="4" fill="#c9c9dd" transform="rotate(45 6 6)" />
      <rect x="6" y="6" width="9" height="2" fill="#f4f4fa" transform="rotate(45 6 6)" />
      <rect x="13" y="1" width="4" height="4" fill="#e14b3a" transform="rotate(45 13 1)" />
    </svg>
  );
}
