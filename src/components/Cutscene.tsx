// ─────────────────────────────────────────────────────────────
//  CUTSCENE — "CHAMADA DE EMERGÊNCIA"
//  Bobby liga para o Marcão enquanto os sprites carregam em background.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, SkipForward } from "lucide-react";
import marcaoUrl from "../assets/marcao.png";
import { sfx } from "../game/audio";

type Speaker = "bobby" | "marcao";

interface Line {
  who: Speaker;
  text: string;
}

const SCRIPT: Line[] = [
  { who: "bobby", text: "MARCÃO! NA ESCUTA?! AQUI É O BOBBY. CÓDIGO VERMELHO!" },
  { who: "marcao", text: "Bobby?! Caraca, você conseguiu... o sinal tá vindo da órbita da TERRA!" },
  { who: "bobby", text: "FUGI DO PLANETA DE SOCRAM. DERROTEI ELE. ATRAVESSEI O CINTURÃO INTEIRO." },
  { who: "marcao", text: "E o foguete aguentou o tranco. Você chegou em casa, robô véio." },
  { who: "bobby", text: "AINDA NÃO. RESTOU UMA ÚLTIMA BATALHA." },
  { who: "bobby", text: "OS REBELDES REMANESCENTES DO IMPÉRIO DE SOCRAM. ELES BLOQUEARAM A ROTA." },
  { who: "marcao", text: "Os restos da frota dele... esses aí não se rendem fácil, Bobby." },
  { who: "bobby", text: "ENTÃO É SÓ MAIS ESSA VEZ. VAMOS PROTEGER A ALIANÇA." },
  { who: "marcao", text: "Tabuleiro orbital carregado. 8x8. Sem piedade. BOA SORTE, BOBBY!" },
];

interface Props {
  onAbout: () => void;
  installed: boolean;
  bobbySrc: string | null;
  progress: number;
  progressLabel: string;
  ready: boolean;
  onDone: () => void;
}

export default function Cutscene({ onAbout, installed, bobbySrc, progress, progressLabel, ready, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const [finished, setFinished] = useState(false);
  /** trava o auto-avanço quando o jogador assume a navegação */
  const [manual, setManual] = useState(false);
  /** o botão de batalha só sobe depois da última fala */
  const [showEnter, setShowEnter] = useState(false);
  /** contagem de armamento do botão: evita clique afobado */
  const [armIn, setArmIn] = useState(0);
  const timer = useRef<number>(0);
  const line = SCRIPT[Math.min(idx, SCRIPT.length - 1)];
  const full = line.text;
  const done = shown >= full.length;
  const isLast = idx >= SCRIPT.length - 1;

  const stars = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: (i * 97) % 100,
        y: (i * 61) % 100,
        s: (i % 3) + 1,
        d: 2 + (i % 7) * 0.6,
      })),
    [],
  );

  // máquina de escrever
  useEffect(() => {
    if (done) return;
    const speed = line.who === "bobby" ? 26 : 30;
    timer.current = window.setTimeout(() => {
      setShown((s) => {
        const ns = s + 1;
        const ch = full[s];
        if (ch && ch !== " ") sfx.blip(line.who === "bobby" ? 1.25 : 0.82);
        return ns;
      });
    }, speed);
    return () => clearTimeout(timer.current);
  }, [shown, done, full, line.who]);

  // chegou na última mensagem? o cronômetro começa na hora,
  // tenha o jogador clicado em avançar ou não.
  useEffect(() => {
    if (isLast && done && !finished) setFinished(true);
  }, [isLast, done, finished]);

  // auto-avanço (só enquanto o jogador não assumir o controle)
  useEffect(() => {
    if (!done || finished || manual) return;
    if (isLast) {
      setFinished(true);
      return;
    }
    const t = window.setTimeout(() => {
      sfx.click();
      setIdx((i) => i + 1);
      setShown(0);
    }, 1600);
    return () => clearTimeout(t);
  }, [done, idx, finished, manual, isLast]);

  // terminou a última fala → 2s de respiro → o botão sobe
  useEffect(() => {
    if (!finished) return;
    setArmIn(2);
    const tick = window.setInterval(() => setArmIn((n) => Math.max(0, n - 1)), 1000);
    const t = window.setTimeout(() => {
      setShowEnter(true);
      clearInterval(tick);
    }, 2000);
    return () => {
      clearTimeout(t);
      clearInterval(tick);
    };
  }, [finished]);

  /** avança: completa o texto, ou vai pra próxima fala */
  const next = useCallback(() => {
    if (!done) {
      setShown(full.length);
      return;
    }
    if (isLast) {
      setFinished(true);
      return;
    }
    sfx.click();
    setManual(true);
    setIdx((i) => i + 1);
    setShown(0);
  }, [done, full.length, isLast]);

  /** volta pra reler a mensagem anterior */
  const prev = useCallback(() => {
    if (idx === 0) return;
    sfx.click();
    setManual(true);
    setIdx((i) => i - 1);
    setShown(SCRIPT[idx - 1].text.length); // já mostra inteira: é releitura
  }, [idx]);

  const start = useCallback(() => {
    sfx.unlock();
    sfx.click();
    onDone();
  }, [onDone]);

  // teclado: setas navegam, espaço/enter avança ou entra
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      sfx.unlock();
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (showEnter && ready) start();
        else next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, showEnter, ready, start]);

  const talking = !done;

  return (
    <div
      className="fixed inset-0 z-[95] flex flex-col overflow-hidden bg-[#04030d]"
      onClick={() => {
        sfx.unlock();
        if (!done) setShown(full.length); // clique no fundo só completa o texto
      }}
    >
      {/* estrelas */}
      <div className="pointer-events-none absolute inset-0">
        {stars.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-cyan-100"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.s,
              height: s.s,
              opacity: 0.5,
              animation: `twinkle ${s.d}s ease-in-out ${i * 0.11}s infinite`,
            }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(34,211,238,.16),transparent_60%)]" />

      {/* topo */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <div className="font-pixel flex items-center gap-2 text-[7px] tracking-[0.25em] text-cyan-300/70">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
          TRANSMISSÃO SEGURA · CANAL 07
        </div>
        <button
          className="btn-arcade"
          onClick={(e) => {
            e.stopPropagation();
            sfx.click();
            setManual(true);
            setIdx(SCRIPT.length - 1);
            setShown(SCRIPT[SCRIPT.length - 1].text.length);
            setFinished(true);
          }}
        >
          <SkipForward size={12} /> PULAR
        </button>
      </div>

      {/* palco */}
      <div className="relative z-10 flex flex-1 items-center justify-center gap-3 px-3 sm:gap-8">
        {/* BOBBY */}
        <div className={`flex flex-col items-center transition-all duration-300 ${line.who === "bobby" ? "" : "opacity-45 saturate-50"}`}>
          <div className="relative">
            {bobbySrc ? (
              <img
                src={bobbySrc}
                alt="Bobby"
                className={`pixelated w-24 sm:w-40 ${line.who === "bobby" ? "bobby-talk" : "bobby-idle"}`}
                style={{ filter: "drop-shadow(0 10px 16px rgba(0,0,0,.7)) drop-shadow(0 0 22px rgba(34,211,238,.35))" }}
              />
            ) : (
              <div className="h-24 w-24 animate-pulse rounded-full bg-indigo-900/60 sm:h-40 sm:w-40" />
            )}
            <div className="pointer-events-none absolute inset-0 opacity-30 [background:repeating-linear-gradient(0deg,transparent_0_2px,rgba(0,0,0,.6)_2px_3px)]" />
          </div>
          {/* boca analógica dot-matrix */}
          <div className="mt-2 flex h-6 w-24 items-end justify-center gap-[2px] overflow-hidden rounded border border-emerald-500/40 bg-[#04120a] px-1 shadow-[inset_0_0_10px_rgba(57,255,136,.25)] sm:w-40">
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                className="w-[3px] rounded-[1px] bg-emerald-400"
                style={{
                  height: talking && line.who === "bobby" ? undefined : "3px",
                  animation:
                    talking && line.who === "bobby"
                      ? `vu ${0.28 + (i % 5) * 0.07}s ease-in-out ${i * 0.03}s infinite alternate`
                      : "none",
                  boxShadow: "0 0 5px #39ff88",
                }}
              />
            ))}
          </div>
          <div className="font-pixel mt-2 text-[7px] tracking-widest text-cyan-300">BOBBY</div>
        </div>

        {/* MARCÃO — janela de codec */}
        <div className={`transition-all duration-300 ${line.who === "marcao" ? "" : "opacity-45 saturate-50"}`}>
          <div className="panel-metal relative overflow-hidden p-1.5">
            <div className="relative h-28 w-28 overflow-hidden rounded sm:h-44 sm:w-44">
              <img
                src={marcaoUrl}
                alt="Marcão"
                className={`h-full w-full scale-[1.16] object-cover ${line.who === "marcao" ? "codec-live" : ""}`}
              />
              <div className="pointer-events-none absolute inset-0 [background:repeating-linear-gradient(0deg,transparent_0_2px,rgba(0,0,0,.45)_2px,rgba(0,0,0,.45)_3px)]" />
              <div className="codec-sweep pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-cyan-300/15 to-transparent" />
            </div>
          </div>
          <div className="font-pixel mt-2 text-center text-[7px] tracking-widest text-amber-300">MARCÃO</div>
        </div>
      </div>

      {/* ── BOTÃO DE BATALHA: sobe entre as fotos, 3s após a última fala ── */}
      <div className="relative z-20 flex h-16 items-start justify-center px-3">
        {showEnter && ready && (
          <button
            className="btn-static font-pixel relative overflow-hidden px-6 py-3 text-[9px] sm:text-xs"
            onClick={(e) => {
              e.stopPropagation();
              start();
            }}
          >
            <span className="btn-static-noise" />
            <span className="btn-static-scan" />
            <span className="relative flex items-center gap-2">
              <Play size={13} /> ENTRAR NA BATALHA
            </span>
          </button>
        )}
        {finished && !showEnter && (
          <div className="font-pixel flex items-center gap-2 self-center text-[8px] text-cyan-300/60">
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-2 border-cyan-400/30" />
              <span className="arm-ring absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-300" />
              <span className="text-[9px] text-cyan-200">{armIn}</span>
            </span>
            PREPARANDO EMBARQUE…
          </div>
        )}
        {finished && showEnter && !ready && (
          <div className="font-pixel blink self-center text-[8px] text-cyan-300/70">SINCRONIZANDO ÓRBITA…</div>
        )}
      </div>

      {/* caixa de diálogo */}
      <div className="relative z-10 px-3 pb-4 sm:px-8">
        <div className="panel-metal relative mx-auto mt-4 max-w-3xl p-4 pt-6">
          <span
            className="font-pixel absolute -top-3 left-4 z-10 rounded-sm px-2 py-1 text-[7px] tracking-widest"
            style={{
              background: line.who === "bobby" ? "#0e7490" : "#b45309",
              color: "#fff",
              boxShadow: `0 0 12px ${line.who === "bobby" ? "#22d3ee" : "#f59e0b"}`,
            }}
          >
            {line.who === "bobby" ? "BOBBY" : "MARCÃO"}
          </span>
          <p
            className="min-h-[3.5rem] text-[17px] leading-snug sm:min-h-[4rem] sm:text-2xl"
            style={{
              color: line.who === "bobby" ? "#a5f3fc" : "#fde9c8",
              textShadow: `0 0 12px ${line.who === "bobby" ? "rgba(34,211,238,.4)" : "rgba(245,158,11,.35)"}`,
            }}
          >
            {full.slice(0, shown)}
            {!done && <span className="ml-[1px] inline-block h-4 w-2 translate-y-[2px] bg-current" />}
          </p>
          {/* navegação: dá pra voltar e reler se distraiu */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              className="btn-arcade disabled:cursor-not-allowed disabled:opacity-30"
              disabled={idx === 0}
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              title="reler a mensagem anterior"
            >
              <ChevronLeft size={12} />
              <span className="hidden sm:inline">VOLTAR</span>
            </button>

            <div className="flex flex-1 items-center justify-center gap-1">
              {SCRIPT.map((_, i) => (
                <button
                  key={i}
                  aria-label={`mensagem ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    sfx.click();
                    setManual(true);
                    setIdx(i);
                    setShown(i < idx ? SCRIPT[i].text.length : 0);
                  }}
                  className="h-2 w-4 rounded-full transition-all hover:scale-125"
                  style={{
                    background: i === idx ? "#7ef3ff" : i < idx ? "#0e7490" : "rgba(255,255,255,.15)",
                    boxShadow: i === idx ? "0 0 8px #22d3ee" : undefined,
                  }}
                />
              ))}
            </div>

            <button
              className="btn-arcade"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              title={done ? "próxima mensagem" : "completar texto"}
            >
              <span className="hidden sm:inline">{isLast && done ? "FIM" : "AVANÇAR"}</span>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* carregamento real dos sprites */}
        {!ready && (
          <div className="mx-auto mt-3 max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full border border-white/10 bg-black/60">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-300"
                  style={{ width: `${Math.max(6, progress)}%`, boxShadow: "0 0 12px #22d3ee" }}
                />
              </div>
              <span className="font-pixel w-40 shrink-0 text-right text-[7px] text-cyan-300/70">
                {progressLabel} {progress}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* rodapé: assinatura + instalação, ABAIXO do chat */}
      <button
        className="intro-footer"
        onClick={(e) => {
          e.stopPropagation();
          sfx.click();
          onAbout();
        }}
      >
        <span className="intro-footer-name">Marcos Eduardo</span>
        <span className="intro-footer-sep">·</span>
        <span>Portfólio · Damas Orbitais</span>
        <span className="intro-footer-sep">—</span>
        <span className="intro-footer-link">About</span>
        <span className="intro-footer-sep">·</span>
        <b>{installed ? "Instalado" : "Instalar no seu celular"}</b>
      </button>

    </div>
  );
}
