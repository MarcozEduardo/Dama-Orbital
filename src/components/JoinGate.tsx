// ─────────────────────────────────────────────────────────────
//  JANELA DO QR · exclusiva de quem chega com chave
//
//  Sem intro, sem menu. O código já veio injetado no link.
//  A conexão sobe em segundo plano; a luz fica verde quando o
//  canal está pronto. A partida inteira depende do OK.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AntennaSprite } from "./Sprites";
import { sfx } from "../game/audio";

interface Props {
  code: string;
  defaultNick: string;
  /** verde = canal pronto, pode dar OK */
  ready: boolean;
  error: string | null;
  busy: boolean;
  onConfirm: (nick: string) => void;
  onCancel: () => void;
}

export default function JoinGate({ code, defaultNick, ready, error, busy, onConfirm, onCancel }: Props) {
  const [nick, setNick] = useState(defaultNick);
  const [dots, setDots] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 380);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => clearInterval(t);
  }, []);

  const confirm = () => {
    if (firedRef.current || !ready || busy) return;
    firedRef.current = true;
    sfx.click();
    onConfirm(nick.trim().slice(0, 14) || defaultNick);
  };

  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center overflow-y-auto bg-[#03020a] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(57,255,136,.1),transparent_60%)]" />

      <div className="rise-in panel-metal relative w-full max-w-sm p-5">
        <div className="hazard absolute left-4 right-4 top-[3px] h-[6px] rounded-full opacity-70" />

        {/* luz de conexão */}
        <div className="mb-4 mt-2 flex items-center justify-center gap-2.5">
          {error ? (
            <XCircle size={22} className="text-rose-400" />
          ) : ready ? (
            <CheckCircle2 size={22} className="text-emerald-400" />
          ) : (
            <AntennaSprite bars={1} size={24} />
          )}
          <span
            className="font-pixel text-[8px] tracking-[0.18em]"
            style={{
              color: error ? "#fca5a5" : ready ? "#39ff88" : "#7ef3ff",
              textShadow: `0 0 10px ${error ? "rgba(255,60,60,.6)" : ready ? "rgba(57,255,136,.6)" : "rgba(34,211,238,.6)"}`,
            }}
          >
            {error ? "FALHA NO CANAL" : ready ? "CONECTADO" : `CONECTANDO${".".repeat(dots)}`}
          </span>
        </div>

        <div className="mb-4 rounded-lg border border-cyan-400/30 bg-black/50 py-3 text-center">
          <div className="font-pixel text-[6px] tracking-widest text-white/40">CÓDIGO ADICIONADO</div>
          <div
            className="font-pixel mt-1 text-2xl tracking-[0.25em] text-cyan-200"
            style={{ textShadow: "0 0 16px #22d3ee" }}
          >
            {code}
          </div>
        </div>

        {error ? (
          <div className="mb-3 rounded border border-rose-400/50 bg-rose-950/30 p-3 text-[14px] leading-tight text-rose-200">
            {error}
          </div>
        ) : (
          <>
            <label className="font-pixel mb-1.5 block text-[6px] tracking-widest text-white/40">
              DIGITE SEU NOME
            </label>
            <input
              ref={inputRef}
              value={nick}
              maxLength={14}
              onChange={(e) => setNick(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirm()}
              placeholder="COMANDANTE"
              className="mb-4 w-full rounded border border-cyan-400/40 bg-black/60 px-3 py-2.5 text-[16px] text-cyan-100 outline-none focus:border-cyan-300"
            />
          </>
        )}

        {error ? (
          <button className="btn-arcade w-full justify-center py-3" onClick={onCancel}>
            VOLTAR
          </button>
        ) : (
          <button
            className="btn-install w-full justify-center py-3"
            onClick={confirm}
            disabled={!ready || busy}
          >
            {busy ? (
              <>
                <Loader2 size={13} className="animate-spin" /> ENTRANDO…
              </>
            ) : (
              <>
                <CheckCircle2 size={13} /> OK · ENTRAR NA BATALHA
              </>
            )}
          </button>
        )}

        {!ready && !error && (
          <div className="mt-3 text-center text-[13px] text-white/40">
            sincronizando enquanto você digita…
          </div>
        )}
      </div>
    </div>
  );
}
