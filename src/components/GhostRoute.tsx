// ─────────────────────────────────────────────────────────────
//  ROTA FANTASMA · exclusiva do modo 2 Dispositivos e Observador
//
//  Para quem JOGOU, o lance já aconteceu na própria tela.
//  Para quem ESPERA, o servidor entrega o resultado pronto — sem
//  isto, a peça teleportaria. A rota mostra o caminho e a peça
//  voa por ele, dando leitura ao adversário e ao observador.
//  Quem executou o lance nunca vê esta camada.
// ─────────────────────────────────────────────────────────────
import { type CSSProperties } from "react";
import type { Player } from "../game/engine";

export interface GhostPath {
  id: number;
  player: Player;
  /** casas percorridas, começando na origem */
  points: { r: number; c: number }[];
  /** casas capturadas ao longo do caminho */
  captures: { r: number; c: number }[];
}

const CENTER = (n: number) => n * 12.5 + 6.25;
export default function GhostRoute({ path }: { path: GhostPath | null }) {
  if (!path || path.points.length < 2) return null;

  const color = path.player === 1 ? "#7ef3ff" : "#ffb3c0";
  const glow = path.player === 1 ? "rgba(34,211,238,.9)" : "rgba(244,63,94,.9)";
  const line = path.points.map((p) => `${CENTER(p.c)},${CENTER(p.r)}`).join(" ");
  const landing = path.points[path.points.length - 1];

  return (
    <div className="pointer-events-none absolute inset-0 z-[38]">
      {/* trilho tracejado fino */}
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="0.45"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1.4 2.2"
          opacity="0.75"
          className="ghost-line"
          style={{ filter: `drop-shadow(0 0 1.5px ${glow})` }}
        />
      </svg>

      {/* escalas do trajeto: losango igual ao marcador de destino */}
      {path.points.slice(1, -1).map((p, i) => (
        <span
          key={`stop-${path.id}-${i}`}
          className="ghost-stop"
          style={
            {
              left: `${CENTER(p.c)}%`,
              top: `${CENTER(p.r)}%`,
              borderColor: color,
              boxShadow: `0 0 8px ${glow}`,
              animationDelay: `${i * 0.14}s`,
            } as CSSProperties
          }
        />
      ))}

      {/* pouso: losango maior, mesma linguagem do marcador de movimento */}
      <span
        className="ghost-landing"
        style={
          {
            left: `${CENTER(landing.c)}%`,
            top: `${CENTER(landing.r)}%`,
            borderColor: color,
            background: `${color}22`,
            boxShadow: `0 0 14px ${glow}, inset 0 0 10px ${glow}`,
          } as CSSProperties
        }
      />

      {/* mira prévia nas peças que serão comidas */}
      {path.captures.map((cap, i) => (
        <span
          key={`cap-${path.id}-${i}`}
          className="ghost-target"
          style={
            {
              left: `${CENTER(cap.c)}%`,
              top: `${CENTER(cap.r)}%`,
              borderColor: color,
              animationDelay: `${0.2 + i * 0.14}s`,
            } as CSSProperties
          }
        />
      ))}

    </div>
  );
}
