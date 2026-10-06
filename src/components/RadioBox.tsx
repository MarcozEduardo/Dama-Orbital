// ─────────────────────────────────────────────────────────────
//  RÁDIO — mensagens curtas entre os oponentes.
//  O balão aparece em holograma sobre a última peça movida.
//  Filtro server-side-ready: frases prontas + texto livre com
//  bloqueio de palavrão, spam e repetição — poupando o "kkkk".
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Radio, Send, X } from "lucide-react";
import { sfx } from "../game/audio";

export const QUICK_PHRASES = [
  "Se lascou! kkkkk",
  "Boa jogada!",
  "Vou te pegar",
  "kkkkkkk",
  "Tá osso...",
  "Bora, tô esperando",
  "Essa doeu",
  "Sem chance!",
];

const BAD = [
  "merd",
  "porra",
  "caral",
  "buce",
  "fdp",
  "puta",
  "viad",
  "cuzao",
  "cuzão",
  "arrombad",
  "desgraç",
  "otari",
  "babaca",
  "idiot",
  "burro",
  "imbecil",
];

/** normaliza leetspeak pra pegar disfarce (p0rr@ → porra) */
function deLeet(s: string) {
  return s
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-zà-ú\s]/g, "");
}

export interface FilterResult {
  ok: boolean;
  text: string;
  reason?: string;
}

/** Mesmas regras que rodarão na Cloud Function. */
export function filterMessage(raw: string): FilterResult {
  const text = raw.trim().slice(0, 40);
  if (!text) return { ok: false, text: "", reason: "Escreve alguma coisa!" };
  if (text.length < 2) return { ok: false, text, reason: "Curto demais." };

  const flat = deLeet(text);
  for (const b of BAD) {
    if (flat.includes(b)) return { ok: false, text, reason: "Sem baixaria no rádio, comandante!" };
  }

  // repetição de caractere — MAS o kkkkk é patrimônio cultural.
  // "hahaha" também vale (precisa ter h E a, senão "aaaaaa" passaria).
  const rep = /(.)\1{4,}/.exec(text);
  const isKkk = /^[kK]+$/.test(rep?.[0] ?? "");
  const isHaha = /^(?=.*[hH])(?=.*[aA])[haHA]+$/.test(text.trim());
  if (rep && !isKkk && !isHaha) {
    return { ok: false, text, reason: "Menos tecla presa, hein!" };
  }

  // muito dígito ou pouca vogal = provável spam/link disfarçado
  const digits = (text.match(/\d/g) || []).length;
  if (digits > 6) return { ok: false, text, reason: "Isso parece um código, não uma mensagem." };
  const letters = flat.replace(/\s/g, "");
  const vowels = (letters.match(/[aeiouà-ú]/g) || []).length;
  const isLaugh = /^[k\s]+$/i.test(text) || /^[ha\s]+$/i.test(text);
  if (letters.length >= 6 && vowels / letters.length < 0.18 && !isLaugh) {
    return { ok: false, text, reason: "Não entendi nada disso aí!" };
  }
  if (/https?:|www\.|\.com|\.br/i.test(text)) return { ok: false, text, reason: "Nada de links." };

  return { ok: true, text };
}

interface Props {
  disabled: boolean;
  cooldownMs: number;
  onSend: (text: string) => void;
}

export default function RadioBox({ disabled, cooldownMs, onSend }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(true);
  const timerRef = useRef<number>(0);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const fire = (raw: string) => {
    const res = filterMessage(raw);
    if (!res.ok) {
      setErr(res.reason!);
      sfx.denied();
      return;
    }
    onSend(res.text);
    sfx.holo();
    setText("");
    setErr(null);
    setOpen(false);
    setReady(false);
    timerRef.current = window.setTimeout(() => setReady(true), cooldownMs);
  };

  return (
    <>
      <button
        className="btn-arcade relative"
        disabled={disabled || !ready}
        onClick={() => {
          sfx.click();
          setOpen((v) => !v);
          setErr(null);
        }}
        title={disabled ? "só quem joga usa o rádio" : ready ? "abrir o rádio" : "recarregando…"}
        style={{ opacity: disabled ? 0.35 : 1 }}
      >
        <Radio size={13} className={ready && !disabled ? "" : "opacity-40"} />
        <span className="hidden sm:inline">RÁDIO</span>
        {!ready && (
          <span
            className="absolute bottom-0 left-0 h-[3px] rounded-full bg-cyan-400"
            style={{ animation: `radioCool ${cooldownMs}ms linear both` }}
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[75] mt-2 w-72 rounded-lg border-2 border-cyan-400/50 bg-[#0a1424]/97 p-3 shadow-[0_10px_30px_rgba(0,0,0,.7)]">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-pixel text-[7px] tracking-widest text-cyan-300">RÁDIO DE COMBATE</span>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white">
              <X size={13} />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-1.5">
            {QUICK_PHRASES.map((p) => (
              <button
                key={p}
                onClick={() => fire(p)}
                className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-left text-[13px] text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-400/10"
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <input
              value={text}
              maxLength={40}
              onChange={(e) => (setText(e.target.value), setErr(null))}
              onKeyDown={(e) => e.key === "Enter" && fire(text)}
              placeholder="ou escreva (40 caracteres)"
              className="min-w-0 flex-1 rounded border border-white/15 bg-black/60 px-2 py-1.5 text-[14px] text-cyan-100 outline-none focus:border-cyan-400"
            />
            <button className="btn-arcade !px-2 !py-1" onClick={() => fire(text)}>
              <Send size={12} />
            </button>
          </div>
          {err && <div className="mt-1.5 text-[13px] text-rose-300">{err}</div>}
        </div>
      )}
    </>
  );
}
