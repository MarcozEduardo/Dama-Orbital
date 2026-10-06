// ─────────────────────────────────────────────────────────────
//  MENU DE BATALHA · painel de controle
//  Monitor CRT em cima (guerra rolando ou terminal de mensagens),
//  controles físicos embaixo. O texto explicativo NÃO polui os
//  botões: vive no hover e em INFORMAÇÕES.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Loader2, QrCode } from "lucide-react";
import QRCode from "qrcode";
import marcaoUrl from "../assets/marcao.png";
import WarScreen from "./WarScreen";
import { BtnDispositivos, BtnInfo, BtnObservador, BtnPadrao } from "./PanelButtons";
import { KeySprite } from "./Sprites";
import { sfx } from "../game/audio";
import type { SpriteSet } from "../game/sprites";
import { firebaseReadiness } from "../config/firebase";
import {
  createRemoteMatch,
  joinRemoteMatch,
  subscribeRemoteMatch,
  type ConnectionIdentity,
  type RemoteMatch,
} from "../game/network";
import {
  getNick,
  hostRoom,
  joinRoom,
  normalizeKey,
  setNick as saveNick,
  subscribeRoom,
  transportInfo,
  watchRoom,
  type Room,
  type Seat,
} from "../game/net";

export interface MatchConfig {
  mode: "local" | "online" | "observer" | "cpu";
  seat: Seat;
  roomKey: string | null;
  nick: string;
  backend: "local" | "firebase";
  matchId: string | null;
  uid: string | null;
}

interface Props {
  sprites: SpriteSet;
  initialBoard: string;
  /** chave vinda do QR: entra direto */
  autoKey?: string | null;
  onStart: (cfg: MatchConfig) => void;
}

type Screen = "home" | "link" | "observer" | "info" | "connecting";

interface Msg {
  who: "bobby" | "marcao";
  text: string;
}

interface MenuRoom {
  key: string;
  guest: { nick: string } | null;
  observers: Array<{ nick: string }>;
}

const localRoomPreview = (room: Room): MenuRoom => ({
  key: room.key,
  guest: room.guest ? { nick: room.guest.nick } : null,
  observers: room.observers.map((observer) => ({ nick: observer.nick })),
});

const remoteRoomPreview = (room: RemoteMatch): MenuRoom => ({
  key: room.code,
  guest: room.players.p2 ? { nick: room.players.p2.nick } : null,
  observers: Object.values(room.observers || {}).map((observer) => ({ nick: observer.nick })),
});

function friendlyNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/operation-not-allowed|configuration-not-found/i.test(message)) {
    return "Anonymous Auth ainda não está ativado no Firebase Console.";
  }
  if (/permission-denied|permission_denied|PERMISSION_DENIED/i.test(message)) {
    return "A Realtime Database recusou o acesso. Publique database.rules.json.";
  }
  if (/network-request-failed|failed to fetch|offline/i.test(message)) {
    return "Sem conexão com o Firebase. Confira a internet e a Database URL.";
  }
  if (/api-key-not-valid|invalid-api-key/i.test(message)) {
    return "A API Key não pertence a este Web App ou está restrita para outro domínio.";
  }
  return message || "Falha ao abrir o canal diplomático.";
}

const SCRIPTS: Record<string, Msg[]> = {
  link: [
    {
      who: "bobby",
      text: "Clique no botão da CHAVE DIPLOMÁTICA aqui do lado. Peça pro seu amigo escanear o QR com o aparelho dele, ou copie o código e mande pra ele!",
    },
    {
      who: "marcao",
      text: "E se VOCÊ já recebeu um código de alguém, pode injetar no meu painel aqui embaixo.",
    },
    {
      who: "bobby",
      text: "Só um detalhe: se uma terceira pessoa injetar a mesma chave, ela entra na partida como OBSERVADORA!",
    },
  ],
  linkAfterKey: [
    {
      who: "bobby",
      text: "Chave diplomática emitida! Esse código é único e vale só pra esta batalha. Mostre o QR ou dite o código.",
    },
    {
      who: "marcao",
      text: "Ok, você gerou o código. Então não adianta colar ele aqui, hein! Mas se seu amigo te enviar um, aí sim pode injetar no meu painel.",
    },
  ],
  observer: [
    {
      who: "bobby",
      text: "Pra assistir eu preciso de uma chave diplomática gerada no modo 2 DISPOSITIVOS, com a partida rolando em outro aparelho.",
    },
    {
      who: "marcao",
      text: "E não adianta gerar a chave e tentar assistir no MESMO aparelho. Eu confiro o identificador do dispositivo, viu?",
    },
    {
      who: "bobby",
      text: "Se só tiver uma pessoa esperando, você vira o OPONENTE dela. Não dá pra assistir partida de um jogador só!",
    },
  ],
  info: [
    { who: "marcao", text: "Bobby, explica aí pro pessoal como funciona esse tabuleiro orbital." },
    {
      who: "bobby",
      text: "O modo PADRÃO você pode jogar sozinho, contra o outro lado, ou chamar alguém que está do seu lado. A plataforma gira a cada turno!",
    },
    {
      who: "bobby",
      text: "Descobrimos agora pouco: na opção 2 DISPOSITIVOS você gera uma chave da diplomacia, lê o QR Code ou digita a chave, e joga cada um no seu dispositivo — Desktop ou Smartphone.",
    },
    { who: "marcao", text: "Caramba! E tem mais alguma coisa aí? Que notícia maravilhosa." },
    {
      who: "bobby",
      text: "Registrei uma notícia aqui sobre uma IA, mas parece que precisamos que a aliança do Bobby vença uma vez para desbloquear!",
    },
  ],
  infoUnlocked: [
    { who: "marcao", text: "Fala Bobby, conseguiu descobrir o que era essa informação secreta sobre IA?" },
    {
      who: "bobby",
      text: "Marcão, conseguimos o modo CONTRA A MÁQUINA! O modo já aparece no menu. Quem escolher vai jogar com o time que quiser, e o tabuleiro não vai girar, pois quem está do lado de lá é uma IA!",
    },
    { who: "bobby", text: "Câmbio, desligo!" },
  ],
};

/** terminal com máquina de escrever dentro da tela CRT */
function Terminal({ msgs, onDone }: { msgs: Msg[]; onDone?: (i: number) => void }) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const cur = msgs[Math.min(idx, msgs.length - 1)];
  const doneAll = idx >= msgs.length;

  useEffect(() => {
    setIdx(0);
    setShown(0);
  }, [msgs]);

  useEffect(() => {
    if (doneAll) return;
    if (shown < cur.text.length) {
      const t = setTimeout(() => {
        setShown((s) => s + 1);
        if (cur.text[shown] !== " ") sfx.blip(cur.who === "bobby" ? 1.25 : 0.82);
      }, 17);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      onDone?.(idx);
      setIdx((i) => i + 1);
      setShown(0);
    }, 950);
    return () => clearTimeout(t);
  }, [shown, idx, cur, doneAll, onDone]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [shown, idx]);

  return (
    <div ref={boxRef} className="term h-full space-y-2 overflow-y-auto px-3 py-2 text-[17px] leading-[1.25]">
      {msgs.slice(0, idx + 1).map((m, i) => {
        const text = i === idx && !doneAll ? m.text.slice(0, shown) : m.text;
        if (!text) return null;
        const bobby = m.who === "bobby";
        return (
          <div key={i} className={`term-line flex ${bobby ? "justify-start" : "justify-end"}`}>
            <div
              className="max-w-[86%] rounded-md px-2.5 py-1.5"
              style={{
                background: bobby ? "rgba(14,116,144,.3)" : "rgba(180,83,9,.28)",
                border: `1px solid ${bobby ? "rgba(34,211,238,.5)" : "rgba(245,158,11,.5)"}`,
                color: bobby ? "#9df6ff" : "#ffdca8",
                textShadow: `0 0 7px ${bobby ? "rgba(34,211,238,.5)" : "rgba(245,158,11,.4)"}`,
              }}
            >
              <span
                className="font-pixel mr-1.5 text-[6px] tracking-widest"
                style={{ color: bobby ? "#22d3ee" : "#f59e0b" }}
              >
                {bobby ? "BOBBY" : "MARCÃO"}
              </span>
              {text}
              {i === idx && !doneAll && <span className="term-caret" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MainMenu({ sprites, initialBoard, autoKey, onStart }: Props) {
  const [screen, setScreen] = useState<Screen>(autoKey ? "connecting" : "home");
  const [nick, setNickState] = useState(() => getNick(""));
  const [room, setRoom] = useState<MenuRoom | null>(null);
  const [seat, setSeat] = useState<Seat>("host");
  const [qr, setQr] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyLit, setKeyLit] = useState(false);
  const [tilt, setTilt] = useState(0);
  const [dots, setDots] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [networkBusy, setNetworkBusy] = useState(false);
  const [qrBig, setQrBig] = useState(false);
  const [cpuUnlocked] = useState(() => localStorage.getItem("damas-ia-unlocked") === "1");
  const unsubRef = useRef<(() => void) | null>(null);
  const startedRef = useRef(false);
  const remoteIdentityRef = useRef<ConnectionIdentity | null>(null);
  const firebaseReady = firebaseReadiness().configured;

  useEffect(() => () => unsubRef.current?.(), []);

  useEffect(() => {
    if (screen !== "connecting") return;
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 380);
    return () => clearInterval(t);
  }, [screen]);

  const go = useCallback((s: Screen, script?: Msg[]) => {
    sfx.click();
    setTilt((t) => t + 1);
    setScreen(s);
    setErr(null);
    setMsgs(script ?? []);
  }, []);

  // ── QR: entra direto na partida ──
  const joinWith = useCallback(
    async (rawKey: string, preferObserver = false) => {
      const key = normalizeKey(rawKey);
      const who = nick || getNick("COMANDANTE") || "COMANDANTE";
      setNetworkBusy(true);
      setErr(null);

      try {
        if (firebaseReady) {
          const identity = await joinRemoteMatch(key, who, preferObserver ? "observe" : "play");
          remoteIdentityRef.current = identity;
          setSeat(identity.seat);
          setRoom(remoteRoomPreview(identity.match));
          setScreen("connecting");
          sfx.holo();
          startedRef.current = true;
          unsubRef.current?.();
          unsubRef.current = subscribeRemoteMatch(identity.matchId, (live) => {
            if (live) setRoom(remoteRoomPreview(live));
          });
          setTimeout(
            () =>
              onStart({
                mode: identity.seat === "observer" ? "observer" : "online",
                seat: identity.seat,
                roomKey: identity.code,
                nick: who,
                backend: "firebase",
                matchId: identity.matchId,
                uid: identity.uid,
              }),
            1800,
          );
          return true;
        }

        const res = preferObserver ? watchRoom(key, who) : joinRoom(key, who);
        if (!res.ok || !res.room) {
          throw new Error(
            res.error === "mesmo-aparelho"
              ? "Essa chave foi gerada NESTE aparelho. Chame alguém de fora!"
              : res.error === "chave-invalida"
                ? "A chave tem 6 caracteres."
                : "Nenhuma partida encontrada com essa chave. Ela pode ter expirado.",
          );
        }
        setSeat(res.seat!);
        setRoom(localRoomPreview(res.room));
        setScreen("connecting");
        sfx.holo();
        startedRef.current = true;
        unsubRef.current?.();
        unsubRef.current = subscribeRoom(res.room.key, (live) => setRoom(localRoomPreview(live)));
        setTimeout(
          () =>
            onStart({
              mode: res.seat === "observer" ? "observer" : "online",
              seat: res.seat!,
              roomKey: res.room!.key,
              nick: who,
              backend: "local",
              matchId: null,
              uid: null,
            }),
          1800,
        );
        return true;
      } catch (error) {
        setErr(friendlyNetworkError(error));
        sfx.denied();
        return false;
      } finally {
        setNetworkBusy(false);
      }
    },
    [firebaseReady, nick, onStart],
  );

  // chave por link ?chave=XXXX → injeta sozinho
  useEffect(() => {
    if (!autoKey) return;
    setTyped(normalizeKey(autoKey));
    void joinWith(autoKey).then((ok) => {
      if (!ok) go("link", SCRIPTS.link);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  const doHost = useCallback(async () => {
    sfx.click();
    setErr(null);
    setNetworkBusy(true);
    try {
      let roomKey: string;

      if (firebaseReady) {
        const identity = await createRemoteMatch(nick || "ALIANÇA BOBBY", initialBoard);
        remoteIdentityRef.current = identity;
        roomKey = identity.code;
        setRoom(remoteRoomPreview(identity.match));
        setSeat("host");
        unsubRef.current?.();
        unsubRef.current = subscribeRemoteMatch(identity.matchId, (live) => {
          if (!live) return;
          setRoom(remoteRoomPreview(live));
          if (live.players.p2 && !startedRef.current) {
            startedRef.current = true;
            sfx.crown();
            setScreen("connecting");
            setTimeout(
              () =>
                onStart({
                  mode: "online",
                  seat: "host",
                  roomKey: identity.code,
                  nick: live.players.p1.nick,
                  backend: "firebase",
                  matchId: identity.matchId,
                  uid: identity.uid,
                }),
              1700,
            );
          }
        });
      } else {
        const local = hostRoom(nick || "ALIANÇA BOBBY", initialBoard);
        roomKey = local.key;
        setRoom(localRoomPreview(local));
        setSeat("host");
        unsubRef.current?.();
        unsubRef.current = subscribeRoom(local.key, (live) => {
          setRoom(localRoomPreview(live));
          if (live.guest && !startedRef.current) {
            startedRef.current = true;
            sfx.crown();
            setScreen("connecting");
            setTimeout(
              () =>
                onStart({
                  mode: "online",
                  seat: "host",
                  roomKey: live.key,
                  nick: live.host.nick,
                  backend: "local",
                  matchId: null,
                  uid: null,
                }),
              1700,
            );
          }
        });
      }

      setMsgs(SCRIPTS.linkAfterKey);
      // Sempre aponta para a raiz pública. Se a página atual tiver um caminho
      // estranho, ele não pode contaminar o QR.
      const url = `${location.origin}/?chave=${roomKey}`;
      setQr(await QRCode.toDataURL(url, { width: 260, margin: 1, color: { dark: "#0b1030", light: "#a5f3fc" } }));
      sfx.holo();
    } catch (error) {
      setQr(null);
      setErr(friendlyNetworkError(error));
      sfx.denied();
    } finally {
      setNetworkBusy(false);
    }
  }, [firebaseReady, nick, initialBoard, onStart]);

  const copyKey = useCallback(() => {
    if (!room) return;
    sfx.click();
    void navigator.clipboard?.writeText(room.key).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [room]);

  const back = () => {
    sfx.click();
    if (!startedRef.current) {
      unsubRef.current?.();
      unsubRef.current = null;
    }
    setRoom(null);
    setQr(null);
    setErr(null);
    setMsgs([]);
    setKeyLit(false);
    setTilt((t) => t + 1);
    setScreen("home");
  };

  // acende o botão da chave quando o Bobby termina a 1ª fala
  const onMsgDone = useCallback(
    (i: number) => {
      if (screen === "link" && i === 0 && !room) {
        setKeyLit(true);
        sfx.holo();
      }
    },
    [screen, room],
  );

  const keyInput = (accent: "amber" | "violet", onSubmit: () => void, cta: string) => (
    <div className="flex gap-2">
      <input
        value={typed}
        onChange={(e) => (setTyped(normalizeKey(e.target.value)), setErr(null))}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="A1B2C3"
        maxLength={6}
        inputMode="text"
        autoCapitalize="characters"
        className={`font-pixel min-w-0 flex-1 rounded border bg-black/60 px-2 py-2 text-center text-sm tracking-[0.3em] outline-none sm:text-base ${
          accent === "amber"
            ? "border-amber-400/40 text-amber-200 placeholder:text-amber-200/20 focus:border-amber-300"
            : "border-violet-400/40 text-violet-200 placeholder:text-violet-200/20 focus:border-violet-300"
        }`}
      />
      <button
        className={`btn-arcade ${accent === "amber" ? "gold" : ""}`}
        disabled={typed.length !== 6 || networkBusy}
        onClick={onSubmit}
      >
        {networkBusy ? "CONECTANDO" : cta}
      </button>
    </div>
  );

  // ───────────── conteúdo abaixo da tela ─────────────
  let controls: React.ReactNode;

  if (screen === "home") {
    controls = (
      <>
        <div className="grid grid-cols-4 gap-2">
          <BtnPadrao
            onClick={() => {
              sfx.click();
              onStart({
                mode: "local",
                seat: "host",
                roomKey: null,
                nick: nick || "COMANDANTE",
                backend: "local",
                matchId: null,
                uid: null,
              });
            }}
          />
          <BtnDispositivos onClick={() => go("link", SCRIPTS.link)} />
          <BtnObservador onClick={() => go("observer", SCRIPTS.observer)} />
          <BtnInfo onClick={() => go("info", cpuUnlocked ? SCRIPTS.infoUnlocked : SCRIPTS.info)} />
        </div>
        <button className="home-key mt-2" onClick={() => go("link", SCRIPTS.link)}>
          <KeySprite size={44} />
          <span className="min-w-0 flex-1 text-left">
            <b>TENHO UMA CHAVE</b>
            <i>Injetar código e entrar direto na batalha</i>
          </span>
          <span className="font-pixel shrink-0 text-[7px] text-amber-300/80">▶</span>
        </button>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {cpuUnlocked && (
            <button
              className="ctrl col-span-2"
              onClick={() => {
                sfx.click();
                onStart({
                  mode: "cpu",
                  seat: "host",
                  roomKey: null,
                  nick: nick || "COMANDANTE",
                  backend: "local",
                  matchId: null,
                  uid: null,
                });
              }}
            >
              <span className="ctrl-art grid place-items-center text-2xl">🤖</span>
              <span className="ctrl-label">CONTRA A MÁQUINA</span>
              <span className="ctrl-tip">A IA joga do outro lado</span>
            </button>
          )}
        </div>
      </>
    );
  } else if (screen === "link") {
    controls = (
      <div className="space-y-2">
        <div className="grid grid-cols-[auto_1fr] items-center gap-3">
          <div className={`key-slot ${keyLit ? "lit" : ""} rounded-xl`}>
            <button
              className="ctrl !border-amber-500/60"
              onClick={() => void doHost()}
              disabled={!!room || networkBusy}
              title="Gerar chave diplomática"
            >
              <span className="ctrl-art">
                <svg viewBox="0 0 48 48" className="pixelated h-full w-full" shapeRendering="crispEdges">
                  <circle cx="24" cy="25" r="21" fill="#2a2410" />
                  <circle cx="24" cy="24" r="21" fill={keyLit ? "#c99a1c" : "#5b5340"} />
                  <circle cx="24" cy="24" r="18" fill="#3d3110" />
                  <circle cx="19" cy="19" r="7" fill={keyLit ? "#ffd24a" : "#8a8272"} />
                  <circle cx="19" cy="19" r="3" fill="#3d3110" />
                  <rect
                    x="21"
                    y="21"
                    width="14"
                    height="4"
                    fill={keyLit ? "#ffd24a" : "#8a8272"}
                    transform="rotate(45 21 21)"
                  />
                  <rect x="29" y="29" width="4" height="5" fill={keyLit ? "#ffd24a" : "#8a8272"} />
                  <rect x="32" y="32" width="5" height="4" fill={keyLit ? "#ffd24a" : "#8a8272"} />
                </svg>
              </span>
              <span className="ctrl-label">{networkBusy ? "CONECTANDO" : "GERAR CHAVE"}</span>
            </button>
          </div>

          {room ? (
            <div className="flex items-center gap-3 rounded-lg border border-cyan-400/40 bg-black/50 p-2">
              <div className="min-w-0 flex-1">
                <div className="font-pixel text-[6px] tracking-widest text-white/40">CÓDIGO</div>
                <div
                  className="font-pixel text-xl tracking-[0.18em] text-cyan-200 sm:text-2xl"
                  style={{ textShadow: "0 0 14px #22d3ee" }}
                >
                  {room.key}
                </div>
                <button className="btn-arcade mt-1 !px-2 !py-1" onClick={copyKey}>
                  {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "COPIADO" : "COPIAR"}
                </button>
                <div className="mt-1.5 flex items-center gap-1 text-[13px] text-cyan-300/70">
                  <Loader2 size={11} className="animate-spin" /> aguardando oponente…
                </div>
              </div>
              <button
                className="qr-stage w-[38%] max-w-[150px] shrink-0 cursor-zoom-in"
                onClick={() => (sfx.click(), setQrBig(true))}
                title="ampliar o QR Code"
              >
                {qr ? (
                  <img src={qr} alt="QR da partida" />
                ) : (
                  <QrCode size={44} className="text-cyan-400/60" />
                )}
                <span className="font-pixel mt-1 text-[5px] tracking-widest text-cyan-300/70">TOQUE P/ AMPLIAR</span>
              </button>
            </div>
          ) : networkBusy ? (
            <div className="flex items-center gap-3 rounded-lg border border-amber-400/40 bg-black/50 p-3">
              <span className="key-spinner shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-pixel text-[7px] tracking-widest text-amber-200">
                  EMITINDO CHAVE DIPLOMÁTICA…
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-black/60">
                  <div className="key-progress" />
                </div>
                <div className="mt-1.5 text-[13px] text-white/45">autenticando e reservando o código</div>
              </div>
            </div>
          ) : (
            <div className="font-pixel rounded-lg border border-white/10 bg-black/40 p-3 text-[7px] leading-relaxed text-white/35">
              {keyLit ? "◀ APERTE O BOTÃO DA CHAVE" : "AGUARDE O BOBBY EXPLICAR…"}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-amber-400/30 bg-amber-950/20 p-2">
          <div className="font-pixel mb-1.5 text-[6px] tracking-widest text-amber-300/70">
            PAINEL DO MARCÃO · INJETAR CÓDIGO
          </div>
          {keyInput("amber", () => joinWith(typed), "INJETAR")}
        </div>
        {err && <div className="text-[14px] leading-tight text-rose-300">{err}</div>}
      </div>
    );
  } else if (screen === "observer") {
    controls = (
      <div className="space-y-2">
        <div className="rounded-lg border border-violet-400/30 bg-violet-950/20 p-2">
          <div className="font-pixel mb-1.5 text-[6px] tracking-widest text-violet-300/70">
            CHAVE DA PARTIDA A ASSISTIR
          </div>
          {keyInput("violet", () => joinWith(typed, true), "ASSISTIR")}
        </div>
        {err && <div className="text-[14px] leading-tight text-rose-300">{err}</div>}
      </div>
    );
  } else if (screen === "info") {
    controls = (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
        <span className="font-pixel text-[6px] tracking-widest text-white/40">TRANSPORTE</span>
        {transportInfo().map((t) => (
          <span key={t.name} className="font-pixel text-[6px]" style={{ color: t.ok ? "#7ef3ff" : "#f87171" }}>
            {t.ok ? "●" : "○"} {t.name}
          </span>
        ))}
      </div>
    );
  } else {
    controls = (
      <div className="space-y-1">
        {transportInfo().map((t, i) => (
          <div
            key={t.name}
            className="font-pixel flex items-center justify-between rounded border border-white/10 bg-black/40 px-2 py-1 text-[6px]"
            style={{ animation: `fadeIn .4s ease-out ${i * 0.25}s both` }}
          >
            <span className="text-white/50">{t.name}</span>
            <span style={{ color: t.ok ? "#7ef3ff" : "#f87171" }}>{t.ok ? "OK" : "INDISPONÍVEL"}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[92] flex flex-col overflow-y-auto bg-[#04030d]">
      {qrBig && qr && room && (
        <div
          className="fade-in fixed inset-0 z-[99] flex flex-col items-center justify-center gap-4 bg-[#04030d]/97 p-5"
          onClick={() => setQrBig(false)}
        >
          <div className="font-pixel text-[9px] tracking-[0.25em] text-cyan-200">APONTE A CÂMERA DO CELULAR</div>
          <div className="qr-stage w-full max-w-[min(78vw,420px)]">
            <img src={qr} alt="QR da partida" style={{ maxWidth: "100%" }} />
          </div>
          <div
            className="font-pixel text-3xl tracking-[0.28em] text-cyan-200 sm:text-5xl"
            style={{ textShadow: "0 0 22px #22d3ee" }}
          >
            {room.key}
          </div>
          <div className="font-pixel text-[7px] tracking-widest text-white/40">TOQUE EM QUALQUER LUGAR PARA FECHAR</div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,.13),transparent_60%)]" />

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-3 px-3 py-4">
        {/* ── MONITOR ── */}
        <div className="flex items-end gap-2 sm:gap-3">
          {/* Bobby */}
          <div className="hidden shrink-0 flex-col items-center sm:flex">
            <img
              src={sprites.bobby}
              alt="Bobby"
              className={`pixelated menu-portrait w-16 md:w-20 ${msgs.length ? "bobby-talk" : "bobby-idle"}`}
              style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,.7))" }}
            />
            <span className="font-pixel mt-1 text-[5px] tracking-widest text-cyan-300">BOBBY</span>
          </div>

          <div key={tilt} className="crt-monitor crt-tilt min-w-0 flex-1">
            <div className="crt-glass h-[132px] sm:h-[150px]">
              {msgs.length > 0 ? (
                <Terminal msgs={msgs} onDone={onMsgDone} />
              ) : screen === "connecting" ? (
                <div className="term flex h-full flex-col items-center justify-center gap-2">
                  <div className="text-lg">SINCRONIZANDO{".".repeat(dots)}</div>
                  {room && (
                    <div className="text-[15px] opacity-70">
                      SALA {room.key} · {seat === "observer" ? "OBSERVADOR" : seat === "host" ? "P1" : "P2"}
                    </div>
                  )}
                </div>
              ) : (
                <WarScreen blueSprite={sprites.kingFront[1]} redSprite={sprites.kingFront[2]} />
              )}
              <span className="crt-glare" />
            </div>
            <span className="crt-led" />
          </div>

          {/* Marcão */}
          <div className="hidden shrink-0 flex-col items-center sm:flex">
            <div className="panel-metal overflow-hidden p-0.5">
              <img src={marcaoUrl} alt="Marcão" className="menu-portrait h-16 w-16 object-cover md:h-20 md:w-20" />
            </div>
            <span className="font-pixel mt-1 text-[5px] tracking-widest text-amber-300">MARCÃO</span>
          </div>
        </div>

        {/* ── PAINEL DE CONTROLES ── */}
        <div className="panel-metal relative p-3">
          <div className="hazard absolute left-3 right-3 top-[3px] h-[5px] rounded-full opacity-70" />
          {screen !== "home" && screen !== "connecting" && (
            <button className="btn-arcade absolute right-2 top-2 z-10 !px-2 !py-1" onClick={back}>
              <ArrowLeft size={11} />
            </button>
          )}
          <div className="mb-2 mt-1 text-center">
            <span className="font-pixel text-[7px] tracking-[0.22em] text-cyan-200/80 sm:text-[9px]">
              {screen === "home"
                ? "ESCOLHA UM DOS SÍMBOLOS"
                : screen === "link"
                  ? "CHAVE DIPLOMÁTICA"
                  : screen === "observer"
                    ? "MODO OBSERVADOR"
                    : screen === "info"
                      ? "INFORMAÇÕES"
                      : "ESTABELECENDO CANAL"}
            </span>
          </div>
          {controls}

          {screen === "home" && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-3 py-2">
              <label className="font-pixel shrink-0 text-[6px] tracking-widest text-white/40">SEU NOME</label>
              <input
                value={nick}
                onChange={(e) => {
                  setNickState(e.target.value.slice(0, 14));
                  saveNick(e.target.value.slice(0, 14));
                }}
                placeholder="COMANDANTE"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-cyan-200 outline-none placeholder:text-white/25"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
