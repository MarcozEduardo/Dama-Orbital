// ─────────────────────────────────────────────────────────────
//  BANDEIRA BRANCA — pixel art em SVG, tremulando no mastro.
//  Usada em 3 tamanhos: botão (ui), peça (tiny) e o estandarte
//  gigante que balança no meio da tela na hora da rendição.
// ─────────────────────────────────────────────────────────────

interface Props {
  size?: number;
  /** velocidade do tremular */
  speed?: number;
  className?: string;
  /** adiciona a cruz vermelha de trégua no pano */
  cross?: boolean;
}

export default function Flag({ size = 16, speed = 1, className = "", cross = false }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={`pixelated ${className}`}
      shapeRendering="crispEdges"
      style={{ overflow: "visible" }}
    >
      {/* mastro */}
      <rect x="2" y="1" width="1.4" height="14" fill="#6b6480" />
      <rect x="2" y="1" width="0.7" height="14" fill="#a29bbd" />
      <rect x="1" y="14.4" width="3.6" height="1.4" fill="#4a4460" />
      {/* ponteira */}
      <rect x="1.8" y="0" width="1.8" height="1.2" fill="#d9c46a" />

      {/* pano tremulando */}
      <g className="flag-cloth" style={{ animationDuration: `${1.15 / speed}s` }}>
        <path d="M3.4 2 L13.5 2.9 L13.5 8.4 L3.4 7.6 Z" fill="#f4f4fa" />
        <path d="M3.4 2 L13.5 2.9 L13.5 4 L3.4 3.2 Z" fill="#ffffff" />
        <path d="M3.4 6.6 L13.5 7.4 L13.5 8.4 L3.4 7.6 Z" fill="#c9c9dd" />
        {cross && (
          <>
            <rect x="7.4" y="3.1" width="1.7" height="4.2" fill="#e14b3a" />
            <rect x="6" y="4.3" width="4.6" height="1.7" fill="#e14b3a" />
          </>
        )}
      </g>
    </svg>
  );
}
