// ─────────────────────────────────────────────────────────────
//  BOTÕES DO PAINEL — controles físicos em pixel art (SVG).
//  Botão de emergência, tomada de energia, olho e alavanca.
//  A dica ("Escolha um dos símbolos") só aparece no hover /
//  no toque; o texto explicativo mora em INFORMAÇÕES.
// ─────────────────────────────────────────────────────────────
import type { ReactNode } from "react";

interface CtrlProps {
  label: string;
  hint: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function Ctrl({ label, hint, disabled, active, onClick, children }: CtrlProps) {
  return (
    <button
      className={`ctrl ${active ? "ctrl-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={hint}
      aria-label={`${label}: ${hint}`}
    >
      <span className="ctrl-art">{children}</span>
      <span className="ctrl-label">{label}</span>
      <span className="ctrl-tip">{hint}</span>
    </button>
  );
}

/** BOTÃO DE EMERGÊNCIA VERMELHO com espada — modo Padrão */
export function BtnPadrao({ onClick, active }: { onClick: () => void; active?: boolean }) {
  return (
    <Ctrl label="PADRÃO" hint="Dois no mesmo aparelho" onClick={onClick} active={active}>
      <svg viewBox="0 0 48 48" className="pixelated h-full w-full" shapeRendering="crispEdges">
        {/* base metálica */}
        <circle cx="24" cy="25" r="21" fill="#1b1830" />
        <circle cx="24" cy="24" r="21" fill="#3d3766" />
        <circle cx="24" cy="24" r="18" fill="#272249" />
        {/* parafusos */}
        {[[24, 5], [43, 24], [24, 43], [5, 24]].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 2} y={y - 2} width="4" height="4" fill="#151230" />
            <rect x={x - 1} y={y - 1} width="2" height="2" fill="#6f68a8" />
          </g>
        ))}
        {/* cúpula vermelha */}
        <circle cx="24" cy="23" r="14" fill="#7d1120" />
        <circle cx="24" cy="22" r="14" fill="#c62234" />
        <circle cx="21" cy="19" r="10" fill="#e8394a" />
        <circle cx="19" cy="16" r="5" fill="#ff7a80" />
        {/* espada */}
        <g>
          <rect x="23" y="12" width="2" height="16" fill="#f2f6ff" />
          <rect x="23" y="12" width="1" height="16" fill="#ffffff" />
          <rect x="22" y="10" width="4" height="3" fill="#e8ecff" />
          <rect x="19" y="26" width="10" height="2" fill="#ffd24a" />
          <rect x="23" y="28" width="2" height="5" fill="#a86e12" />
          <rect x="22" y="33" width="4" height="2" fill="#ffd24a" />
        </g>
      </svg>
    </Ctrl>
  );
}

/** TOMADA / CABO DE ENERGIA — 2 Dispositivos */
export function BtnDispositivos({ onClick, active }: { onClick: () => void; active?: boolean }) {
  return (
    <Ctrl label="2 DISPOSITIVOS" hint="Chave diplomática ou QR" onClick={onClick} active={active}>
      <svg viewBox="0 0 48 48" className="pixelated h-full w-full" shapeRendering="crispEdges">
        <rect x="3" y="4" width="42" height="40" rx="4" fill="#1b1830" />
        <rect x="3" y="3" width="42" height="40" rx="4" fill="#3a3466" />
        <rect x="6" y="6" width="36" height="34" rx="3" fill="#241f43" />
        {/* soquete esquerdo */}
        <rect x="9" y="14" width="13" height="16" rx="2" fill="#141130" />
        <rect x="12" y="18" width="3" height="8" fill="#ffd24a" />
        <rect x="17" y="18" width="3" height="8" fill="#ffd24a" />
        {/* plugue direito entrando */}
        <rect x="27" y="14" width="12" height="16" rx="2" fill="#5a5288" />
        <rect x="27" y="14" width="12" height="4" fill="#7d76ad" />
        <rect x="23" y="18" width="5" height="3" fill="#c8c4e0" />
        <rect x="23" y="24" width="5" height="3" fill="#c8c4e0" />
        {/* cabo */}
        <rect x="38" y="20" width="7" height="3" fill="#2b2740" />
        <rect x="42" y="21" width="4" height="9" fill="#2b2740" />
        {/* faísca de conexão */}
        <g className="plug-spark">
          <rect x="24" y="15" width="2" height="2" fill="#a5f3fc" />
          <rect x="25" y="28" width="2" height="2" fill="#a5f3fc" />
          <rect x="21" y="21" width="2" height="2" fill="#ffffff" />
        </g>
      </svg>
    </Ctrl>
  );
}

/** OLHO AZUL — Observador */
export function BtnObservador({ onClick, active }: { onClick: () => void; active?: boolean }) {
  return (
    <Ctrl label="OBSERVADOR" hint="Assistir com uma chave" onClick={onClick} active={active}>
      <svg viewBox="0 0 48 48" className="pixelated h-full w-full" shapeRendering="crispEdges">
        <circle cx="24" cy="25" r="21" fill="#101a30" />
        <circle cx="24" cy="24" r="21" fill="#2a4a7a" />
        <circle cx="24" cy="24" r="18" fill="#16233f" />
        {[[24, 5], [43, 24], [24, 43], [5, 24]].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 2} y={y - 2} width="4" height="4" fill="#0c1424" />
            <rect x={x - 1} y={y - 1} width="2" height="2" fill="#5f86c4" />
          </g>
        ))}
        {/* olho */}
        <path d="M9 24 Q24 11 39 24 Q24 37 9 24 Z" fill="#0a1220" />
        <path d="M11 24 Q24 13 37 24 Q24 35 11 24 Z" fill="#cfe6ff" />
        <circle cx="24" cy="24" r="7" fill="#1e80c8" />
        <circle cx="24" cy="24" r="4" fill="#0a1220" />
        <circle cx="22" cy="22" r="1.6" fill="#ffffff" />
        {/* brilho varrendo */}
        <rect className="eye-scan" x="11" y="20" width="26" height="2" fill="rgba(165,243,252,.6)" />
      </svg>
    </Ctrl>
  );
}

/** ALAVANCA — Informações */
export function BtnInfo({ onClick, active }: { onClick: () => void; active?: boolean }) {
  return (
    <Ctrl label="INFORMAÇÕES" hint="Bobby explica tudo" onClick={onClick} active={active}>
      <svg viewBox="0 0 48 48" className="pixelated h-full w-full" shapeRendering="crispEdges">
        {/* base */}
        <rect x="8" y="30" width="32" height="14" rx="3" fill="#1b1830" />
        <rect x="8" y="29" width="32" height="14" rx="3" fill="#3a3466" />
        <rect x="11" y="32" width="26" height="8" rx="2" fill="#241f43" />
        {/* trilho */}
        <rect x="22" y="33" width="4" height="6" fill="#141130" />
        {/* haste + manopla */}
        <g className="lever-arm">
          <rect x="22" y="10" width="4" height="24" fill="#6f68a8" />
          <rect x="22" y="10" width="2" height="24" fill="#9c95d4" />
          <circle cx="24" cy="9" r="7" fill="#8a2018" />
          <circle cx="24" cy="8" r="7" fill="#d4483a" />
          <circle cx="21.5" cy="6" r="3" fill="#ff8f7a" />
        </g>
        {/* leds de estado */}
        <rect x="12" y="35" width="3" height="3" fill="#39ff88" />
        <rect x="17" y="35" width="3" height="3" fill="#1d6b3c" />
        <rect x="33" y="35" width="3" height="3" fill="#ffd24a" />
      </svg>
    </Ctrl>
  );
}

/** CHAVE — atalho pra injetar código direto */
export function BtnChave({ onClick }: { onClick: () => void }) {
  return (
    <Ctrl label="TENHO UMA CHAVE" hint="Injetar código e entrar" onClick={onClick}>
      <svg viewBox="0 0 48 48" className="pixelated h-full w-full" shapeRendering="crispEdges">
        <circle cx="24" cy="25" r="21" fill="#2a2410" />
        <circle cx="24" cy="24" r="21" fill="#6b5518" />
        <circle cx="24" cy="24" r="18" fill="#3d3110" />
        <g className="key-turn">
          <circle cx="19" cy="19" r="7" fill="#ffd24a" />
          <circle cx="19" cy="19" r="3" fill="#3d3110" />
          <rect x="21" y="21" width="14" height="4" fill="#ffd24a" transform="rotate(45 21 21)" />
          <rect x="29" y="29" width="4" height="5" fill="#ffd24a" />
          <rect x="32" y="32" width="5" height="4" fill="#ffd24a" />
        </g>
      </svg>
    </Ctrl>
  );
}
