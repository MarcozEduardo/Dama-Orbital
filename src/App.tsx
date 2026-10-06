import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import Board, { type Decal, type DoomedPiece, type DyingPiece } from "./components/Board";
import Hud from "./components/Hud";
import Cutscene from "./components/Cutscene";
import Countdown from "./components/Countdown";
import HoloPlaque, { HOLO_TOTAL } from "./components/HoloPlaque";
import Flag from "./components/Flag";
import MainMenu, { type MatchConfig } from "./components/MainMenu";
import { QUICK_PHRASES, filterMessage } from "./components/RadioBox";
import { AntennaSprite } from "./components/Sprites";
import AboutDialog, { isStandalone } from "./components/AboutDialog";
import StatusPlate from "./components/StatusPlate";
import JoinGate from "./components/JoinGate";
import { type GhostPath } from "./components/GhostRoute";
import { analyzeRisk, chooseMove } from "./game/ai";
import {
  createPlayerChannel,
  decodeBoard,
  encodeBoard,
  pushNick,
  pushRadio,
  pushState,
  subscribeRoom,
  subscribeRemoteMatch,
  joinRemoteMatch,
  probeRemoteMatch,
  beatRemotePresence,
  commitRemoteTimeout,
  extendRemoteDeadline,
  subscribeRemoteHeartbeat,
  commitRemoteState,
  declareRemoteSurrender,
  finishRemoteSurrender,
  pushPulse,
  subscribePulses,
  pushLeave,
  resetPulse,
  declareRemoteWinner,
  updateRemoteNick,
  type ChannelStatus,
  type EventChannel,
  type RemoteMatch,
  type RemoteMatchProbe,
  type Room,
} from "./game/net";
import type { MissileSpec } from "./components/MissileLayer";
import {
  allMoves,
  cloneBoard,
  countPieces,
  createInitialBoard,
  forcedPieces,
  keyOf,
  movesFrom,
  type BoardState,
  type Move,
  type PieceObj,
  type Player,
  type Pos,
} from "./game/engine";
import { hashMatchState } from "./game/network/hash";
import { loadSprites, type SpriteSet } from "./game/sprites";
import { sfx } from "./game/audio";

// Assets brutos restaurados pelo sandbox ficam em public/sprites.
// Em produção, scripts/optimize-assets.cjs move/otimiza esses arquivos.
const hangarUrl = "/sprites/hangar-bg.png";

const NAMES: Record<Player, string> = { 1: "BOBBY", 2: "SOCRAM" };
const HEX: Record<Player, string> = { 1: "#22d3ee", 2: "#f43f5e" };
const SOFT: Record<Player, string> = { 1: "#7ef3ff", 2: "#ffb3c0" };
const VICTORY_LINE: Record<Player, string> = {
  1: "A Rota para a Terra foi defendida! Marcos Eduardo está seguro.",
  2: "O bloqueio de asteroides venceu. A galáxia curva-se a Socram.",
};

type Phase = "cutscene" | "menu" | "countdown" | "playing";

/** precisa bater com --spin-dur do index.css */
const SPIN_MS = 3800;
/** a DAMA é fera: dispara esse tanto de mísseis por peça abatida */
const KING_SALVO = 4;
/** na rendição, cada peça sobrevivente do vencedor despeja esse tanto */
const SURRENDER_SALVO = 3;
/** online: tempo pra jogar antes de perder a vez */
const TURN_SECONDS = 30;
// ── RITMO DAS ANIMAÇÕES · um lugar só, igual para autor e replay ──
/** passo entre casas */
const ANIMATION_STEP_MS = 420;
/** replay usa o mesmo passo do autor para os dois enxergarem juntos */
const REPLAY_FIRST_STEP_MS = ANIMATION_STEP_MS;
/** tempo que a mira leva pra cravar no alvo */
const LOCK_MS = 560;
/** varredura geral antes da barragem */
const SCAN_MS = 450;
/** intervalo entre mísseis */
const MISSILE_INTERVAL = 170;
/** respiro depois da barragem */
const POST_BARRAGE_WAIT = 550;
/** janela para digitar nome/rádio com o cronômetro pausado */
const TYPING_MS = 15_000;
/** inatividade que encerra a partida online */
const IDLE_MS = 5 * 60 * 1000;

interface Fly {
  id: number;
  owner: Player;
  piece: PieceObj;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

let uid = 1000;
const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const center = (r: number, c: number) => ({ x: c * 12.5 + 6.25, y: r * 12.5 + 6.25 });

function FlySprite({ fly, src, onDone }: { fly: Fly; src: string; onDone: (f: Fly) => void }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    const t = setTimeout(() => onDone(fly), 950);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const size = 46;
  return (
    <img
      src={src}
      alt=""
      className="fly-sprite pointer-events-none fixed z-[80]"
      style={{
        left: fly.from.x - size / 2,
        top: fly.from.y - size / 2,
        width: size,
        height: size,
        transform: go
          ? `translate(${fly.to.x - fly.from.x}px, ${fly.to.y - fly.from.y}px) scale(.42) rotate(340deg)`
          : "translate(0,0) scale(1)",
        opacity: go ? 0.85 : 1,
        filter: "drop-shadow(0 8px 8px rgba(0,0,0,.6)) saturate(.7) brightness(.75)",
      }}
      onTransitionEnd={() => onDone(fly)}
    />
  );
}

export default function App() {
  // ── carregamento / fases ──
  const [sprites, setSprites] = useState<SpriteSet | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("INICIANDO");
  const [phase, setPhase] = useState<Phase>("cutscene");

  // ── jogo ──
  const [board, setBoard] = useState<BoardState>(() => createInitialBoard());
  const [turn, setTurn] = useState<Player>(1);
  const [facing, setFacing] = useState<Player>(1);
  const [cumRot, setCumRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<Pos | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [chain, setChain] = useState<Pos | null>(null);
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);

  // ── fx ──
  const [captures, setCaptures] = useState<Record<Player, PieceObj[]>>({ 1: [], 2: [] });
  const [doomed, setDoomed] = useState<DoomedPiece[]>([]);
  const [dying, setDying] = useState<DyingPiece[]>([]);
  const [decals, setDecals] = useState<Decal[]>([]);
  const [missiles, setMissiles] = useState<MissileSpec[]>([]);
  const [scanning, setScanning] = useState(false);
  const [waitMsg, setWaitMsg] = useState<{ text: string; at: number } | null>(null);
  /** facção que ergueu a bandeira branca */
  const [surrendered, setSurrendered] = useState<Player | null>(null);
  /** diálogo "tem certeza?" — guarda se ainda dava pra virar o jogo */
  const [confirmGiveUp, setConfirmGiveUp] = useState<{ hopeful: boolean; side: Player } | null>(null);
  const [siren, setSiren] = useState(false);
  /** encurralado: sem jogada possível, é detonado sem direito a bandeira */
  const [encircledMsg, setEncircledMsg] = useState(false);
  /** configuração da partida (local / online / observador) */
  const [match, setMatch] = useState<MatchConfig>({
    mode: "local",
    seat: "host",
    roomKey: null,
    nick: "",
    backend: "local",
    matchId: null,
    uid: null,
  });
  const [room, setRoom] = useState<Room | null>(null);
  const [remoteRoom, setRemoteRoom] = useState<RemoteMatch | null>(null);
  const [linkStatus, setLinkStatus] = useState<ChannelStatus>({
    state: "CONNECTING",
    peers: 0,
    latencyMs: null,
    detail: "Canal local",
  });
  /** balão de rádio flutuando sobre a última peça movida */
  const [radioMsg, setRadioMsg] = useState<
    { id: number; text: string; nick: string; r: number; c: number; mine: boolean } | null
  >(null);
  const [lastMoved, setLastMoved] = useState<Pos>({ r: 5, c: 0 });
  /** cronômetro do lance online */
  const [clock, setClock] = useState(TURN_SECONDS);
  const [autoKey, setAutoKey] = useState<string | null>(null);
  /** rota tracejada do lance do oponente (só online/observador) */
  const [ghost, setGhost] = useState<GhostPath | null>(null);
  /** alguém está digitando: pausa o cronômetro dos dois lados */
  const [typing, setTyping] = useState<{ who: string; kind: "nick" | "radio" | "surrender"; until: number } | null>(null);
  const [typingLeft, setTypingLeft] = useState(0);
  /** rádio: uma mensagem por jogador por rodada */
  const [radioUsedBy, setRadioUsedBy] = useState<Record<Player, boolean>>({ 1: false, 2: false });
  const [radioOpen, setRadioOpen] = useState(false);
  /** cada botão de pausa só pode ser usado uma vez por rodada */
  const [pauseUsed, setPauseUsed] = useState({ nick: false, radio: false, surrender: false });
  /** o portão do QR já foi confirmado? */
  const [gateDone, setGateDone] = useState(false);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [qrProbe, setQrProbe] = useState<RemoteMatchProbe | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appInstalled, setAppInstalled] = useState(false);
  /** o adversário sumiu da sala */
  const [rivalLost, setRivalLost] = useState(false);
  /** peça que o adversário selecionou (eco visual) */
  const [rivalPick, setRivalPick] = useState<Pos | null>(null);
  const [rivalMoves, setRivalMoves] = useState<Pos[]>([]);
  const [rivalCaps, setRivalCaps] = useState<Pos[]>([]);
  /** minha própria conexão caiu */
  const [netLost, setNetLost] = useState(false);
  /** motivo do fim: usado na tela final do online */
  const [endReason, setEndReason] = useState<string | null>(null);

  /** de que lado eu jogo? host = Aliança Bobby (1), guest = 2 */
  const myPlayer: Player | null =
    match.mode === "local" ? null : match.seat === "host" ? 1 : match.seat === "guest" ? 2 : null;
  const isObserver = match.mode === "observer";
  /** online: só gira quando é local/observador — nos 2 aparelhos cada tela é fixa */
  const spinsBoard = match.mode !== "online";

  // nomes exibidos: quem entra pelo painel aparece com o próprio nick
  const names: Record<Player, string> = {
    1:
      (match.backend === "firebase"
        ? remoteRoom?.players.p1.nick?.trim()
        : room?.host.nick?.trim()) || "ALIANÇA BOBBY",
    2:
      match.mode === "local"
        ? "IMPÉRIO SOCRAM"
        : (match.backend === "firebase"
              ? remoteRoom?.players.p2?.nick?.trim()
              : room?.guest?.nick?.trim()) ||
            (match.seat === "guest" ? match.nick : "IMPÉRIO SOCRAM"),
  };
  const [flies, setFlies] = useState<Fly[]>([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboFlash, setComboFlash] = useState(0);
  const [crownFlash, setCrownFlash] = useState(0);
  const [turnFlash, setTurnFlash] = useState(0);
  const [shake, setShake] = useState(0);
  const [arrival, setArrival] = useState<Record<Player, number>>({ 1: 0, 2: 0 });
  const [morphPending, setMorphPending] = useState<number | null>(null);
  const [promotedId, setPromotedId] = useState<number | null>(null);
  const [holo, setHolo] = useState<{ target: { x: number; y: number }; accent: string; owner: Player } | null>(null);
  const [muted, setMuted] = useState(() => localStorage.getItem("damas-muted") === "1");
  /** testador automático: joga sozinho usando exatamente o mesmo caminho do jogador */
  const [demo, setDemo] = useState(false);

  // ── refs ──
  const seqRef = useRef(0);
  const doomedRef = useRef<DoomedPiece[]>([]);
  const metaRef = useRef<
    Map<number, { doomKey: number; type: "homing"; owner: Player; lethal: boolean }>
  >(new Map());
  const comboRef = useRef(0);
  const tray1Ref = useRef<HTMLDivElement | null>(null);
  const tray2Ref = useRef<HTMLDivElement | null>(null);
  const eventChannelRef = useRef<EventChannel | null>(null);
  const timeoutSeqRef = useRef<number | null>(null);
  const qrProbeStartedRef = useRef(false);
  const lastLiveMoveIdRef = useRef(0);
  const anticipatedStateSeqRef = useRef(0);
  const isObserverRef = useRef(false);
  const onlineRef = useRef(false);
  const surrenderSeenRef = useRef<Player | null>(null);
  /** trava a tela final enquanto a rendição está animando */
  const surrenderPlayingRef = useRef(false);
  const lastBeatRef = useRef(0);
  const myNameRef = useRef("");
  const endedRef = useRef(false);
  const boardRef = useRef<BoardState>([]);
  const busyRef = useRef(false);
  /** relógio congelado enquanto alguém digita */
  const clockRef = useRef(TURN_SECONDS);
  const frozenClockRef = useRef<number | null>(null);
  /** botões já usados nesta rodada (não dá pra atrapalhar duas vezes) */
  const usedThisTurnRef = useRef<Set<string>>(new Set());
  const runMoveRef = useRef<typeof runMove | null>(null);
  /** quebra a dependência circular runMove ↔ executeSurrender */
  const lastRadioRef = useRef<number>(0);
  const lastMovedRef = useRef<Pos>({ r: 5, c: 0 });
  const lastMoveRef = useRef<{ from: [number, number]; to: [number, number]; jumps: [number, number][] } | null>(null);
  const publishRef = useRef<
    ((b: BoardState, next: Player, win?: Player | null, gaveUp?: Player | null) => void) | null
  >(null);
  const executeSurrenderRef = useRef<
    ((loser: Player, snapshot: BoardState, encircled?: boolean, remote?: boolean) => Promise<void>) | null
  >(null);
  doomedRef.current = doomed;
  lastMovedRef.current = lastMoved;
  isObserverRef.current = isObserver;
  onlineRef.current = match.mode === "online" || isObserver;
  myNameRef.current = names[myPlayer ?? 1];
  boardRef.current = board;
  busyRef.current = busy;

  // ── boot: carrega sprites em paralelo com a cutscene ──
  useEffect(() => {
    let live = true;
    loadSprites((pct, label) => {
      if (!live) return;
      setProgress(pct);
      setProgressLabel(label);
    }).then((s) => live && setSprites(s));
    return () => {
      live = false;
    };
  }, []);

  // chave vinda do QR → pula a cutscene e injeta direto
  // ══ QR DIRETO: sem intro, sem menu, sem JoinGate ══
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const k = params.get("chave");
    const bad = !k && (params.toString() || location.pathname !== "/");
    // rota ou parâmetro desconhecido -> volta pra home
    if (bad) {
      window.history.replaceState({}, "", location.pathname === "/" ? "/" : "/");
      setPhase("cutscene");
      return;
    }
    if (k) {
      const cleaned = k.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      setAutoKey(cleaned);
      setPhase("menu");
      if (!qrProbeStartedRef.current) {
        qrProbeStartedRef.current = true;
        setGateBusy(true);
        setGateError(null);
        void probeRemoteMatch(cleaned)
          .then((probe) => {
            setQrProbe(probe);
            setRemoteRoom(probe.match);
          })
          .catch((error: unknown) => {
            setGateError(
              error instanceof Error ? error.message : "Falha ao validar a Chave Diplomática.",
            );
          })
          .finally(() => setGateBusy(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAppInstalled(isStandalone());
  }, []);

  useEffect(() => {
    sfx.setMuted(muted);
    localStorage.setItem("damas-muted", muted ? "1" : "0");
  }, [muted]);

  const counts = countPieces(board);
  const totalStars: Record<Player, number> = { 1: 0, 2: 0 };
  for (const row of board) for (const p of row) if (p) totalStars[p.player] += p.kills;

  const forced = useMemo(() => {
    if (chain || busy || winner || phase !== "playing") return new Set<string>();
    return forcedPieces(board, turn);
  }, [board, turn, chain, busy, winner, phase]);

  /**
   * A PEÇA AVISA ONDE ESTÁ.
   * Ao ser selecionada numa partida online, ela manda a própria posição
   * e as rotas que enxerga. O adversário desenha o mesmo "selecionado".
   * Fica ativo até a jogada terminar.
   */
  const beam = useCallback(
    (patch: Record<string, unknown>) => {
      if (match.backend !== "firebase" || !match.matchId || isObserver) return;
      const typingUntil = Number(patch.typingUntil || 0);
      if (typingUntil > Date.now()) {
        void extendRemoteDeadline(match.matchId, typingUntil).catch(() => undefined);
      }
      void pushPulse(match.matchId, {
        side: (myPlayer ?? 0) as 1 | 2 | 0,
        nick: myNameRef.current,
        ...patch,
      }).catch((err) => console.error("pushPulse falhou:", err));
    },
    [match.backend, match.matchId, isObserver, myPlayer],
  );
  const beamRef = useRef(beam);
  beamRef.current = beam;

  // ── helpers de FX ──
  const addDecal = useCallback((r: number, c: number, kind: Decal["kind"], scale = 1) => {
    setDecals((ds) => {
      const next: Decal = { id: ++uid, r, c, kind, scale, rot: Math.floor(Math.random() * 360) };
      const out = [...ds, next];
      return out.length > 70 ? out.slice(out.length - 70) : out;
    });
  }, []);

  const addMissile = useCallback((spec: MissileSpec) => {
    setMissiles((ms) => [...ms.filter((m) => m.id > uid - 40), spec]);
  }, []);

  const addToTray = useCallback((owner: Player, piece: PieceObj) => {
    setCaptures((c) => ({ ...c, [owner]: [...c[owner], piece] }));
    setArrival((a) => ({ ...a, [owner]: Date.now() }));
  }, []);

  const spawnFly = useCallback(
    (piece: PieceObj, from: Pos, owner: Player) => {
      const cellEl = document.querySelector<HTMLElement>(`[data-cell="${keyOf(from.r, from.c)}"]`);
      const trayEl = (owner === 1 ? tray1Ref : tray2Ref).current;
      if (!cellEl || !trayEl) return addToTray(owner, piece);
      const cr = cellEl.getBoundingClientRect();
      const tr = trayEl.getBoundingClientRect();
      setFlies((f) => [
        ...f,
        {
          id: ++uid,
          owner,
          piece,
          from: { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 },
          to: { x: tr.left + Math.min(34, tr.width / 2), y: tr.top + Math.min(26, tr.height / 2) },
        },
      ]);
    },
    [addToTray],
  );

  const onFlyDone = useCallback(
    (fly: Fly) => {
      addToTray(fly.owner, fly.piece);
      setFlies((fs) => fs.filter((f) => f.id !== fly.id));
    },
    [addToTray],
  );

  // ── IMPACTOS DE MÍSSIL (chamados pelo rAF da MissileLayer) ──
  const onMissileImpact = useCallback(
    (m: MissileSpec) => {
      const meta = metaRef.current.get(m.id);
      if (!meta) return;
      const victim = doomedRef.current.find((d) => d.key === meta.doomKey);
      metaRef.current.delete(m.id);
      if (!victim) return;

      sfx.boom(meta.lethal ? 1 : 0.65);
      setShake(Date.now());
      addDecal(victim.r, victim.c, "scorch", meta.lethal ? 1.15 : 0.78);

      // na salva da dama, só o ÚLTIMO míssil derruba; os outros castigam o alvo
      if (!meta.lethal) return;

      setDoomed((ds) => ds.filter((d) => d.key !== meta.doomKey));
      setDying((ds) => [...ds, { key: victim.key, player: victim.player, king: victim.king, r: victim.r, c: victim.c }]);
      const trophy: PieceObj = { id: ++uid, player: victim.player, king: victim.king, kills: 0 };
      setTimeout(() => spawnFly(trophy, { r: victim.r, c: victim.c }, meta.owner), 300);
    },
    [addDecal, spawnFly],
  );

  const onMeltDone = useCallback((key: number) => {
    setDying((ds) => ds.filter((d) => d.key !== key));
  }, []);

  // ── giro: a PLATAFORMA INTEIRA vira, pesada, com freios soltando faísca ──
  const rotateTo = useCallback(async (next: Player) => {
    setSpinning(true);
    sfx.platformSpin(SPIN_MS);
    // faíscas dos freios agarrando o trilho no terço final
    const ticks: number[] = [];
    for (const at of [2450, 2700, 2900, 3080, 3260, 3420]) {
      ticks.push(window.setTimeout(() => sfx.sparkTick(), at));
    }
    await wait(150); // engata antes de sair do lugar
    setCumRot((r0) => r0 + 180);
    await wait(SPIN_MS * 0.5); // troca a perspectiva no ângulo-morto
    setFacing(next);
    await wait(SPIN_MS * 0.5 + 180);
    setSpinning(false);
    ticks.forEach(clearTimeout);
  }, []);

  // ─────────────────────────────────────────────────────────
  //  SEQUÊNCIA PRINCIPAL DE UMA JOGADA (assíncrona, cancelável)
  // ─────────────────────────────────────────────────────────
  const runMove = useCallback(
    async (
      baseBoard: BoardState,
      fromPos: Pos,
      firstMove: Move,
      replay?: {
        jumps: Pos[];
        board: string;
        turn: Player;
        winner: Player | null;
        deferFinal?: boolean;
      },
    ) => {
      const mySeq = seqRef.current;
      const alive = () => seqRef.current === mySeq;
      setBusy(true);
      if (replay) {
        setSelected(null);
        setMoves([]);
      }

      let b = baseBoard;
      let cur = fromPos;
      let mv = firstMove;
      let landed: Pos = fromPos;
      let promotedPiece: PieceObj | null = null;
      const jumpTrail: Pos[] = [];
      // O primeiro pulso "moving" abaixo já substitui a seleção. Não enviar
      // um idle intermediário: duas escritas coladas podem chegar fora de ordem.

      // ── laço de deslocamento + capturas em cadeia ──
      for (;;) {
        const nb = cloneBoard(b);
        const piece = nb[cur.r][cur.c];
        if (!piece) break;
        nb[cur.r][cur.c] = null;
        nb[mv.to.r][mv.to.c] = piece;
        landed = { r: mv.to.r, c: mv.to.c };

        // ANUNCIA ESTE SALTO ANTES DE ANIMAR AQUI. É só uma prévia visual:
        // o state oficial continua sendo publicado no fim, já com tudo pronto.
        if (!replay && onlineRef.current) {
          const preview = cloneBoard(nb);
          const previewPiece = preview[mv.to.r][mv.to.c];
          if (mv.jump) {
            preview[mv.jump.r][mv.jump.c] = null;
            if (previewPiece) previewPiece.kills += 1;
          }
          if (
            previewPiece &&
            !previewPiece.king &&
            ((previewPiece.player === 1 && mv.to.r === 0) ||
              (previewPiece.player === 2 && mv.to.r === 7))
          ) {
            previewPiece.king = true;
          }
          const continuation = mv.jump
            ? movesFrom(preview, mv.to.r, mv.to.c, true)
            : [];
          const deferFinal = continuation.length > 0;

          beamRef.current({
            action: "moving",
            moveId: Date.now(),
            seq: seqSyncRef.current + 1,
            moveBoard: encodeBoard(preview),
            moveTurn: deferFinal ? turn : turn === 1 ? 2 : 1,
            moveFrom: [cur.r, cur.c],
            moveTo: [mv.to.r, mv.to.c],
            moveJump: mv.jump ? [mv.jump.r, mv.jump.c] : null,
            moveDeferFinal: deferFinal,
          });
        }

        // rastro de passagem (marca de guerra leve)
        if (Math.random() < 0.55) addDecal(cur.r, cur.c, "scuff", 0.85 + Math.random() * 0.4);

        // rota visível enquanto a peça voa (um único ghost, sem duplicar)
        if (onlineRef.current) {
          setGhost({
            id: cur.r * 100 + cur.c,
            player: piece.player,
            points: [{ r: cur.r, c: cur.c }, { r: mv.to.r, c: mv.to.c }],
            captures: mv.jump ? [{ r: mv.jump.r, c: mv.jump.c }] : [],
          });
        }
        setBoard(nb);
        setSelected(landed);
        setLastMoved(landed);
        setMoves([]);
        sfx.move();
        sfx.thrust();
        await wait(replay && jumpTrail.length === 0 ? REPLAY_FIRST_STEP_MS : ANIMATION_STEP_MS);
        if (onlineRef.current) setGhost(null);
        if (!alive()) return;

        b = nb;

        if (mv.jump) {
          const jr = mv.jump.r;
          const jc = mv.jump.c;
          const nb2 = cloneBoard(b);
          const victim = nb2[jr][jc];
          const mover = nb2[landed.r][landed.c];
          if (victim && mover) {
            nb2[jr][jc] = null;
            mover.kills += 1;
            b = nb2;
            setBoard(nb2);

            jumpTrail.push({ r: jr, c: jc });
            comboRef.current += 1;
            const order = comboRef.current;

            // ── A MIRA CRAVA NO ALVO (sem míssil vindo do nada) ──
            const dk = ++uid;
            setDoomed((ds) => [...ds, { key: dk, player: victim.player, king: victim.king, r: jr, c: jc, order }]);
            sfx.lockOn(order - 1);

            setCombo(order);
            setMaxCombo((x) => Math.max(x, order));
            setComboFlash(Date.now());
            sfx.capture(order);
            // respira: dá tempo de ver a mira travar antes do próximo pulo
            await wait(LOCK_MS);
            if (!alive()) return;
          }
        }

        // ── promoção a DAMA ──
        const landedPiece = b[landed.r][landed.c];
        if (
          landedPiece &&
          !landedPiece.king &&
          ((landedPiece.player === 1 && landed.r === 0) || (landedPiece.player === 2 && landed.r === 7))
        ) {
          const nb3 = cloneBoard(b);
          nb3[landed.r][landed.c]!.king = true;
          b = nb3;
          setBoard(nb3);
          promotedPiece = nb3[landed.r][landed.c];
          setMorphPending(promotedPiece!.id); // segura o visual até a placa desintegrar
        }

        // ── continua a cadeia? ──
        if (mv.jump) {
          const nexts = movesFrom(b, landed.r, landed.c, true);
          if (replay) {
            // segue o caminho EXATO que o oponente fez, sem adivinhar
            const expected = replay.jumps[jumpTrail.length];
            const same = expected
              ? nexts.find((n) => n.jump && n.jump.r === expected.r && n.jump.c === expected.c)
              : undefined;
            if (same) {
              cur = landed;
              mv = same;
              await wait(180);
              if (!alive()) return;
              continue;
            }
          } else {
            if (nexts.length === 1) {
              cur = landed;
              mv = nexts[0];
              await wait(180);
              if (!alive()) return;
              continue;
            }
            if (nexts.length > 1) {
              setChain(landed);
              setSelected(landed);
              setMoves(nexts);
              setBusy(false);
              return; // jogador escolhe o próximo pulo
            }
          }
        }

        // Em cadeia, o rival terminou só este salto e fica esperando o
        // próximo pulso. Alvos/miras permanecem; barragem ainda não dispara.
        if (replay?.deferFinal) {
          const target = decodeBoard(replay.board);
          setBoard(
            target.map((row) =>
              row.map((cell) => (cell ? { id: ++uid, ...cell, kills: 0 } : null)),
            ),
          );
          setSelected(landed);
          setBusy(false);
          return;
        }
        break;
      }

      // ── BARRAGEM FINAL: mísseis teleguiados saem da peça ──
      const list = doomedRef.current;
      if (list.length > 0) {
        // varredura rápida confirmando todos os alvos
        setScanning(true);
        sfx.scan();
        await wait(SCAN_MS);
        if (!alive()) return;
        setScanning(false);
        await wait(120);
        if (!alive()) return;

        // FOGO. Peão: 1 míssil por alvo. DAMA: salva de 4 por alvo. A bicha é poderosa.
        const shooter = b[landed.r][landed.c];
        const salvo = shooter?.king ? KING_SALVO : 1;
        const src = center(landed.r, landed.c);

        for (let i = 0; i < list.length; i++) {
          const d = list[i];
          const tgt = center(d.r, d.c);
          for (let s = 0; s < salvo; s++) {
            const mid = ++uid;
            // só o ÚLTIMO da salva detona o alvo; os outros são fogo de saturação
            metaRef.current.set(mid, {
              doomKey: d.key,
              type: "homing",
              owner: turn,
              lethal: s === salvo - 1,
            });
            // leque: cada míssil da salva cai num ponto levemente diferente
            const spread = salvo > 1 ? 2.6 : 0;
            const ang = (s / salvo) * Math.PI * 2;
            addMissile({
              id: mid,
              sx: src.x,
              sy: src.y,
              tx: tgt.x + Math.cos(ang) * spread,
              ty: tgt.y + Math.sin(ang) * spread,
              dur: 600 + i * 55 + s * 65,
            });
            sfx.launch(s);
            if (s < salvo - 1) {
              await wait(70);
              if (!alive()) return;
            }
          }
          await wait(MISSILE_INTERVAL);
          if (!alive()) return;
        }
        await wait(POST_BARRAGE_WAIT);
        if (!alive()) return;
      }

      // ── PLACA HOLOGRÁFICA + TRANSFORMAÇÃO DA DAMA ──
      if (promotedPiece) {
        const cellEl = document.querySelector<HTMLElement>(`[data-cell="${keyOf(landed.r, landed.c)}"]`);
        const rect = cellEl?.getBoundingClientRect();
        setHolo({
          target: rect
            ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
          accent: HEX[turn],
          owner: turn,
        });
        // espera a placa ser lida + desintegrar + as partículas chegarem na peça
        await wait(HOLO_TOTAL - 260);
        if (!alive()) return;
        setHolo(null);
        setMorphPending(null);
        setPromotedId(promotedPiece.id);
        setCrownFlash(Date.now());
        sfx.crown();
        await wait(950);
        if (!alive()) return;
        setPromotedId(null);
      }

      // ── FIM DE TURNO ──
      comboRef.current = 0;
      setCombo(0);
      setChain(null);
      setSelected(null);
      setMoves([]);
      setDoomed([]);

      lastMoveRef.current = {
        from: [fromPos.r, fromPos.c],
        to: [landed.r, landed.c],
        jumps: jumpTrail.map((j) => [j.r, j.c] as [number, number]),
      };
      // ── REPLAY: o servidor já decidiu. Só encosta o estado e devolve a vez.
      if (replay) {
        const authoritative = decodeBoard(replay.board);
        setBoard((previous) =>
          previous.map((row, r) =>
            row.map((cell, c) => {
              const incoming = authoritative[r][c];
              if (!incoming) return null;
              return cell && cell.player === incoming.player
                ? { ...cell, king: incoming.king }
                : { id: ++uid, player: incoming.player, king: incoming.king, kills: 0 };
            }),
          ),
        );
        setTurn(replay.turn);
        setTurnFlash(Date.now());
        setRadioUsedBy({ 1: false, 2: false });
        if (replay.winner) setWinner(replay.winner);
        if (isObserverRef.current) setFacing(replay.turn);
        setBusy(false);
        return;
      }

      const next: Player = turn === 1 ? 2 : 1;
      const stillThere = countPieces(b)[next] > 0;
      const canPlay = stillThere && allMoves(b, next).length > 0;
      if (!canPlay) {
        // encurralado mas ainda com peças em campo? é detonado na hora,
        // sem direito a bandeira branca. Sem peça nenhuma, acabou e pronto.
        if (stillThere) {
          void executeSurrenderRef.current?.(next, b, true);
        } else {
          publishRef.current?.(b, next, turn);
          setWinner(turn);
          if (turn === 1) localStorage.setItem("damas-ia-unlocked", "1");
          setBusy(false);
          sfx.win();
        }
        return;
      }
      setTurn(next);
      setTurnFlash(Date.now());
      publishRef.current?.(b, next);
      beamRef.current({ action: "idle", pick: null, options: [], caps: [] });
      // nos 2 aparelhos a tela de cada um é fixa: não gira
      if (spinsBoard) {
        await rotateTo(next);
        if (!alive()) return;
      } else {
        await wait(320);
        if (!alive()) return;
      }
      setBusy(false);
    },
    [turn, addDecal, addMissile, rotateTo, spinsBoard, match.backend, match.matchId, isObserver],
  );

  // ─────────────────────────────────────────────────────────
  //  EXECUÇÃO DA RENDIÇÃO
  //  Cada peça sobrevivente do vencedor despeja 3 mísseis em
  //  alvos sorteados entre as peças que levantaram bandeira.
  // ─────────────────────────────────────────────────────────
  const executeSurrender = useCallback(
    async (loser: Player, snapshot: BoardState, encircled = false, remote = false) => {
      const mySeq = ++seqRef.current;
      const alive = () => seqRef.current === mySeq;
      const victor: Player = loser === 1 ? 2 : 1;

      surrenderPlayingRef.current = true;
      setConfirmGiveUp(null);
      setBusy(true);
      setSelected(null);
      setMoves([]);
      setChain(null);

      // ETAPA 1 · bandeira imediata, sem vencedor: a animação roda nos dois
      if (!remote && match.backend === "firebase" && match.matchId) {
        void declareRemoteSurrender(match.matchId, loser).catch(() => undefined);
      }

      if (encircled) {
        // sem jogada possível: é executado na hora, sem direito a bandeira
        setEncircledMsg(true);
        sfx.doom();
        await wait(1500);
        if (!alive()) return;
        setEncircledMsg(false);
      } else {
        // 1. bandeira branca sobe em todas as peças + sirene
        setSurrendered(loser);
        setSiren(true);
        sfx.siren(4);
        sfx.flagWave();
        await wait(2600);
        if (!alive()) return;
        sfx.doom();
      }
      const targets: Pos[] = [];
      const shooters: Pos[] = [];
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
          const p = snapshot[r][c];
          if (!p) continue;
          if (p.player === loser) targets.push({ r, c });
          else shooters.push({ r, c });
        }
      if (!targets.length || !shooters.length) {
        surrenderPlayingRef.current = false;
        setSiren(false);
        if (!remote && match.backend !== "firebase") {
          publishRef.current?.(snapshot, loser, victor, loser);
        }
        setWinner(victor);
        setBusy(false);
        sfx.win();
        return;
      }

      // 3. scanner varrendo tudo
      setScanning(true);
      sfx.scan();
      await wait(SCAN_MS);
      if (!alive()) return;
      setScanning(false);

      // 4. marca TODOS os alvos de uma vez (miras cravando em cascata)
      const doomKeys = new Map<string, number>();
      const marks: DoomedPiece[] = targets.map((t, i) => {
        const piece = snapshot[t.r][t.c]!;
        const key = ++uid;
        doomKeys.set(keyOf(t.r, t.c), key);
        return { key, player: piece.player, king: piece.king, r: t.r, c: t.c, order: i + 1 };
      });
      for (let i = 0; i < marks.length; i++) {
        setDoomed((ds) => [...ds, marks[i]]);
        sfx.lockOn(i);
        await wait(130);
        if (!alive()) return;
      }
      await wait(320);
      if (!alive()) return;

      // 5. TRA-TRA-TRA: 3 mísseis por peça sobrevivente, espalhados
      let fired = 0;
      for (let s = 0; s < shooters.length; s++) {
        const src = center(shooters[s].r, shooters[s].c);
        for (let k = 0; k < SURRENDER_SALVO; k++) {
          const t = targets[(s * SURRENDER_SALVO + k) % targets.length];
          const dk = doomKeys.get(keyOf(t.r, t.c))!;
          const tgt = center(t.r, t.c);
          const mid = ++uid;
          fired++;
          // o último míssil que sobra pra cada alvo é o letal
          metaRef.current.set(mid, {
            doomKey: dk,
            type: "homing",
            owner: victor,
            lethal: fired > shooters.length * SURRENDER_SALVO - targets.length,
          });
          addMissile({
            id: mid,
            sx: src.x,
            sy: src.y,
            tx: tgt.x + (Math.random() - 0.5) * 7,
            ty: tgt.y + (Math.random() - 0.5) * 7,
            dur: 520 + Math.random() * 340,
          });
          sfx.launch(k);
          await wait(85);
          if (!alive()) return;
        }
      }

      // 6. garante que ninguém fique de pé
      await wait(1500);
      if (!alive()) return;
      for (const m of marks) {
        if (!doomedRef.current.some((d) => d.key === m.key)) continue;
        setDoomed((ds) => ds.filter((d) => d.key !== m.key));
        setDying((ds) => [...ds, { key: m.key, player: m.player, king: m.king, r: m.r, c: m.c }]);
        addDecal(m.r, m.c, "scorch", 1.2);
        sfx.boom(0.8);
      }

      const wiped = cloneBoard(snapshot);
      for (const t of targets) wiped[t.r][t.c] = null;
      setBoard(wiped);
      if (!remote && match.backend !== "firebase") {
        publishRef.current?.(wiped, loser, victor, loser);
      }
      await wait(900);
      if (!alive()) return;

      setSiren(false);
      surrenderPlayingRef.current = false;
      // ETAPA 2 · o espetáculo acabou dos dois lados: agora o vencedor
      if (!remote && match.backend === "firebase" && match.matchId) {
        void finishRemoteSurrender(match.matchId, loser, encodeBoard(wiped)).catch(() => undefined);
      }
      setWinner(victor);
      if (victor === 1) localStorage.setItem("damas-ia-unlocked", "1");
      setBusy(false);
      sfx.win();
    },
    [addMissile, addDecal, match.backend, match.matchId],
  );
  executeSurrenderRef.current = executeSurrender;

  /** abre o diálogo avaliando se ainda havia chance */
  const askGiveUp = useCallback(() => {
    sfx.unlock();
    sfx.click();
    if (busy || winner || phase !== "playing") return;
    if (isObserver) {
      setWaitMsg({ text: "OBSERVADOR NÃO SE RENDE", at: Date.now() });
      return;
    }
    const side: Player = myPlayer ?? turn;
    if (match.mode === "online" && pauseUsed.surrender) {
      setWaitMsg({ text: "VOCÊ JÁ ABRIU A BANDEIRA NESTA RODADA", at: Date.now() });
      return;
    }
    // avisa o adversário IMEDIATAMENTE e congela o cronômetro dos dois
    if (match.mode === "online" && myPlayer && match.matchId) {
      setPauseUsed((u) => ({ ...u, surrender: true }));
      const me = names[myPlayer];
      setTyping({ who: me, kind: "surrender", until: Date.now() + TYPING_MS });
      beam({ action: "surrendering", typingKind: "surrender", typingUntil: Date.now() + TYPING_MS });
    }
    const c = countPieces(board);
    const mine = c[side];
    const theirs = c[side === 1 ? 2 : 1];
    // ainda dá pra virar? tem peça suficiente e a diferença não é humilhante
    const hopeful = mine >= 3 && mine >= theirs - 2;
    setConfirmGiveUp({ hopeful, side });
  }, [board, turn, busy, winner, phase, isObserver, myPlayer, pauseUsed, match.mode, match.matchId]);

  // ── clique ──
  runMoveRef.current = runMove;

  const handleCell = useCallback(
    (r: number, c: number) => {
      sfx.unlock();
      if (winner || phase !== "playing") return;

      // observador não joga; online, só na sua vez
      if (isObserver) {
        setWaitMsg({ text: "VOCÊ ESTÁ ASSISTINDO", at: Date.now() });
        sfx.denied();
        return;
      }
      if (myPlayer !== null && turn !== myPlayer) {
        setWaitMsg({ text: "AGUARDE A VEZ DO OPONENTE", at: Date.now() });
        sfx.denied();
        return;
      }

      // avisa por que o clique não pegou, em vez de simplesmente ignorar
      if (spinning) {
        setWaitMsg({ text: "AGUARDE A PLATAFORMA FREAR", at: Date.now() });
        sfx.denied();
        return;
      }
      if (busy) {
        setWaitMsg({
          text: dying.length || doomed.length ? "AGUARDE A FUMAÇA DISSIPAR" : "MANOBRA EM ANDAMENTO",
          at: Date.now(),
        });
        sfx.denied();
        return;
      }
      const piece = board[r][c];

      if (piece && piece.player === turn) {
        if (chain && (chain.r !== r || chain.c !== c)) return sfx.denied();
        if (!chain && forced.size > 0 && !forced.has(keyOf(r, c))) {
          sfx.denied();
          setShake(Date.now());
          return;
        }
        const all = movesFrom(board, r, c);
        const legal = chain || forced.size > 0 ? all.filter((m) => m.jump) : all;
        if (!legal.length) return sfx.denied();
        setSelected({ r, c });
        setMoves(legal);
        sfx.select();
        beam({
          action: "selecting",
          pick: [r, c],
          options: legal.map((m) => [m.to.r, m.to.c] as [number, number]),
          caps: legal.filter((m) => m.jump).map((m) => [m.jump!.r, m.jump!.c] as [number, number]),
        });
        return;
      }

      if (selected) {
        const mv = moves.find((m) => m.to.r === r && m.to.c === c);
        if (mv) {
          // trava o cronômetro deste turno: o lance já foi decidido
          timeoutSeqRef.current = seqSyncRef.current;

          void runMove(board, selected, mv);
          return;
        }
      }
      if (!chain) {
        setSelected(null);
        setMoves([]);
        beam({ action: "idle", pick: null, options: [], caps: [] });
      }
    },
    [
      board, turn, winner, busy, spinning, dying, doomed, chain, forced, selected, moves,
      runMove, phase, isObserver, myPlayer, match.backend, match.matchId,
    ],
  );

  // ── SINCRONIA ONLINE ──
  // Só trafega o estado (64 chars + turno). Cada cliente reproduz os
  // mísseis e o derretimento localmente — a rede não carrega animação.
  const seqSyncRef = useRef(0);
  useEffect(() => {
    if (!match.roomKey) return;
    const applyState = (s: {
      board: string;
      turn: Player;
      seq: number;
      winner: Player | null;
      surrendered?: Player | null;
      selected?: [number, number] | null;
      lastMove: { from?: [number, number]; to: [number, number]; jumps?: [number, number][] } | null;
    }) => {
      // ═══════════════════════════════════════════════════════════
      //  TRILHA 1 · EVENTOS LEVES — rodam SEMPRE, sem depender de seq.
      //  Seleção, rendição e fim de jogo NÃO incrementam seq: se
      //  passarem pelo guard abaixo, nunca chegam ao adversário.
      // ═══════════════════════════════════════════════════════════
      const iMoved = !isObserver && s.turn !== myPlayer;

      if (s.lastMove) setLastMoved({ r: s.lastMove.to[0], c: s.lastMove.to[1] });

      // rendição do rival: bandeira, sirene e barragem na hora
      if (s.surrendered && surrenderSeenRef.current !== s.surrendered) {
        surrenderSeenRef.current = s.surrendered;
        if (s.surrendered !== myPlayer || isObserver) {
          // usa o tabuleiro do snapshot: o local pode estar defasado
          const fromServer = s.board
            ? decodeBoard(s.board).map((row) =>
                row.map((c) => (c ? { id: ++uid, ...c, kills: 0 } : null)),
              )
            : boardRef.current;
          void executeSurrenderRef.current?.(s.surrendered, fromServer, false, true);
          return;
        }
      }

      // Durante a rendição, o commit final não pode entrar na trilha de
      // replay: ele cancelaria a animação remota no último segundo.
      if (s.winner && surrenderPlayingRef.current) {
        seqSyncRef.current = Math.max(seqSyncRef.current, s.seq);
        return;
      }
      if (s.winner) {
        endedRef.current = true;
        setWinner(s.winner);
        if (!s.surrendered) setBusy(false);
      }

      // ═══════════════════════════════════════════════════════════
      //  TRILHA 2 · LANCE — só quando a sequência realmente avança.
      // ═══════════════════════════════════════════════════════════
      if (s.seq <= seqSyncRef.current || !s.board) {
        // não é lance: libera o ghost para a seleção do rival aparecer
        setGhost(null);
        return;
      }
      seqSyncRef.current = s.seq;
      setRivalPick(null);
      setRivalMoves([]);
      setRivalCaps([]);

      // Este lance já começou ao vivo pelo pulso. O state que chegou agora
      // é só a confirmação oficial; não reproduzir tudo uma segunda vez.
      if (anticipatedStateSeqRef.current === s.seq) {
        anticipatedStateSeqRef.current = 0;
        return;
      }

      const lm = s.lastMove;

      const applySnapshot = (asObserver: boolean) => {
        const remote = decodeBoard(s.board);
        if (asObserver) {
          setBoard(remote.map((row) => row.map((cell) => (cell ? { id: ++uid, ...cell, kills: 0 } : null))));
          setFacing(s.turn);
        } else {
          setBoard((previous) =>
            previous.map((row, r) =>
              row.map((cell, c) => {
                const incoming = remote[r][c];
                if (!incoming) return null;
                return cell && cell.player === incoming.player
                  ? { ...cell, king: incoming.king }
                  : { id: ++uid, player: incoming.player, king: incoming.king, kills: 0 };
              }),
            ),
          );
        }
        setTurn(s.turn);
        setTurnFlash(Date.now());
        setBusy(false);
        setRadioUsedBy({ 1: false, 2: false });
      };

      if (iMoved && lm?.from) return; // autor de um lance real não reproduz de novo

      if (!lm?.from) {
        // Timeout e outras mudanças sem peça precisam chegar aos dois lados.
        applySnapshot(isObserver);
        return;
      }

      // 1) traça a rota, 2) reproduz o lance inteiro com mira/mísseis/derretimento
      const from = { r: lm.from[0], c: lm.from[1] };
      const to = { r: lm.to[0], c: lm.to[1] };
      const jumps = (lm.jumps || []).map(([r, c]) => ({ r, c }));
      const mover: Player = s.turn === 1 ? 2 : 1;

      const points: Pos[] = [from];
      if (jumps.length) {
        for (const j of jumps) {
          const prev = points[points.length - 1];
          const dr = Math.sign(j.r - prev.r);
          const dc = Math.sign(j.c - prev.c);
          points.push({ r: j.r + dr, c: j.c + dc });
        }
      }
      if (points[points.length - 1].r !== to.r || points[points.length - 1].c !== to.c) points.push(to);

      // cancela qualquer sequência velha para o replay nunca ser engolido
      seqRef.current++;
      setSpinning(false);
      setDoomed([]);
      setBusy(true);
      setGhost({ id: Date.now(), player: mover, points, captures: jumps });
      sfx.select();

      const fire = () => {
        const legal = movesFrom(boardRef.current, from.r, from.c);
        const first = jumps.length
          ? legal.find((m) => m.jump && m.jump.r === jumps[0].r && m.jump.c === jumps[0].c)
          : legal.find((m) => m.to.r === to.r && m.to.c === to.c);

        if (first) {
          void runMoveRef.current?.(boardRef.current, from, first, {
            jumps,
            board: s.board,
            turn: s.turn,
            winner: s.winner,
          });
        } else {
          // divergiu do estado local: assume o snapshot do servidor
          applySnapshot(isObserver);
        }
      };
      fire();
    };

    if (match.backend === "firebase" && match.matchId) {
      return subscribeRemoteMatch(
        match.matchId,
        (live) => {
          if (!live) return;
          setRemoteRoom(live);
          const t = live.typing;
          if (t && t.uid !== match.uid && t.until > Date.now()) {
            setTyping({ who: t.who, kind: t.kind, until: t.until });
          } else if (!t || (t.uid !== match.uid && t.until <= Date.now())) {
            setTyping((cur) => (cur && cur.who !== myNameRef.current ? null : cur));
          }
          applyState(live.state);
        },
        () => setLinkStatus({ state: "RECONNECTING", peers: 0, latencyMs: null, detail: "RTDB reconectando" }),
      );
    }

    return subscribeRoom(match.roomKey, (live) => {
      setRoom(live);
      const s = live.state;

      // Rádio local não incrementa seq; precisa vir antes do guard.
      const last = live.radio[live.radio.length - 1];
      if (last && last.id !== lastRadioRef.current) {
        lastRadioRef.current = last.id;
        const mine = (last.from === "host") === (match.seat === "host");
        if (!mine || isObserver) {
          sfx.holo();
          const at = s.lastMove ? { r: s.lastMove.to[0], c: s.lastMove.to[1] } : { r: 2, c: 3 };
          setRadioMsg({ id: last.id, text: last.text, nick: last.nick, r: at.r, c: at.c, mine: false });
          setTimeout(() => setRadioMsg((message) => (message?.id === last.id ? null : message)), 5200);
        }
      }
      applyState(s);
    });
  }, [match.backend, match.matchId, match.roomKey, myPlayer, isObserver, match.seat]);

  // Jogadores tentam WebRTC; RTDB já está aberta como fallback quente.
  useEffect(() => {
    if (match.backend !== "firebase" || !match.matchId || isObserver) return;
    let active = true;
    let unsubscribeStatus: (() => void) | null = null;
    void createPlayerChannel(match.matchId, match.roomKey || undefined).then((channel) => {
      if (!active) {
        void channel.close();
        return;
      }
      eventChannelRef.current = channel;
      unsubscribeStatus = channel.subscribeStatus(setLinkStatus);
    });
    return () => {
      active = false;
      unsubscribeStatus?.();
      const channel = eventChannelRef.current;
      eventChannelRef.current = null;
      if (channel) void channel.close();
    };
  }, [match.backend, match.matchId, match.roomKey, isObserver]);

  /** publica o estado depois que a minha jogada termina */
  const publish = useCallback(
    (
      b: BoardState,
      nextTurn: Player,
      win: Player | null = null,
      gaveUp: Player | null = null,
    ) => {
      if (!match.roomKey || isObserver) return;

      if (match.backend === "firebase" && match.matchId && match.uid) {
        const expectedSeq = seqSyncRef.current;
        const eventId = `${match.uid.slice(0, 6)}-${Date.now().toString(36)}`;
        void commitRemoteState(
          match.matchId,
          match.uid,
          expectedSeq,
          {
            board: encodeBoard(b),
            turn: nextTurn,
            lastMove: lastMoveRef.current,
            winner: win,
            surrendered: gaveUp,
            deadlineAt: win ? 0 : Date.now() + TURN_SECONDS * 1000,
          },
          eventId,
        )
                .then((result) => {
          if (result.committed && result.state) {
            seqSyncRef.current = result.state.seq;
            return;
          }
          if (result.state?.board) {
            const authoritative = decodeBoard(result.state.board);
            setBoard(
              authoritative.map((row) => row.map((c) => (c ? { id: ++uid, ...c, kills: 0 } : null))),
            );
            setTurn(result.state.turn);
            seqSyncRef.current = result.state.seq;
          }
        });
        return;
      }

      seqSyncRef.current += 1;
      pushState(match.roomKey, {
        board: encodeBoard(b),
        turn: nextTurn,
        seq: seqSyncRef.current,
        winner: win,
        surrendered: gaveUp,
        lastMove: lastMoveRef.current,
      });
    },
    [match.backend, match.matchId, match.roomKey, match.uid, isObserver],
  );
  publishRef.current = publish;

  // ── MODO CONTRA A MÁQUINA ──
  // Usa o MESMO runMove do humano. A IA escolhe o lance menos arriscado.
  useEffect(() => {
    if (match.mode !== "cpu" || phase !== "playing") return;
    if (winner || busy || spinning || turn === 1) return;
    if (dying.length || doomed.length) return;
    const t = window.setTimeout(() => {
      if (chain && moves.length && selected) {
        void runMove(board, selected, moves[0]);
        return;
      }
      const d = chooseMove(board, 2, 4);
      if (!d) return;
      setSelected(d.from);
      setMoves(movesFrom(board, d.from.r, d.from.c, forced.size > 0));
      sfx.select();
      window.setTimeout(() => void runMove(board, d.from, d.move), 620);
    }, 780);
    return () => clearTimeout(t);
  }, [match.mode, phase, winner, busy, spinning, turn, dying, doomed, board, chain, moves, selected, forced, runMove]);

  // ── OBSERVADOR SILENCIOSO ──
  // Analisa a posição e SÓ oferece rendição quando não há mais saída.
  // Nunca decide sozinho: só sugere ao jogador da vez.
  const [aiHint, setAiHint] = useState<string | null>(null);
  const hintedRef = useRef(0);
  useEffect(() => {
    if (phase !== "playing" || winner || busy || spinning || surrendered) return;
    if (isObserver) return;
    if (myPlayer !== null && turn !== myPlayer) return;
    const t = window.setTimeout(() => {
      const rep = analyzeRisk(board, turn);
      if (rep.hopeless && rep.total > 0 && hintedRef.current !== turn) {
        hintedRef.current = turn;
        setAiHint(rep.reason);
        sfx.denied();
      } else if (!rep.hopeless) {
        setAiHint(null);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [board, turn, phase, winner, busy, spinning, surrendered, isObserver, myPlayer]);

  // ── CRONÔMETRO DO LANCE (online) ──
  useEffect(() => {
    if (match.mode !== "online" || phase !== "playing" || winner || isObserver) return;

    // Os DOIS clientes vigiam o mesmo deadline. Se o celular da vez dormir,
    // o oponente continua acordado e confirma a perda do turno por transação.
    if (typing) {
      if (frozenClockRef.current === null) frozenClockRef.current = clockRef.current;
      setClock(frozenClockRef.current);
      return;
    }

    const base =
      match.backend === "firebase" && remoteRoom?.state.deadlineAt
        ? remoteRoom.state.deadlineAt
        : Date.now() + TURN_SECONDS * 1000;
    const deadline =
      frozenClockRef.current !== null
        ? Date.now() + frozenClockRef.current * 1000
        : base;
    frozenClockRef.current = null;
    let lastBeep = -1;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (turn === myPlayer) setClock(remaining);
      clockRef.current = remaining;
      if (turn === myPlayer && remaining <= 6 && remaining > 0 && remaining !== lastBeep) {
        lastBeep = remaining;
        sfx.beep();
      }

      if (remaining > 0 || timeoutSeqRef.current === seqSyncRef.current) return;

      // Só o dono da vez pode acionar a peça rebelde. Se ele dormiu, o outro
      // cliente confirma o timeout abaixo e apenas passa a vez.
      if (turn === myPlayer && selected && !busyRef.current) {
        timeoutSeqRef.current = seqSyncRef.current;
        const pick = chooseMove(board, turn, 3);
        const legal = pick
          ? pick
          : (() => {
              const all = allMoves(board, turn);
              return all.length ? { from: all[0].from, move: all[0].move } : null;
            })();
        if (legal) {
          setWaitMsg({ text: "PEÇA SELECIONADA SE REBELOU", at: Date.now() });
          sfx.denied();
          void runMove(board, legal.from, legal.move);
          return;
        }
      }

      if (match.backend === "firebase" && match.matchId) {
        timeoutSeqRef.current = seqSyncRef.current;
        void commitRemoteTimeout(match.matchId, seqSyncRef.current).then((result) => {
          if (!result.committed || !result.state) {
            timeoutSeqRef.current = null;
            return;
          }
          seqSyncRef.current = result.state.seq;
          setTurn(result.state.turn);
          setSelected(null);
          setMoves([]);
          setGhost(null);
          setRivalPick(null);
          setRivalMoves([]);
          setWaitMsg({ text: "TEMPO ESGOTADO · VEZ PASSADA", at: Date.now() });
          sfx.denied();
        });
        return;
      }

      // Fallback local do protótipo online.
      if (turn === myPlayer) {
        timeoutSeqRef.current = seqSyncRef.current;
        const next: Player = turn === 1 ? 2 : 1;
        setTurn(next);
        setSelected(null);
        setMoves([]);
        publishRef.current?.(board, next);
      }
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [
    match.backend,
    match.mode,
    phase,
    winner,
    isObserver,
    turn,
    myPlayer,
    board,
    typing,
    selected,
    runMove,
    remoteRoom?.state.deadlineAt,
  ]);

  // ── FISCALIZADOR DE SINCRONIA ──
  // Presença momentânea não decide vencedor: celular suspenso também some.
  // Apenas o hash do estado autoritativo é fiscalizado aqui.
  useEffect(() => {
    if (match.backend !== "firebase" || !remoteRoom || busy || winner) return;
    if (remoteRoom.state.seq !== seqSyncRef.current) return;
    const localHash = hashMatchState({
      board: encodeBoard(board),
      turn,
      seq: seqSyncRef.current,
      winner: null,
      surrendered: null,
    });
    const remoteHash = hashMatchState({
      board: remoteRoom.state.board,
      turn: remoteRoom.state.turn,
      seq: remoteRoom.state.seq,
      winner: null,
      surrendered: null,
    });
    if (localHash === remoteHash) return;

    // 6s de paciência: a animação do lance local precisa terminar antes
    // de qualquer comparação. 2.5s era rápido demais e desfez lances.
    const t = window.setTimeout(() => {
      const authoritative = decodeBoard(remoteRoom.state.board);
      setBoard(authoritative.map((row) => row.map((c) => (c ? { id: ++uid, ...c, kills: 0 } : null))));
      setTurn(remoteRoom.state.turn);
      setSelected(null);
      setMoves([]);
      setChain(null);
      setWaitMsg({ text: "SINCRONIZANDO COM O SERVIDOR", at: Date.now() });
    }, 6000);
    return () => clearTimeout(t);
  }, [match.backend, remoteRoom, board, turn, busy, winner]);

  // nova rodada: limpa resíduo visual e libera os botões de pausa
  useEffect(() => {
    setGhost(null);
    usedThisTurnRef.current = new Set();
    frozenClockRef.current = null;
    setPauseUsed({ nick: false, radio: false, surrender: false });
  }, [turn]);

  /**
   * ENCERRAR A SESSÃO · uma função só.
   * Usada pelo botão X, pelos 5 minutos e pelo abandono do rival.
   */
  const endSession = useCallback(
    (reason: string, iLeave: boolean) => {
      if (endedRef.current) return; // nunca encerra duas vezes
      endedRef.current = true;
      const champion: Player = iLeave ? (myPlayer === 1 ? 2 : 1) : myPlayer ?? 1;
      seqRef.current++;
      setBusy(false);
      setSpinning(false);
      setGhost(null);
      setDoomed([]);
      setConfirmGiveUp(null);
      setRadioOpen(false);
      setTyping(null);
      setDemo(false);
      setEndReason(reason);
      setWinner(champion);
      sfx.win();

      if (match.backend === "firebase" && match.matchId && myPlayer && !isObserver) {
        if (iLeave) void pushLeave(match.matchId, myPlayer).catch(() => undefined);
        const matchId = match.matchId;
        let attempt = 0;
        const tryDeclare = () => {
          void declareRemoteWinner(matchId, champion, iLeave ? "saida" : "inatividade")
            .then((official) => {
              // o servidor tem a palavra final
              if (official && official !== champion) {
                setWinner(official);
                setEndReason(
                  official === myPlayer
                    ? "O oponente encerrou a conexão."
                    : "A partida foi encerrada pelo oponente.",
                );
              }
            })
            .catch(() => {
              attempt += 1;
              if (attempt < 3) window.setTimeout(tryDeclare, 500 * attempt);
            });
        };
        tryDeclare();
      }
    },
    [match.backend, match.matchId, myPlayer, isObserver],
  );
  const endSessionRef = useRef(endSession);
  endSessionRef.current = endSession;

  // ── A PEÇA DO RIVAL AVISA A POSIÇÃO (canal leve, separado do estado) ──
  useEffect(() => {
    if (match.backend !== "firebase" || !match.matchId || !match.uid) return;
    return subscribePulses(match.matchId, match.uid, (rival) => {
      if (!rival) {
        setRivalPick(null);
        setRivalMoves([]);
        setRivalCaps([]);
        return;
      }

      // BANDEIRA BRANCA na hora: mesma lógica da peça selecionada
      // BANDEIRA BRANCA: aviso primeiro, bandeira junto, nos dois
      if (rival.action === "surrendered" && rival.surrendered) {
        if (surrenderSeenRef.current !== rival.surrendered) {
          surrenderSeenRef.current = rival.surrendered;
          // a mensagem chega antes da bandeira subir
          if (rival.typingKind === "surrender" && rival.typingUntil > Date.now()) {
            setTyping({ who: rival.nick || "OPONENTE", kind: "surrender", until: rival.typingUntil });
          }
          setTyping(null);
          void executeSurrenderRef.current?.(rival.surrendered, boardRef.current, false, true);
        }
        return;
      }

      // saída explícita
      if (rival.action === "left" && myPlayer && !isObserver) {
        endSessionRef.current("O oponente encerrou a conexão.", false);
        return;
      }

      // aviso com prazo: congela o cronômetro dos dois
      if (rival.typingUntil > Date.now() && rival.typingKind) {
        setTyping({ who: rival.nick || "OPONENTE", kind: rival.typingKind, until: rival.typingUntil });
      } else {
        setTyping((cur) => (cur && cur.who !== myNameRef.current ? null : cur));
      }

      // a peça selecionada dele acende aqui
      if (rival.action === "selecting" && rival.pick) {
        setRivalPick({ r: rival.pick[0], c: rival.pick[1] });
        setRivalMoves((rival.options || []).map(([r, c]) => ({ r, c })));
        setRivalCaps((rival.caps || []).map(([r, c]) => ({ r, c })));
      } else {
        setRivalPick(null);
        setRivalMoves([]);
        setRivalCaps([]);
      }

      // O rival começou UM salto. Reproduz agora, enquanto ele também vê.
      if (
        rival.action === "moving" &&
        rival.moveId > lastLiveMoveIdRef.current &&
        rival.moveFrom &&
        rival.moveTo &&
        rival.moveBoard
      ) {
        lastLiveMoveIdRef.current = rival.moveId;
        anticipatedStateSeqRef.current = rival.seq;
        setRivalPick(null);
        setRivalMoves([]);
        setRivalCaps([]);

        const from = { r: rival.moveFrom[0], c: rival.moveFrom[1] };
        const to = { r: rival.moveTo[0], c: rival.moveTo[1] };
        const jump = rival.moveJump
          ? { r: rival.moveJump[0], c: rival.moveJump[1] }
          : null;
        const legal = movesFrom(boardRef.current, from.r, from.c);
        const first = jump
          ? legal.find((move) =>
              Boolean(move.jump && move.jump.r === jump.r && move.jump.c === jump.c),
            )
          : legal.find((move) => move.to.r === to.r && move.to.c === to.c);

        if (first) {
          seqRef.current += 1;
          setSpinning(false);
          setBusy(true);
          void runMoveRef.current?.(boardRef.current, from, first, {
            jumps: jump ? [jump] : [],
            board: rival.moveBoard,
            turn: rival.moveTurn,
            winner: null,
            deferFinal: rival.moveDeferFinal,
          });
        }
      }

      // rádio
      if (rival.radioId && rival.radioId !== lastRadioRef.current) {
        lastRadioRef.current = rival.radioId;
        sfx.holo();
        setRadioMsg({
          id: rival.radioId,
          text: rival.radioText,
          nick: rival.nick || "OPONENTE",
          r: lastMovedRef.current.r,
          c: lastMovedRef.current.c,
          mine: false,
        });
        setTimeout(() => setRadioMsg((cur) => (cur?.id === rival.radioId ? null : cur)), 5200);
      }
    });
  }, [match.backend, match.matchId, match.uid, myPlayer, isObserver]);

  // ── SENSORES DE SAÍDA EM CASCATA (A → E) ──
  // Um só não basta: navegador fechado nem sempre dispara tudo.
  useEffect(() => {
    if (match.backend !== "firebase" || !match.matchId || isObserver || !myPlayer || winner) return;
    const matchId = match.matchId;
    // A) heartbeat: prova de vida a cada 5s quando o navegador está acordado.
    void beatRemotePresence(matchId);
    const beat = window.setInterval(() => void beatRemotePresence(matchId), 5_000);

    // bate na hora em que a tela volta (celular suspende timers em background)
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void beatRemotePresence(matchId);
        // acordou: garante que a partida continua, não encerra
        endedRef.current = endedRef.current && winner !== null;
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // B) vigia a prova de vida do rival. Fechar/suspender não encerra
    // imediatamente: a tolerância real é de 5 minutos.
    const rivalUid = match.seat === "host" ? remoteRoom?.players.p2?.uid : remoteRoom?.players.p1.uid;
    let stopBeat: (() => void) | null = null;
    if (rivalUid) {
      stopBeat = subscribeRemoteHeartbeat(matchId, rivalUid, (lastSeen) => {
        lastBeatRef.current = lastSeen;
      });
    }

    // C) somente 5 minutos sem heartbeat configura abandono.
    const audit = window.setInterval(() => {
      if (!lastBeatRef.current) return;
      if (Date.now() - lastBeatRef.current > IDLE_MS) setRivalLost(true);
    }, 5_000);

    return () => {
      clearInterval(beat);
      clearInterval(audit);
      stopBeat?.();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [match.backend, match.matchId, match.seat, remoteRoom?.players, isObserver, myPlayer, winner]);

  // ── MINHA CONEXÃO CAIU? ──
  useEffect(() => {
    if (match.mode !== "online" || winner) return;
    const down = () => setNetLost(true);
    const up = () => setNetLost(false);
    window.addEventListener("offline", down);
    window.addEventListener("online", up);
    if (!navigator.onLine) setNetLost(true);
    return () => {
      window.removeEventListener("offline", down);
      window.removeEventListener("online", up);
    };
  }, [match.mode, winner]);

  // ── CRONÔMETRO DA DIGITAÇÃO (pausa o turno) ──
  useEffect(() => {
    if (!typing) {
      setTypingLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((typing.until - Date.now()) / 1000));
      setTypingLeft(left);
      if (left <= 0) setTyping(null);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [typing]);

  // ── ADVERSÁRIO ABANDONOU ──
  // Só o heartbeat ausente por 5 minutos chega aqui. Parar de jogar sem
  // perder conexão apenas faz os turnos expirarem; não encerra a partida.
  useEffect(() => {
    if (!rivalLost || winner || !myPlayer || isObserver) return;
    setRivalLost(false);
    if (myPlayer === 1) localStorage.setItem("damas-ia-unlocked", "1");
    endSessionRef.current("O oponente encerrou a conexão. A Chave Diplomática foi cancelada.", false);
  }, [rivalLost, winner, myPlayer, isObserver, match.backend, match.matchId]);

  // ── TESTADOR AUTOMÁTICO ──
  // Não chama a engine por fora: usa os MESMOS estados e o MESMO runMove
  // que o clique humano usa. Se quebrar aqui, quebra pro jogador também.
  useEffect(() => {
    // respeita o mesmo bloqueio do humano: não joga girando nem no meio da fumaça
    // trava tripla: modo, sala remota e observador. Qualquer um desliga.
    if (!demo) return;
    if (match.mode === "online" || match.backend === "firebase" || match.roomKey || isObserver) return;
    if (phase !== "playing" || winner || busy || spinning) return;
    if (dying.length || doomed.length) return;

    const t = window.setTimeout(() => {
      if (chain && moves.length && selected) {
        void runMove(board, selected, moves[Math.floor(Math.random() * moves.length)]);
        return;
      }
      const legal = allMoves(board, turn);
      if (!legal.length) return;
      const pick = legal[Math.floor(Math.random() * legal.length)];
      setSelected(pick.from);
      setMoves(movesFrom(board, pick.from.r, pick.from.c, forced.size > 0));
      sfx.select();
      // pausa pra dar tempo de ver a peça escolhida antes de sair andando
      window.setTimeout(() => void runMove(board, pick.from, pick.move), 900);
    }, 1300);
    return () => clearTimeout(t);
  }, [demo, match.mode, match.backend, match.roomKey, isObserver, phase, winner, busy, spinning, dying, doomed, board, turn, chain, moves, selected, forced, runMove]);

  // ── reset ──
  const reset = useCallback(
    (toCutscene = false) => {
      sfx.unlock();
      sfx.click();
      seqRef.current++; // cancela qualquer sequência em voo
      metaRef.current.clear();
      comboRef.current = 0;
      setBoard(createInitialBoard());
      setTurn(1);
      setCombo(0);
      setMaxCombo(0);
      setChain(null);
      setSelected(null);
      setMoves([]);
      setCaptures({ 1: [], 2: [] });
      setDoomed([]);
      setDying([]);
      setDecals([]);
      setMissiles([]);
      setScanning(false);
      setWaitMsg(null);
      setSurrendered(null);
      setConfirmGiveUp(null);
      setSiren(false);
      setEncircledMsg(false);
      setFlies([]);
      setWinner(null);
      setComboFlash(0);
      setCrownFlash(0);
      setTurnFlash(0);
      setHolo(null);
      setMorphPending(null);
      setPromotedId(null);
      setFacing(1);
      setSpinning(false);
      setBusy(false);
      setCumRot((r) => (Math.round(r / 180) % 2 === 1 ? r + 180 : r));
      setDemo(false);
      endedRef.current = false;
      resetPulse();
      if (toCutscene) {
        setMatch({
          mode: "local",
          seat: "host",
          roomKey: null,
          nick: "",
          backend: "local",
          matchId: null,
          uid: null,
        });
        setRoom(null);
        setRemoteRoom(null);
        seqSyncRef.current = 0;
        setLinkStatus({ state: "CLOSED", peers: 0, latencyMs: null, detail: "Canal encerrado" });
      }
      setPhase(toCutscene ? "menu" : "countdown");
    },
    [],
  );

  return (
    <div
      className="bg-drift relative min-h-full"
      style={{
        backgroundImage:
          (match.mode === "online" || isObserver) && phase === "playing" && !winner
            ? `linear-gradient(${
                isObserver
                  ? turn === 1
                    ? "rgba(6,38,48,.86), rgba(4,22,30,.92)"
                    : "rgba(48,8,18,.86), rgba(30,4,12,.92)"
                  : turn === myPlayer
                    ? "rgba(6,42,26,.84), rgba(3,24,16,.92)"
                    : "rgba(48,6,10,.86), rgba(28,3,8,.93)"
              }), url(${hangarUrl})`
            : `linear-gradient(rgba(5,3,15,.82), rgba(5,3,15,.9)), url(${hangarUrl})`,
        transition: "background-image .6s ease",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {(match.mode === "online" || isObserver) && phase === "playing" && !winner && (
        <div
          className={`turn-wash ${isObserver ? "obs" : turn === myPlayer ? "go" : "wait"}`}
          style={
            {
              "--wash": isObserver
                ? turn === 1
                  ? "rgba(34,211,238,.30)"
                  : "rgba(244,63,94,.30)"
                : turn === myPlayer
                  ? "rgba(57,255,136,.24)"
                  : "rgba(255,45,45,.30)",
            } as React.CSSProperties
          }
        />
      )}

      <div className="crt-scanlines" />
      <div className="crt-chroma" />
      <div className="crt-vignette" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 pt-4 sm:px-5">
        <div>
          <h1 className="chrome-text font-pixel text-sm leading-relaxed sm:text-xl">DAMAS ORBITAIS</h1>
          <p className="font-pixel mt-1 text-[6px] tracking-[0.3em] text-amber-300/80 sm:text-[7px]">
            A VIAGEM DE BOBBY · MISSÃO TERRA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-arcade"
            onClick={() => {
              sfx.unlock();
              setMuted((m) => !m);
            }}
            title={muted ? "ligar som" : "silenciar"}
          >
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            <span className="hidden sm:inline">{muted ? "SOM OFF" : "SOM ON"}</span>
          </button>
          {match.mode !== "online" && !isObserver && (
            <button
              className="btn-arcade"
              onClick={() => {
                sfx.unlock();
                sfx.click();
                setDemo((d) => !d);
              }}
              title="testador automático: o jogo joga sozinho"
              style={demo ? { color: "#ffe9a8", borderColor: "#c98f2d" } : undefined}
            >
              <Bot size={13} />
              <span className="hidden sm:inline">{demo ? "DEMO ON" : "AUTO-DEMO"}</span>
            </button>
          )}
          <button
            className="btn-arcade"
            onClick={askGiveUp}
            disabled={phase !== "playing" || !!winner || busy}
            title="erguer a bandeira branca"
            style={{ opacity: phase !== "playing" || winner || busy ? 0.35 : 1 }}
          >
            <Flag size={14} />
            <span className="hidden sm:inline">DESISTIR</span>
          </button>
          <button
            className="btn-arcade gold"
            onClick={() => reset(match.mode === "online" || match.mode === "observer")}
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">REINICIAR</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 pt-3 pb-8 sm:px-5 lg:flex-row lg:items-start lg:gap-4">
        {sprites && (
          <div className="order-1">
            <Hud
              player={1}
              name={names[1]}
              remaining={counts[1]}
              captured={captures[1]}
              active={turn === 1 && !winner}
              facingBottom={facing === 1}
              trayRef={tray1Ref}
              lastArrival={arrival[1]}
              totalStars={totalStars[1]}
              sprites={sprites}
            />
          </div>
        )}

        <section className="order-2 flex-1">
          {/* ── PLACA DA PLATAFORMA ── */}
          {match.roomKey && (
            <StatusPlate
              code={match.roomKey}
              myName={isObserver ? "OBSERVADOR" : names[myPlayer ?? 1]}
              rivalName={names[myPlayer === 1 ? 2 : 1]}
              mySide={myPlayer}
              connected={
                match.backend === "firebase" ? Boolean(remoteRoom?.players.p2) : Boolean(room?.guest)
              }
              observers={
                match.backend === "firebase"
                  ? Object.keys(remoteRoom?.observers || {}).length
                  : room?.observers.length || 0
              }
              link={match.backend === "firebase" ? linkStatus.state : "DATABASE"}
              latencyMs={linkStatus.latencyMs}
              myTurn={turn === myPlayer}
              clock={clock}
              typingBy={typing ? typing.who : null}
              typingKind={typing ? typing.kind : null}
              typingLeft={typingLeft}
              radioUsed={pauseUsed.radio || (myPlayer ? radioUsedBy[myPlayer] : true)}
              onRename={(nick) => {
                if (match.backend === "firebase" && match.matchId) {
                  void updateRemoteNick(match.matchId, match.seat, nick);
                  beam({ action: "idle", nick, typingKind: null, typingUntil: 0 });
                } else if (match.roomKey) {
                  pushNick(match.roomKey, match.seat, nick);
                }
              }}
              onTypingStart={(kind) => {
                if (pauseUsed[kind]) return;
                setPauseUsed((u) => ({ ...u, [kind]: true }));
                setTyping({ who: names[myPlayer ?? 1], kind, until: Date.now() + TYPING_MS });
                beam({ action: "typing", typingKind: kind, typingUntil: Date.now() + TYPING_MS });
              }}
              onTypingEnd={() => {
                setTyping(null);
                beam({ action: "idle", typingKind: null, typingUntil: 0 });
              }}
              onRadio={() => {
                if (pauseUsed.radio) {
                  setWaitMsg({ text: "RÁDIO JÁ USADO NESTA RODADA", at: Date.now() });
                  return;
                }
                setPauseUsed((u) => ({ ...u, radio: true }));
                setRadioOpen(true);
                setTyping({ who: names[myPlayer ?? 1], kind: "radio", until: Date.now() + TYPING_MS });
                beam({ action: "typing", typingKind: "radio", typingUntil: Date.now() + TYPING_MS });
              }}
              onDisconnect={() => {
                sfx.click();
                // MESMA função dos 5 minutos: encerra e declara o vencedor
                if (isObserver) {
                  reset(true);
                } else {
                  endSession("Você encerrou a conexão. A vitória ficou com o oponente.", true);
                }
              }}
            />
          )}

          <div
            className={`panel-metal turn-bar mb-3 flex items-center justify-between gap-2 px-3 py-2.5 ${
              (match.mode === "online" || isObserver) && !winner
                ? isObserver
                  ? ""
                  : turn === myPlayer
                    ? "turn-bar-go"
                    : "turn-bar-wait"
                : ""
            }`}
            style={{ "--turn-glow": turn === 1 ? "rgba(34,211,238,.3)" : "rgba(244,63,94,.3)" } as React.CSSProperties}
          >
            <div
              key={turnFlash}
              className="glitch-swap font-pixel text-[8px] sm:text-[10px]"
              style={{ color: SOFT[turn], textShadow: `0 0 10px ${HEX[turn]}` }}
            >
              {winner
                ? "FIM DE JOGO"
                : isObserver
                  ? `JOGANDO: ${names[turn]}`
                  : myPlayer === null
                    ? `VEZ DE ${NAMES[turn]}`
                    : turn === myPlayer
                      ? "AGORA É SUA VEZ"
                      : `AGUARDE · VEZ DE ${names[turn]}`}
            </div>
            <div className="font-pixel text-[7px] text-amber-300 sm:text-[8px]">
              {chain ? (
                <span className="blink">COMBO ATIVO · ESCOLHA O PULO</span>
              ) : forced.size > 0 ? (
                <span className="blink">⚠ CAPTURA OBRIGATÓRIA</span>
              ) : doomed.length > 0 ? (
                <span className="blink text-rose-300">🎯 ALVOS MARCADOS: {doomed.length}</span>
              ) : (
                ""
              )}
            </div>
            <div className="font-pixel hidden text-[6px] text-white/30 sm:block">GRADE 8×8 · ÓRBITA BAIXA</div>
          </div>

          <div className="relative mx-auto w-full max-w-[580px]">
            {sprites ? (
              <Board
                sprites={sprites}
                board={board}
                turn={turn}
                facing={facing}
                cumRot={cumRot}
                spinning={spinning}
                selected={selected}
                moves={moves}
                forced={forced}
                chain={chain}
                dying={dying}
                doomed={doomed}
                decals={decals}
                missiles={missiles}
                shakeKey={shake}
                scanning={scanning}
                surrendered={surrendered}
                ghost={ghost}
                rivalPick={rivalPick}
                rivalMoves={rivalMoves}
                rivalCaps={rivalCaps}
                radio={radioMsg}
                names={names}
                disabled={busy || !!winner || phase !== "playing"}
                promotedId={promotedId}
                morphPendingId={morphPending}
                onCell={handleCell}
                onMeltDone={onMeltDone}
                onMissileImpact={onMissileImpact}
              />
            ) : (
              <div className="panel-metal aspect-square" />
            )}

            {/* ── SIRENE + ESTANDARTE DA RENDIÇÃO ── */}
            {siren && (
              <div className="pointer-events-none absolute inset-0 z-[63] overflow-hidden rounded-xl">
                <span className="siren-wash" />
                <span className="siren-beam" />
                <span className="siren-beam right" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="surrender-banner">
                    <Flag size={128} speed={0.8} />
                  </div>
                  <div className="font-pixel mt-3 text-center">
                    <div className="text-sm text-white drop-shadow-[0_0_16px_rgba(255,60,60,.9)] sm:text-2xl">
                      RENDIÇÃO!
                    </div>
                    <div className="mt-2 text-[7px] tracking-[0.25em] text-rose-200 sm:text-[9px]">
                      {surrendered ? names[surrendered] : ""} DEPÔS AS ARMAS
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ENCURRALADO: sem jogada, sem bandeira, sem dó ── */}
            {encircledMsg && (
              <div className="pointer-events-none absolute inset-0 z-[63] flex items-center justify-center">
                <div className="absolute inset-0 rounded-xl bg-rose-950/45" />
                <div className="popup-arcade relative text-center">
                  <div className="font-pixel text-lg text-rose-200 drop-shadow-[0_0_18px_rgba(255,60,60,.9)] sm:text-3xl">
                    ENCURRALADO!
                  </div>
                  <div className="font-pixel mt-3 text-[7px] tracking-[0.25em] text-white/70 sm:text-[9px]">
                    SEM MOVIMENTOS · SEM BANDEIRA · SEM PIEDADE
                  </div>
                </div>
              </div>
            )}

            {/* ── OBSERVADOR SILENCIOSO: sugere rendição ── */}
            {aiHint && !surrendered && !winner && (
              <div className="pointer-events-auto absolute inset-x-2 bottom-2 z-[61]">
                <div className="rise-in flex items-center gap-2 rounded-lg border border-amber-400/60 bg-black/90 px-3 py-2">
                  <span className="text-lg">🏳️</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-pixel text-[6px] tracking-widest text-amber-300">ANÁLISE TÁTICA</div>
                    <div className="text-[14px] leading-tight text-white/70">
                      Suas unidades não têm saída: {aiHint}.
                    </div>
                  </div>
                  <button className="btn-arcade !px-2 !py-1" onClick={askGiveUp}>
                    RENDER
                  </button>
                  <button className="btn-arcade !px-2 !py-1" onClick={() => setAiHint(null)}>
                    <X size={11} />
                  </button>
                </div>
              </div>
            )}

            {/* aviso de espera: explica por que o clique não pegou */}
            {waitMsg && (
              <div
                key={waitMsg.at}
                className="wait-toast pointer-events-none absolute inset-x-0 bottom-[8%] z-[62] flex justify-center"
                onAnimationEnd={() => setWaitMsg(null)}
              >
                <span className="font-pixel rounded border border-amber-400/60 bg-black/85 px-3 py-2 text-[7px] tracking-widest text-amber-300 shadow-[0_0_18px_rgba(255,190,60,.35)] sm:text-[9px]">
                  ⏳ {waitMsg.text}
                </span>
              </div>
            )}

            {phase === "countdown" && sprites && (
              <Countdown
                onDone={() => {
                  setPhase("playing");
                  setTurnFlash(Date.now());
                }}
              />
            )}

            {turnFlash > 0 && !winner && phase === "playing" && (
              <div key={turnFlash} className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center">
                <div className="flash-turn text-center">
                  <div
                    className="font-pixel text-lg sm:text-3xl"
                    style={{ color: SOFT[turn], textShadow: `0 0 24px ${HEX[turn]}, 0 3px 0 rgba(0,0,0,.8)` }}
                  >
                    {myPlayer === null || isObserver ? "SUA VEZ," : turn === myPlayer ? "AGORA É" : "AGUARDE"}
                  </div>
                  <div
                    className="font-pixel mt-2 text-2xl sm:text-5xl"
                    style={{ color: SOFT[turn], textShadow: `0 0 30px ${HEX[turn]}, 0 4px 0 rgba(0,0,0,.8)` }}
                  >
                    {myPlayer === null || isObserver
                      ? `${NAMES[turn]}!`
                      : turn === myPlayer
                        ? "SUA VEZ!"
                        : `VEZ DE ${names[turn]}`}
                  </div>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 z-[60] flex flex-col items-center justify-start gap-2 pt-[16%]">
              {comboFlash > 0 && combo >= 2 && (
                <div key={comboFlash} className="popup-arcade gold-text font-pixel text-xl sm:text-4xl">
                  COMBO ×{combo}!
                </div>
              )}
              {crownFlash > 0 && (
                <div key={crownFlash} className="popup-arcade flex items-center gap-2">
                  {sprites && <img src={sprites.crown} alt="" className="pixelated h-6 sm:h-8" />}
                  <span className="gold-text font-pixel text-sm sm:text-2xl">DAMA!</span>
                </div>
              )}
            </div>
          </div>

          {appInstalled && (
            <button
              className="mt-2 w-full text-center text-[13px] text-cyan-300/50 hover:text-cyan-200"
              onClick={() => setAboutOpen(true)}
            >
              QA Engineer &lt;/&gt; Marcos Eduardo com Bobby AI — Sobre
            </button>
          )}

          <p className="mt-3 text-center text-[13px] text-white/35">
            comer é obrigatório · combos em cadeia · a dama vira <span className="text-amber-300/80">blindada pesada</span> ·
            mísseis teleguiados marcam o piso pra sempre
          </p>
        </section>

        {sprites && (
          <div className="order-3">
            <Hud
              player={2}
              name={names[2]}
              remaining={counts[2]}
              captured={captures[2]}
              active={turn === 2 && !winner}
              facingBottom={facing === 2}
              trayRef={tray2Ref}
              lastArrival={arrival[2]}
              totalStars={totalStars[2]}
              sprites={sprites}
            />
          </div>
        )}
      </main>

      {sprites &&
        flies.map((f) => <FlySprite key={f.id} fly={f} src={sprites.front[f.piece.player]} onDone={onFlyDone} />)}

      {holo && (
        <HoloPlaque
          target={holo.target}
          accent={holo.accent}
          tone={myPlayer === null ? "neutral" : holo.owner === myPlayer ? "mine" : "rival"}
          ownerName={names[holo.owner]}
          onDone={() => setHolo(null)}
        />
      )}

      {/* ── RÁDIO DE COMBATE (uma mensagem por rodada) ── */}
      {radioOpen && myPlayer && (
        <div
          className="fixed inset-0 z-[87] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => {
            setRadioOpen(false);
            setTyping(null);
          }}
        >
          <div className="rise-in relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="panel-metal p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-pixel text-[7px] tracking-widest text-cyan-300">RÁDIO DE COMBATE</span>
                <span className="font-pixel text-[8px] text-amber-300">{typingLeft}s</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_PHRASES.map((phrase) => (
                  <button
                    key={phrase}
                    className="rounded border border-white/10 bg-white/5 px-2 py-2 text-left text-[14px] text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-400/10"
                    onClick={() => {
                      const filtered = filterMessage(phrase);
                      if (!filtered.ok) return;
                      if (match.backend === "firebase" && match.matchId) {
                        beam({ action: "idle", radioId: Date.now(), radioText: filtered.text });
                      } else if (match.roomKey) {
                        pushRadio(match.roomKey, match.seat, names[myPlayer], filtered.text);
                      }
                      setRadioMsg({
                        id: Date.now(),
                        text: filtered.text,
                        nick: names[myPlayer],
                        r: lastMoved.r,
                        c: lastMoved.c,
                        mine: true,
                      });
                      setTimeout(() => setRadioMsg(null), 5200);
                      setRadioUsedBy((used) => ({ ...used, [myPlayer]: true }));
                      setRadioOpen(false);
                      setTyping(null);
                      sfx.holo();
                    }}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
              <div className="font-pixel mt-2 text-center text-[6px] text-white/35">
                UMA MENSAGEM POR RODADA · O OPONENTE TEM DIREITO DE RESPOSTA
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TEM CERTEZA QUE QUER DESISTIR? ── */}
      {confirmGiveUp && (
        <div className="overlay-dim fade-in fixed inset-0 z-[86] flex items-center justify-center p-4">
          <div className="confirm-pop panel-metal relative w-full max-w-sm p-6 text-center">
            <div className="hazard absolute left-4 right-4 top-[3px] h-[6px] rounded-full opacity-70" />
            <div className="mx-auto mb-3 w-fit">
              <Flag size={54} speed={1.1} />
            </div>
            <div className="font-pixel text-[10px] text-white sm:text-xs">ERGUER A BANDEIRA BRANCA?</div>
            <p className="mx-auto mt-3 max-w-xs text-[15px] leading-tight text-white/70">
              {confirmGiveUp.hopeful ? (
                <>
                  Tem certeza? <span className="text-cyan-300">Sua aliança ainda parece ter chances!</span> Se
                  depuser as armas, o inimigo despeja tudo em cima das suas unidades.
                </>
              ) : (
                <>
                  A situação está <span className="text-rose-300">crítica</span>. Depor as armas encerra o
                  massacre — mas os rebeldes não são gentis com quem se rende.
                </>
              )}
            </p>
            <div className="font-pixel mt-3 text-[7px] text-amber-300/80">
              {countPieces(board)[confirmGiveUp.side]} UNIDADES ×{" "}
              {countPieces(board)[confirmGiveUp.side === 1 ? 2 : 1]} INIMIGAS →{" "}
              {countPieces(board)[confirmGiveUp.side === 1 ? 2 : 1] * SURRENDER_SALVO} MÍSSEIS
            </div>
            <div className="mt-5 flex justify-center gap-3">
              <button
                className="btn-arcade"
                onClick={() => {
                  sfx.click();
                  setConfirmGiveUp(null);
                  setTyping(null);
                  beam({ action: "idle", typingKind: null, typingUntil: 0 });
                }}
              >
                NÃO, VOU LUTAR
              </button>
              <button
                className="btn-arcade btn-danger"
                onClick={() => {
                  setTyping(null);
                  // a bandeira sobe no adversário AGORA, antes de qualquer animação
                  beam({
                    action: "surrendered",
                    typingKind: null,
                    typingUntil: 0,
                    surrendered: confirmGiveUp.side,
                  });
                  void executeSurrender(confirmGiveUp.side, board);
                }}
              >
                <Flag size={12} /> SIM, DESISTO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── #15: CAIU A NET · SANDBOX SEM SAÍDA ── */}
      {netLost && !winner && match.mode === "online" && (
        <div className="overlay-dim fade-in fixed inset-0 z-[89] flex items-center justify-center p-4">
          <div className="rise-in panel-metal relative w-full max-w-sm p-6 text-center">
            <div className="hazard absolute left-4 right-4 top-[3px] h-[6px] rounded-full opacity-70" />
            <div className="mx-auto mb-3 w-fit animate-pulse">
              <AntennaSprite bars={0} size={38} />
            </div>
            <div className="font-pixel text-[10px] text-rose-200">SINAL PERDIDO</div>
            <p className="mx-auto mt-3 max-w-xs text-[15px] leading-tight text-white/70">
              Você foi desconectado por problemas na sua rede. Tentando restabelecer a rota orbital…
            </p>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-black/60">
              <div className="key-progress" />
            </div>
            <div className="mt-4 flex justify-center gap-2">
              <button
                className="btn-arcade gold"
                onClick={() => {
                  sfx.click();
                  if (navigator.onLine) setNetLost(false);
                  else setWaitMsg({ text: "AINDA SEM SINAL", at: Date.now() });
                }}
              >
                <RotateCcw size={12} /> RECONECTAR
              </button>
            </div>
            <div className="font-pixel mt-3 text-[6px] text-white/35">
              A PARTIDA CONTINUA VIVA ENQUANTO O CANAL VOLTAR
            </div>
          </div>
        </div>
      )}

      {phase === "cutscene" && (
        <Cutscene
          onAbout={() => setAboutOpen(true)}
          installed={appInstalled}
          bobbySrc={sprites?.bobby ?? null}
          progress={progress}
          progressLabel={progressLabel}
          ready={!!sprites}
          onDone={() => setPhase("menu")}
        />
      )}

      {phase === "menu" && autoKey && !gateDone && (
        <JoinGate
          code={autoKey}
          defaultNick={localStorage.getItem("damas-nick") || "COMANDANTE"}
          ready={Boolean(qrProbe && !gateError)}
          error={gateError}
          busy={gateBusy}
          onConfirm={(nick) => {
            localStorage.setItem("damas-nick", nick);
            if (gateBusy || !qrProbe) return;
            setGateBusy(true);
            void joinRemoteMatch(autoKey, nick, "play")
              .then((identity) => {
                setDemo(false);
                setMatch({
                  mode: identity.seat === "observer" ? "observer" : "online",
                  seat: identity.seat,
                  roomKey: identity.code,
                  nick,
                  backend: "firebase",
                  matchId: identity.matchId,
                  uid: identity.uid,
                });
                setRemoteRoom(identity.match);
                seqSyncRef.current = identity.match.state.seq;
                if (identity.seat === "guest") {
                  setFacing(2);
                  setCumRot((r) => (Math.round(r / 180) % 2 === 0 ? r + 180 : r));
                }
                window.history.replaceState({}, "", "/");
                setAutoKey(null);
                setQrProbe(null);
                setGateDone(true);
                setPhase(identity.seat === "observer" ? "playing" : "countdown");
              })
              .catch((error: unknown) => {
                setGateError(error instanceof Error ? error.message : "Falha ao entrar na partida.");
                setGateBusy(false);
              });
          }}
          onCancel={() => {
            window.history.replaceState({}, "", "/");
            setAutoKey(null);
            setQrProbe(null);
            qrProbeStartedRef.current = false;
            setGateDone(true);
            setPhase("cutscene");
          }}
        />
      )}

      {phase === "menu" && (!autoKey || gateDone) && sprites && (
        <MainMenu
          sprites={sprites}
          autoKey={autoKey}
          initialBoard={encodeBoard(createInitialBoard())}
          onStart={(cfg) => {
            setMatch(cfg);
            if (cfg.mode !== "local") setDemo(false);
            setAutoKey(null);
            seqSyncRef.current = 0;
            setRoom(null);
            setRemoteRoom(null);
            if (cfg.mode === "online" && cfg.seat === "guest") {
              setFacing(2);
              setCumRot((rotation) => (Math.round(rotation / 180) % 2 === 0 ? rotation + 180 : rotation));
            } else {
              setFacing(1);
              setCumRot((rotation) => (Math.round(rotation / 180) % 2 === 1 ? rotation + 180 : rotation));
            }
            setPhase(cfg.mode === "observer" ? "playing" : "countdown");
          }}
        />
      )}

      {aboutOpen && (
        <AboutDialog bobbySrc={sprites?.bobby ?? null} onClose={() => setAboutOpen(false)} />
      )}

      {winner && (
        <div className="overlay-dim fade-in fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="rise-in panel-metal relative w-full max-w-md p-6 text-center">
            <div className="hazard absolute left-4 right-4 top-[3px] h-[6px] rounded-full opacity-70" />
            <div className="gold-text font-pixel text-[9px] tracking-[0.3em]">FIM DE JOGO</div>
            <img
              src={sprites?.kingFront[winner] || ""}
              alt=""
              className="hero-bounce mx-auto my-4 w-32"
              style={sprites ? undefined : { display: "none" }}
            />
            <div className="font-pixel text-sm sm:text-lg" style={{ color: SOFT[winner], textShadow: `0 0 18px ${HEX[winner]}` }}>
              {names[winner]}
            </div>
            <div className="font-pixel mt-1 text-[7px] tracking-widest text-white/50">
              {surrendered ? "ACEITOU A RENDIÇÃO" : "DOMINOU A ÓRBITA"}
            </div>
            {(match.mode === "online" || isObserver) && (
              <div
                className="font-pixel mx-auto mt-3 w-fit rounded border px-3 py-1.5 text-[8px] tracking-widest"
                style={
                  isObserver
                    ? { borderColor: "#7c5cc4", color: "#c4b5fd", background: "rgba(76,29,149,.25)" }
                    : winner === myPlayer
                      ? { borderColor: "#2f9e63", color: "#7dffc4", background: "rgba(13,58,36,.4)" }
                      : { borderColor: "#b8202f", color: "#ffb3c0", background: "rgba(61,13,20,.4)" }
                }
              >
                {isObserver ? "TRANSMISSÃO ENCERRADA" : winner === myPlayer ? "★ VOCÊ VENCEU ★" : "VOCÊ FOI DERROTADO"}
              </div>
            )}
            <p className="mx-auto mt-3 max-w-xs text-[15px] leading-tight text-white/60">
              {endReason || VICTORY_LINE[winner]}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-white/10 bg-black/40 p-2">
                <div className="font-pixel text-lg text-white">{captures[winner].length}</div>
                <div className="font-pixel mt-1 text-[6px] text-white/40">SAQUEADAS</div>
              </div>
              <div className="rounded-md border border-white/10 bg-black/40 p-2">
                <div className="font-pixel text-lg text-amber-300">×{maxCombo}</div>
                <div className="font-pixel mt-1 text-[6px] text-white/40">MAIOR COMBO</div>
              </div>
              <div className="rounded-md border border-white/10 bg-black/40 p-2">
                <div className="font-pixel text-lg text-amber-300">{totalStars[winner]}</div>
                <div className="font-pixel mt-1 text-[6px] text-white/40">ESTRELAS</div>
              </div>
            </div>

            <div className="mt-5 flex justify-center gap-2">
              {match.mode === "online" || isObserver ? (
                <button
                  className="btn-arcade gold"
                  onClick={() => {
                    setEndReason(null);
                    reset(true);
                  }}
                >
                  OK
                </button>
              ) : (
                <>
                  <button className="btn-arcade gold" onClick={() => reset(false)}>
                    <RotateCcw size={12} /> REVANCHE
                  </button>
                  <button className="btn-arcade" onClick={() => reset(true)}>
                    TROCAR MODO
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
