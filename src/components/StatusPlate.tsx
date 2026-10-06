// ─────────────────────────────────────────────────────────────
//  PLACA DA PLATAFORMA · status da partida online
//  Faixas de perigo, nome editável, antena de sinal, semáforo
//  neon e botão de desconexão. Substitui a barrinha antiga.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { AntennaSprite, DisconnectSprite, PencilSprite, RadioSprite, SignalLight } from "./Sprites";
import { sfx } from "../game/audio";

export interface PlateProps {
  code: string;
  myName: string;
  rivalName: string;
  /** null = observador */
  mySide: 1 | 2 | null;
  connected: boolean;
  observers: number;
  /** DIRECT | RELAYED | DATABASE | RECONNECTING… */
  link: string;
  latencyMs: number | null;
  myTurn: boolean;
  clock: number;
  /** trava enquanto alguém digita */
  typingBy: string | null;
  typingKind: "nick" | "radio" | "surrender" | null;
  typingLeft: number;
  radioUsed: boolean;
  onRename: (nick: string) => void;
  onTypingStart: (kind: "nick" | "radio") => void;
  onTypingEnd: () => void;
  onRadio: () => void;
  onDisconnect: () => void;
}

export default function StatusPlate(props: PlateProps) {
  const {
    code,
    myName,
    rivalName,
    mySide,
    connected,
    observers,
    link,
    latencyMs,
    myTurn,
    clock,
    typingBy,
    typingKind,
    typingLeft,
    radioUsed,
    onRename,
    onTypingStart,
    onTypingEnd,
    onRadio,
    onDisconnect,
  } = props;

  const [editing, setEditing] = useState(false);
  const [askExit, setAskExit] = useState(false);
  const [draft, setDraft] = useState(myName);
  const inputRef = useRef<HTMLInputElement>(null);
  const isObserver = mySide === null;

  useEffect(() => {
    if (editing) {
      setDraft(myName);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // o cronômetro de digitação estourou: fecha sozinho
  useEffect(() => {
    if (editing && typingLeft <= 0) {
      setEditing(false);
      onTypingEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingLeft, editing]);

  const startEdit = () => {
    if (isObserver || typingBy) return;
    sfx.click();
    setEditing(true);
    onTypingStart("nick");
  };

  const commit = () => {
    const value = draft.trim().slice(0, 14);
    if (value && value !== myName) onRename(value);
    setEditing(false);
    onTypingEnd();
  };

  const linkColor =
    link === "DIRECT" ? "#7ef3ff" : link === "RELAYED" ? "#ffd24a" : link === "DATABASE" ? "#c4b5fd" : "#fca5a5";
  const linkLabel =
    link === "DIRECT" ? "DIRETO" : link === "RELAYED" ? "TURN" : link === "DATABASE" ? "RESERVA" : "RELIGANDO";
  const bars: 0 | 1 | 2 | 3 = link === "DIRECT" ? 3 : link === "RELAYED" ? 2 : link === "DATABASE" ? 1 : 0;

  return (
    <div className="plate mb-2">
      <span className="plate-hazard top" />
      <span className="plate-hazard bottom" />

      <div className="relative flex items-stretch gap-2 px-2 py-2 sm:gap-2.5 sm:px-2.5">
        {/* ── DESCONECTAR: ocupa as duas linhas, longe do resto ── */}
        <button className="plate-x-tall" onClick={() => setAskExit(true)} title="encerrar conexão">
          <DisconnectSprite size={22} />
        </button>

        {/* ── IDENTIDADE + CANAL (duas linhas) ── */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          {editing ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <input
                ref={inputRef}
                value={draft}
                maxLength={14}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setEditing(false);
                    onTypingEnd();
                  }
                }}
                className="min-w-0 flex-1 rounded border border-cyan-400/60 bg-black/70 px-2 py-1 text-[15px] text-cyan-100 outline-none"
              />
              <button className="btn-arcade !px-2 !py-1" onClick={commit}>
                OK
              </button>
              <span className="font-pixel text-[8px] text-amber-300">{typingLeft}s</span>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                className="plate-name group"
                onClick={startEdit}
                disabled={isObserver || !!typingBy}
                title={isObserver ? "observador não tem nome em campo" : "clique para editar seu nome"}
                style={{ color: mySide === 2 ? "#ffb3c0" : "#7ef3ff" }}
              >
                <span className="truncate">{isObserver ? "OBSERVADOR" : myName}</span>
                {!isObserver && <PencilSprite size={12} className="shrink-0 opacity-50 group-hover:opacity-100" />}
              </button>
              <span className="font-pixel shrink-0 text-[6px] text-white/30">VS</span>
              <span
                className="font-pixel min-w-0 truncate text-[7px]"
                style={{ color: mySide === 2 ? "#7ef3ff" : "#ffb3c0" }}
              >
                {rivalName}
              </span>
            </div>
          )}

          {/* linha 2: canal, código, antena, observadores */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-pixel text-[6px]" style={{ color: linkColor }}>
              {linkLabel}
            </span>
            <span className="font-pixel text-[6px] tracking-widest text-white/35">{code}</span>
            <AntennaSprite bars={bars} size={15} />
            <span className="font-pixel text-[6px] text-white/40">{connected ? "2/2" : "1/2"}</span>
            {observers > 0 && (
              <span className="font-pixel text-[6px] text-violet-300" title={`${observers} assistindo`}>
                👁{observers}
              </span>
            )}
            {latencyMs !== null && (
              <span className="font-pixel text-[6px] text-white/25">{Math.round(latencyMs)}ms</span>
            )}
          </div>
        </div>

        {/* ── ZOAR (rádio) e SEMÁFORO, do mesmo tamanho ── */}
        {!isObserver && (
          <button
            className="plate-tower"
            onClick={() => {
              if (radioUsed || typingBy) return;
              sfx.click();
              onRadio();
            }}
            disabled={radioUsed || !!typingBy}
            title={radioUsed ? "você já zoou nesta rodada" : "mandar uma zoeira pro oponente"}
          >
            <RadioSprite size={26} active={!radioUsed && !typingBy} />
            <span className="font-pixel text-[6px] tracking-widest" style={{ color: radioUsed ? "#6b6480" : "#39ff88" }}>
              ZOAR
            </span>
          </button>
        )}

        <div className="plate-tower static">
          <SignalLight state={myTurn && !isObserver ? "go" : "wait"} size={24} />
          <span
            className="font-pixel text-[6px] tracking-widest"
            style={{ color: myTurn && !isObserver ? "#39ff88" : "#ff8f8f" }}
          >
            {isObserver ? "ASSISTE" : myTurn ? "SUA VEZ" : "ESPERE"}
          </span>
          {myTurn && !isObserver && !typingBy && (
            <span
              className="font-pixel text-[7px]"
              style={{ color: clock <= 6 ? "#ff8f8f" : "#7ef3ff", textShadow: "0 0 8px currentColor" }}
            >
              {String(clock).padStart(2, "0")}s
            </span>
          )}
        </div>
      </div>

      {/* ── CONFIRMAR SAÍDA ── */}
      {askExit && (
        <div className="plate-confirm">
          <span className="font-pixel text-[7px] text-rose-200">ENCERRAR A CONEXÃO?</span>
          <button className="btn-arcade !px-2 !py-1" onClick={() => setAskExit(false)}>
            NÃO
          </button>
          <button
            className="btn-arcade btn-danger !px-2 !py-1"
            onClick={() => {
              setAskExit(false);
              onDisconnect();
            }}
          >
            SIM, SAIR
          </button>
        </div>
      )}

      {/* ── AVISO DE DIGITAÇÃO DO ADVERSÁRIO ── */}
      {typingBy && (
        <div className="typing-strip">
          <span className="typing-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="font-pixel text-[7px] tracking-widest text-amber-200">
            {typingBy}{" "}
            {typingKind === "nick"
              ? "ESTÁ MUDANDO O NOME"
              : typingKind === "surrender"
                ? "ESTÁ PENSANDO EM DESISTIR"
                : "ESTÁ ENVIANDO UM SINAL DE RÁDIO"}
          </span>
          <span className="font-pixel ml-auto text-[8px] text-amber-300">{typingLeft}s</span>
        </div>
      )}
    </div>
  );
}
