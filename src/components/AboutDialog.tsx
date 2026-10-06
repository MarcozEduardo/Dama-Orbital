// ─────────────────────────────────────────────────────────────
//  SOBRE O PROJETO + INSTALAÇÃO (PWA)
//  Texto legível, foto do Marcão, cabeça do Bobby e o botão
//  verde que instala o jogo como aplicativo.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Check, Download, X } from "lucide-react";
import marcaoUrl from "../assets/marcao.png";
import { sfx } from "../game/audio";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/** Captura o evento antes de qualquer render para não perder a janela. */
export function watchInstallPrompt(onChange: (available: boolean) => void) {
  const onPrompt = (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    onChange(true);
  };
  const onInstalled = () => {
    deferredPrompt = null;
    onChange(false);
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export default function AboutDialog({ bobbySrc, onClose }: { bobbySrc: string | null; onClose: () => void }) {
  const [installed, setInstalled] = useState(isStandalone());
  const [, setCanInstall] = useState(Boolean(deferredPrompt));

  useEffect(() => watchInstallPrompt(setCanInstall), []);

  const [manual, setManual] = useState(false);

  const install = async () => {
    sfx.click();
    // sem prompt disponível (iOS, Firefox, aba não elegível): ensina o caminho
    if (!deferredPrompt) {
      setManual(true);
      return;
    }
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        deferredPrompt = null;
      } else {
        setManual(true);
      }
    } catch {
      setManual(true);
    }
  };

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 z-[97] flex items-center justify-center overflow-y-auto bg-black/80 p-4">
      <div className="rise-in panel-metal relative w-full max-w-lg p-5">
        <div className="hazard absolute left-4 right-4 top-[3px] h-[6px] rounded-full opacity-70" />
        <button className="btn-arcade absolute right-3 top-3 !px-2 !py-1" onClick={onClose}>
          <X size={12} />
        </button>

        <div className="mb-4 mt-2 flex items-center justify-center gap-3">
          {bobbySrc && <img src={bobbySrc} alt="Bobby" className="pixelated w-16 sm:w-20" />}
          <div className="panel-metal overflow-hidden p-0.5">
            <img src={marcaoUrl} alt="Marcos Eduardo" className="h-16 w-16 object-cover sm:h-20 sm:w-20" />
          </div>
        </div>

        <div className="chrome-text font-pixel mb-1 text-center text-[11px] sm:text-sm">DAMAS ORBITAIS</div>
        <div className="font-pixel mb-4 text-center text-[6px] tracking-[0.25em] text-amber-300/80">
          A VIAGEM DE BOBBY · SPIN-OFF
        </div>

        <div className="space-y-3 text-[16px] leading-snug text-white/80 sm:text-[17px]">
          <p>
            Damas brasileiras jogadas numa plataforma em órbita da Terra. Cada captura vira uma operação
            militar: a mira crava no alvo, o scanner varre o tabuleiro e os mísseis teleguiados saem da
            peça vencedora.
          </p>
          <p>
            O tabuleiro <span className="text-cyan-300">gira de verdade</span> e troca a perspectiva de
            quem está jogando. A dama vira uma blindada pesada que dispara quatro mísseis por alvo. As
            marcas de queimado envelhecem no piso durante a partida inteira.
          </p>
          <p>
            Dá para jogar em dois no mesmo aparelho, contra a máquina, ou em{" "}
            <span className="text-amber-300">dois dispositivos</span> usando a Chave Diplomática e o QR
            Code. Quem chega depois entra como observador.
          </p>
          <p className="text-white/60">
            Todos os sprites, o áudio e os efeitos foram construídos sob direção criativa e testes
            manuais — cada bug encontrado jogando virou uma mecânica nova.
          </p>
        </div>

        <div className="mt-5 flex flex-col items-center gap-2">
          {installed ? (
            <div className="btn-arcade pointer-events-none justify-center !border-emerald-500/60 !text-emerald-300">
              <Check size={13} /> INSTALADO
            </div>
          ) : (
            <button className="btn-install w-full justify-center py-3" onClick={() => void install()}>
              <Download size={14} /> INSTALAR APLICATIVO
            </button>
          )}

          {manual && !installed && (
            <div className="mt-1 w-full rounded-lg border border-cyan-400/40 bg-black/50 p-3 text-left">
              <div className="font-pixel mb-2 text-[7px] tracking-widest text-cyan-300">
                INSTALAÇÃO MANUAL
              </div>
              {isIOS ? (
                <ol className="space-y-1.5 text-[15px] leading-snug text-white/75">
                  <li>1. Toque no botão <b className="text-cyan-300">Compartilhar</b> (quadrado com seta).</li>
                  <li>2. Role e escolha <b className="text-cyan-300">Adicionar à Tela de Início</b>.</li>
                  <li>3. Confirme em <b className="text-cyan-300">Adicionar</b>.</li>
                </ol>
              ) : (
                <ol className="space-y-1.5 text-[15px] leading-snug text-white/75">
                  <li>1. Abra o menu do navegador (<b className="text-cyan-300">⋮</b> no canto).</li>
                  <li>2. Toque em <b className="text-cyan-300">Instalar aplicativo</b> ou <b className="text-cyan-300">Adicionar à tela inicial</b>.</li>
                  <li>3. Confirme em <b className="text-cyan-300">Instalar</b>.</li>
                </ol>
              )}
              <div className="mt-2 text-[13px] text-white/40">
                O jogo abre em janela própria, com ícone da Dama Azul.
              </div>
            </div>
          )}
        </div>

        <div className="font-pixel mt-4 text-center text-[7px] leading-relaxed text-white/45">
          QA ENGINEER &lt;/&gt; MARCOS EDUARDO
          <br />
          <span className="text-cyan-300/60">COM BOBBY AI</span>
        </div>
      </div>
    </div>
  );
}
