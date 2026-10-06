import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { BoardState, Move, Player, Pos } from "../game/engine";
import { keyOf, movesFrom } from "../game/engine";
import { hash01, type SpriteSet } from "../game/sprites";
import MissileLayer, { type MissileSpec } from "./MissileLayer";
import GhostRoute, { type GhostPath } from "./GhostRoute";
import Flag from "./Flag";

export interface DyingPiece {
  key: number;
  player: Player;
  king: boolean;
  r: number;
  c: number;
}

/** peça já abatida na lógica, com a MIRA cravada, aguardando a barragem */
export interface DoomedPiece extends DyingPiece {
  /** ordem em que foi marcada (mira 1, mira 2, mira 3...) */
  order: number;
}

export interface Decal {
  id: number;
  r: number;
  c: number;
  kind: "scorch" | "scuff";
  scale: number;
  rot: number;
}

interface BoardProps {
  sprites: SpriteSet;
  board: BoardState;
  turn: Player;
  facing: Player;
  cumRot: number;
  spinning: boolean;
  selected: Pos | null;
  moves: Move[];
  forced: Set<string>;
  chain: Pos | null;
  dying: DyingPiece[];
  doomed: DoomedPiece[];
  decals: Decal[];
  missiles: MissileSpec[];
  shakeKey: number;
  /** varredura geral rodando antes da barragem */
  scanning: boolean;
  /** facção que ergueu a bandeira branca (todas as peças dela desistem) */
  surrendered: Player | null;
  /** rota do lance do oponente (gira junto com a plataforma) */
  ghost: GhostPath | null;
  /** peça que o adversário selecionou */
  rivalPick: Pos | null;
  /** destinos que o rival está enxergando */
  rivalMoves: Pos[];
  rivalCaps: Pos[];
  /** mensagem de rádio flutuando sobre a última peça movida */
  radio: { id: number; text: string; nick: string; r: number; c: number; mine: boolean } | null;
  names: Record<Player, string>;
  disabled: boolean;
  promotedId: number | null;
  /** peça já promovida na lógica, mas que só vira dama visualmente após a placa holográfica */
  morphPendingId: number | null;
  onCell: (r: number, c: number) => void;
  onMeltDone: (key: number) => void;
  onMissileImpact: (m: MissileSpec) => void;
}

const SPARK_COLORS = ["#ffd24a", "#ff9f1c", "#ff5a3c", "#fff3c4"];

/** turbinas: só aparecem quando vemos as saídas de ar (peça de costas).
 *  Fica FORA do componente pai para não remontar (e reiniciar a chama) a cada render. */
function Turbines({ king, boost }: { king: boolean; boost: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute bottom-[6%] left-1/2 flex -translate-x-1/2 gap-[22%] ${boost ? "boost" : ""}`}
    >
      {[0, 1].map((i) => (
        <span key={i} className="turbine" style={{ animationDelay: `${i * 0.09}s`, width: king ? 7 : 5 }} />
      ))}
    </div>
  );
}

export default function Board(props: BoardProps) {
  const {
    sprites,
    board,
    turn,
    facing,
    cumRot,
    spinning,
    selected,
    moves,
    forced,
    chain,
    dying,
    doomed,
    decals,
    missiles,
    shakeKey,
    scanning,
    surrendered,
    ghost,
    rivalPick,
    rivalMoves,
    rivalCaps,
    radio,
    disabled,
    promotedId,
    morphPendingId,
    onCell,
    onMeltDone,
    onMissileImpact,
  } = props;

  const frameRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Pos | null>(null);

  useEffect(() => {
    if (!shakeKey) return;
    const el = frameRef.current;
    if (!el) return;
    el.classList.remove("shaking");
    void el.offsetWidth;
    el.classList.add("shaking");
    const t = setTimeout(() => el.classList.remove("shaking"), 420);
    return () => clearTimeout(t);
  }, [shakeKey]);

  const moveMap = new Map(moves.map((m) => [keyOf(m.to.r, m.to.c), m]));
  const selColor = turn === 1 ? "#7ef3ff" : "#ffb3c0";

  /** tilt escrito direto no DOM: zero re-render do tabuleiro ao mexer o mouse */
  const applyTilt = (rx: number, ry: number) => {
    if (tiltRef.current) tiltRef.current.style.transform = `rotateX(${15 + ry}deg) rotateY(${rx}deg)`;
  };
  const onPointerMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    applyTilt(
      ((e.clientX - rect.left) / rect.width - 0.5) * 4.5,
      -((e.clientY - rect.top) / rect.height - 0.5) * 4,
    );
  };

  const spriteOf = (player: Player, king: boolean) =>
    player === facing
      ? king
        ? sprites.kingBack[player]
        : sprites.back[player]
      : king
        ? sprites.kingFront[player]
        : sprites.front[player];

  return (
    <div
      className="relative select-none"
      style={{ perspective: "1300px" }}
      onMouseMove={onPointerMove}
      onMouseLeave={() => applyTilt(0, 0)}
    >
      <div
        ref={tiltRef}
        className="transition-transform duration-300 ease-out"
        style={{ transform: "rotateX(15deg)" }}
      >
        {/* ── MAQUINÁRIO: raio de luz atrás + freios com faíscas ── */}
        <div className={`rig ${spinning ? "on" : ""}`} aria-hidden>
          <span className="rig-beam" />
          <span className="rig-ring" />
          {spinning && (
            <>
              <span className="brake l" />
              <span className="brake r" />
              {/* 7 faíscas na sapata esquerda */}
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={`l${i}`}
                  className="rig-spark"
                  style={
                    {
                      left: "4px",
                      top: `${44 + (i % 4) * 3.5}%`,
                      animationDelay: `${1.1 + ((i * 0.19) % 1.5)}s`,
                      animationDuration: `${0.62 + (i % 3) * 0.16}s`,
                      "--sxx": `${-(9 + (i % 4) * 7)}px`,
                      "--syy": `${14 + (i % 3) * 11}px`,
                    } as CSSProperties
                  }
                />
              ))}
              {/* 5 faíscas na sapata direita */}
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={`r${i}`}
                  className="rig-spark"
                  style={
                    {
                      right: "4px",
                      top: `${46 + (i % 3) * 4}%`,
                      animationDelay: `${1.25 + ((i * 0.27) % 1.4)}s`,
                      animationDuration: `${0.66 + (i % 2) * 0.2}s`,
                      "--sxx": `${9 + (i % 3) * 8}px`,
                      "--syy": `${15 + (i % 3) * 10}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </>
          )}
        </div>

        {/* ── A PLATAFORMA INTEIRA GIRA (moldura, placas, tudo junto) ── */}
        <div
          className={`spin-layer ${spinning ? "stepping" : ""}`}
          style={{ "--rot": `${cumRot}deg`, transform: "rotate(var(--rot))" } as CSSProperties}
        >
          <div
            ref={frameRef}
            className={`panel-metal relative rounded-xl p-2.5 sm:p-3.5 ${spinning ? "rig-rumble" : ""}`}
          >
            <div className="hazard absolute left-4 right-4 top-[3px] h-[7px] rounded-full opacity-80" />
            <div className="hazard absolute bottom-[3px] left-4 right-4 h-[7px] rounded-full opacity-80" />

            {/* placas giram junto com a plataforma, mas o texto se mantém legível */}
            <div className="pointer-events-none absolute left-1/2 top-[7px] z-30 -translate-x-1/2 rounded border border-white/10 bg-black/50 px-2 py-[3px]">
              <span
                className="piece-rot font-pixel engraved block text-[7px] tracking-widest"
                style={{ transform: "rotate(calc(var(--rot) * -1))" }}
              >
                {props.names[facing === 1 ? 2 : 1]}
              </span>
            </div>
            <div className="pointer-events-none absolute bottom-[7px] left-1/2 z-30 -translate-x-1/2 rounded border border-white/20 bg-black/60 px-2 py-[3px]">
              <span
                className="piece-rot font-pixel block text-[7px] tracking-widest"
                style={{
                  color: facing === 1 ? "#7ef3ff" : "#ffb3c0",
                  textShadow: `0 0 8px ${facing === 1 ? "#22d3ee" : "#f43f5e"}`,
                  transform: "rotate(calc(var(--rot) * -1))",
                }}
              >
                ▼ {props.names[facing]}
              </span>
            </div>

            <div className="relative overflow-hidden rounded-md">
            <div
              className="relative aspect-square w-full"
              style={{
                backgroundImage: `url(${sprites.boardTexture})`,
                backgroundSize: "100% 100%",
                imageRendering: "pixelated",
                boxShadow: "inset 0 0 60px rgba(0,0,0,.55), inset 0 0 8px rgba(0,0,0,.8)",
              }}
            >
              {/* ── MARCAS DE GUERRA (envelhecem sozinhas) ── */}
              <div className="pointer-events-none absolute inset-0 z-[5]">
                {decals.map((d) => (
                  <div
                    key={d.id}
                    className="absolute"
                    style={{
                      left: `${d.c * 12.5}%`,
                      top: `${d.r * 12.5}%`,
                      width: "12.5%",
                      height: "12.5%",
                      transform: `rotate(${d.rot}deg) scale(${d.scale})`,
                    }}
                  >
                    {d.kind === "scorch" ? (
                      <>
                        <span className="decal-scorch absolute inset-[6%]" />
                        <span className="decal-ember absolute inset-[16%]" />
                      </>
                    ) : (
                      <span className="decal-scuff absolute inset-[18%]" />
                    )}
                  </div>
                ))}
              </div>

              {/* ── PEÇAS VIVAS ── */}
              <div className="pointer-events-none absolute inset-0 z-10">
                {board.map((row, r) =>
                  row.map((piece, c) => {
                    if (!piece) return null;
                    const isSel = selected?.r === r && selected?.c === c;
                    const isForced = forced.has(keyOf(r, c));
                    const isHov = hover?.r === r && hover?.c === c;
                    const justCrowned = promotedId === piece.id;
                    // segura o visual de dama até o holograma desintegrar sobre ela
                    const showKing = piece.king && piece.id !== morphPendingId;
                    const jx = ((hash01(piece.id * 11 + 5) - 0.5) * 8).toFixed(2) + "%";
                    const jy = ((hash01(piece.id * 23 + 7) - 0.5) * 7).toFixed(2) + "%";
                    const jr = ((hash01(piece.id * 17 + 3) - 0.5) * 9).toFixed(2);
                    const wx = ((hash01(piece.id * 41 + 13) - 0.5) * 30).toFixed(2) + "%";
                    const wy = ((hash01(piece.id * 53 + 29) - 0.5) * 26).toFixed(2) + "%";
                    const showsBack = piece.player === facing;
                    const gaveUp = surrendered === piece.player;
                    return (
                      <div
                        key={piece.id}
                        className={`piece-shell absolute ${isSel ? "selected" : ""} ${isForced ? "forced" : ""} ${isHov ? "hov" : ""} ${showKing ? "is-king" : ""} ${gaveUp ? "piece-surrendered" : ""}`}
                        style={
                          {
                            left: `${c * 12.5}%`,
                            top: `${r * 12.5}%`,
                            width: "12.5%",
                            height: "12.5%",
                            zIndex: isSel ? 30 : (showKing ? 16 : 10) + r,
                            "--pglow": piece.player === 1 ? "rgba(34,211,238,.85)" : "rgba(244,63,94,.85)",
                          } as CSSProperties
                        }
                      >
                        <div
                          className="piece-rot h-full w-full"
                          style={{ transform: `rotate(calc(var(--rot) * -1)) rotate(${jr}deg)` }}
                        >
                          <div
                            className={`h-full w-full ${spinning ? "wob" : "wob-base"}`}
                            style={{ "--jx": jx, "--jy": jy, "--wx": wx, "--wy": wy } as CSSProperties}
                          >
                            <div className="relative flex h-full w-full items-end justify-center">
                              {showKing && <span className="king-aura" />}
                              {justCrowned && <span className="king-burst" />}
                              <img
                                src={spriteOf(piece.player, showKing)}
                                alt=""
                                draggable={false}
                                className={`piece-img ${showKing ? "w-[122%]" : "w-[94%]"} ${justCrowned ? "king-morph" : ""}`}
                              />
                              {showsBack && !gaveUp && <Turbines king={showKing} boost={isSel} />}
                              {gaveUp && (
                                <span
                                  className="piece-flag"
                                  style={{ animationDelay: `${(piece.id % 9) * 0.07}s` }}
                                >
                                  <Flag size={15} speed={1.25} />
                                </span>
                              )}
                              {showKing && (
                                <img
                                  src={sprites.crown}
                                  alt=""
                                  draggable={false}
                                  className="pixelated crown-bob absolute -top-[22%] left-1/2 w-[52%] -translate-x-1/2"
                                  style={{
                                    filter:
                                      "drop-shadow(0 2px 3px rgba(0,0,0,.7)) drop-shadow(0 0 8px rgba(255,210,74,.85))",
                                  }}
                                />
                              )}
                              {piece.kills > 0 && (
                                <div className="absolute -bottom-[7%] left-1/2 flex -translate-x-1/2 items-center gap-[1px]">
                                  {Array.from({ length: Math.min(3, piece.kills) }).map((_, i) => (
                                    <img
                                      key={i}
                                      src={sprites.star}
                                      alt=""
                                      className="pixelated w-[9px]"
                                      style={{ filter: "drop-shadow(0 0 4px rgba(255,210,74,.9))" }}
                                    />
                                  ))}
                                  {piece.kills > 3 && (
                                    <span className="font-pixel text-[6px] text-amber-300">×{piece.kills}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }),
                )}
              </div>

              {/* ── PEÇAS MARCADAS (chamuscadas, esperando a barragem) ── */}
              <div className="pointer-events-none absolute inset-0 z-[12]">
                {doomed.map((d) => (
                  <div
                    key={d.key}
                    className="absolute"
                    style={{ left: `${d.c * 12.5}%`, top: `${d.r * 12.5}%`, width: "12.5%", height: "12.5%" }}
                  >
                    <div className="piece-rot h-full w-full" style={{ transform: "rotate(calc(var(--rot) * -1))" }}>
                      <div className="relative flex h-full w-full items-end justify-center">
                        <img
                          src={spriteOf(d.player, d.king)}
                          alt=""
                          draggable={false}
                          className={`doomed-img ${d.king ? "w-[122%]" : "w-[94%]"}`}
                        />
                        {/* MIRA CRAVADA */}
                        <span className="reticle">
                          <span className="reticle-ring" />
                          <span className="reticle-corner" style={{ top: 0, left: 0, borderWidth: "3px 0 0 3px" }} />
                          <span className="reticle-corner" style={{ top: 0, right: 0, borderWidth: "3px 3px 0 0" }} />
                          <span className="reticle-corner" style={{ bottom: 0, left: 0, borderWidth: "0 0 3px 3px" }} />
                          <span className="reticle-corner" style={{ bottom: 0, right: 0, borderWidth: "0 3px 3px 0" }} />
                          <span className="reticle-dot" />
                          <span className="reticle-tag">ALVO {d.order}</span>
                        </span>
                        <span className="reticle-shock" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── DERRETENDO ── */}
              <div className="pointer-events-none absolute inset-0 z-40">
                {dying.map((d) => (
                  <div
                    key={d.key}
                    className="absolute"
                    style={{ left: `${d.c * 12.5}%`, top: `${d.r * 12.5}%`, width: "12.5%", height: "12.5%" }}
                  >
                    <div className="piece-rot h-full w-full" style={{ transform: "rotate(calc(var(--rot) * -1))" }}>
                      <div className="relative flex h-full w-full items-end justify-center">
                        <img
                          src={spriteOf(d.player, d.king)}
                          alt=""
                          draggable={false}
                          className={`melt-img ${d.king ? "w-[122%]" : "w-[94%]"}`}
                          onAnimationEnd={() => onMeltDone(d.key)}
                        />
                        {Array.from({ length: 12 }).map((_, i) => {
                          const a = hash01(d.key * 97 + i * 7) * Math.PI * 2;
                          const dist = 16 + hash01(d.key * 31 + i * 13) * 44;
                          return (
                            <span
                              key={i}
                              className="spark"
                              style={
                                {
                                  "--sx": `${(Math.cos(a) * dist).toFixed(0)}px`,
                                  "--sy": `${(Math.sin(a) * dist * 0.7 - 18).toFixed(0)}px`,
                                  "--sc": SPARK_COLORS[Math.floor(hash01(d.key * 7 + i * 17) * 4)],
                                  "--sd": `${(hash01(d.key * 3 + i * 5) * 0.12).toFixed(2)}s`,
                                } as CSSProperties
                              }
                            />
                          );
                        })}
                        <div className="puddle absolute bottom-[6%] left-1/2 h-[16%] w-[74%] rounded-[50%]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── HOLOGRAMA DO RÁDIO sobre a última peça movida ── */}
              {radio && (
                <div
                  key={radio.id}
                  className="pointer-events-none absolute z-[50]"
                  style={{
                    left: `${radio.c * 12.5 + 6.25}%`,
                    top: `${radio.r * 12.5}%`,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <div
                    className="piece-rot"
                    style={{ transform: "rotate(calc(var(--rot) * -1))", transformOrigin: "center bottom" }}
                  >
                    <div className={`radio-bubble ${radio.mine ? "mine" : "theirs"}`}>
                      <span className="radio-nick">{radio.nick}</span>
                      {radio.text}
                      <span className="radio-tail" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── ROTA DO OPONENTE: dentro da plataforma, gira junto ── */}
              {ghost && <GhostRoute path={ghost} />}

              {/* eco: peça selecionada pelo adversário + rotas possíveis */}
              {rivalPick && (
                <>
                  <span
                    className="rival-pick"
                    style={{ left: `${rivalPick.c * 12.5}%`, top: `${rivalPick.r * 12.5}%` }}
                  />
                  {(rivalMoves.length ? rivalMoves : movesFrom(board, rivalPick.r, rivalPick.c).map((m) => m.to)).map(
                    (dest, i) => (
                      <span
                        key={`rv-${i}`}
                        className="rival-move"
                        style={{
                          left: `${dest.c * 12.5}%`,
                          top: `${dest.r * 12.5}%`,
                          animationDelay: `${i * 0.07}s`,
                        }}
                      />
                    ),
                  )}
                  {rivalCaps.map((cap, i) => (
                    <span
                      key={`rc-${i}`}
                      className="rival-move cap"
                      style={{
                        left: `${cap.c * 12.5}%`,
                        top: `${cap.r * 12.5}%`,
                        animationDelay: `${i * 0.07}s`,
                      }}
                    />
                  ))}
                </>
              )}

              {/* ── VARREDURA GERAL antes da barragem ── */}
              {scanning && (
                <div className="pointer-events-none absolute inset-0 z-[42] overflow-hidden">
                  <span className="scan-grid" />
                  <span className="scanbeam" />
                </div>
              )}

              {/* ── MÍSSEIS + FOGO (canvas) ── */}
              <MissileLayer missiles={missiles} missileSprite={sprites.missile} onImpact={onMissileImpact} />

              {/* ── CLIQUE / MARCADORES ── */}
              <div className="absolute inset-0 z-20 grid grid-cols-8 grid-rows-8">
                {Array.from({ length: 64 }).map((_, i) => {
                  const r = (i / 8) | 0;
                  const c = i % 8;
                  const k = keyOf(r, c);
                  const mv = moveMap.get(k);
                  const isSel = selected?.r === r && selected?.c === c;
                  const isForced = forced.has(k);
                  const pieceHere = board[r][c];
                  const playable =
                    !disabled &&
                    pieceHere &&
                    pieceHere.player === turn &&
                    (!forced.size || isForced) &&
                    (!chain || (chain.r === r && chain.c === c));
                  return (
                    <button
                      key={k}
                      data-cell={k}
                      aria-label={`casa ${r},${c}`}
                      onClick={() => onCell(r, c)}
                      onMouseEnter={() => playable && setHover({ r, c })}
                      onMouseLeave={() => setHover(null)}
                      className={`relative outline-none ${mv || playable ? "cursor-pointer" : "cursor-default"} ${mv ? "bg-white/[0.03] hover:bg-white/[0.07]" : ""}`}
                    >
                      {isSel && (
                        <>
                          <span className="sel-corner tl" style={{ "--selc": chain ? "#ffd24a" : selColor } as CSSProperties} />
                          <span className="sel-corner tr" style={{ "--selc": chain ? "#ffd24a" : selColor } as CSSProperties} />
                          <span className="sel-corner bl" style={{ "--selc": chain ? "#ffd24a" : selColor } as CSSProperties} />
                          <span className="sel-corner br" style={{ "--selc": chain ? "#ffd24a" : selColor } as CSSProperties} />
                        </>
                      )}
                      {isForced && !isSel && <span className="forced-ring" />}
                      {mv && (
                        <span
                          className={`marker absolute inset-0 flex items-center justify-center ${mv.jump ? "marker-capture" : "marker-move"}`}
                        >
                          <i />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
