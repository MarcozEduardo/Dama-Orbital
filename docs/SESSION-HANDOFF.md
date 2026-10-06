# Handoff da sessão: Damas Orbitais

## Leia isto antes de continuar o projeto

Este documento registra o estado real do projeto ao fim da sessão longa de criação. Ele existe para a próxima sessão continuar sem reconstruir decisões já tomadas.

---

## Resumo do produto

`Damas Orbitais` é um spin-off multiplayer de *A Viagem de Bobby*. O jogo usa regras de damas brasileiras e transforma cada captura em uma ação militar arcade.

O projeto é React 19 + Vite + Tailwind CSS v4 e gera um HTML único com `vite-plugin-singlefile`.

---

## O que está funcional

### Regras

- tabuleiro 8x8;
- captura obrigatória;
- peão captura nas quatro diagonais;
- combo automático quando existe uma única continuação;
- escolha manual quando há mais de uma continuação;
- dama voadora;
- promoção;
- vitória por aniquilação ou ausência de movimentos.

### Visual e efeitos

- sprites pixel art de frente e costas;
- chroma-key em runtime;
- fallback procedural;
- cache dos sprites em IndexedDB;
- tabuleiro procedural;
- plataforma que gira inteira;
- perspectiva por jogador;
- wobble;
- turbinas;
- mira numerada;
- scanner;
- mísseis teleguiados;
- dama dispara quatro mísseis por alvo;
- derretimento;
- peças capturadas voam para a bancada;
- marcas de guerra envelhecendo;
- estrela de veterana;
- rendição com bandeiras, sirene e execução;
- jogador encurralado é executado sem bandeira.

### Narrativa

- cutscene Bobby e Marcão;
- mensagens navegáveis;
- botão de batalha armado dois segundos depois da última fala;
- menu diegético com monitor CRT;
- informações em formato de chat;
- transformação holográfica da dama.

### Inteligência

- `src/game/ai.ts` possui minimax com poda alfa-beta;
- `chooseMove()` atende o modo máquina;
- `analyzeRisk()` atende o observador silencioso;
- três ou mais peças nunca recebem sugestão automática de rendição;
- chance de dama e dama viva vetam rendição;
- testes chegaram a zero falsos positivos na amostra final de 7.859 lances.

### Multiplayer de interface

- menu Padrão / 2 Dispositivos / Observador / Informações;
- chave visual de seis caracteres;
- QR Code;
- regra visual de P1, P2 e observador;
- nickname editável;
- rádio e filtro client-side;
- relógio visual de 30 segundos;
- protótipo de sala em `localStorage`.

---

## O que NÃO está funcional entre aparelhos

O arquivo `src/game/net.ts` ainda usa:

- `localStorage`;
- `BroadcastChannel`;
- evento `storage`;
- polling local de 400 ms.

Isso conecta abas do mesmo navegador, não celular e desktop pela internet.

A próxima tarefa principal é substituir essa implementação pela arquitetura descrita em `docs/MULTIPLAYER-HANDOFF.md`.

---

## Decisão de rede aprovada para a próxima sessão

### Primário

- WebRTC DataChannel via Trystero;
- Firebase como signaling.

### Verdade e fallback quente

- Firebase Realtime Database Spark;
- sala, assentos, presença, eventos, último estado e deadline;
- se WebRTC falhar, o jogo continua pela RTDB.

### Fallback local

- IndexedDB outbox;
- reenviar evento após reconexão;
- RTDB vence em conflito de hash/seq.

### Rede restritiva

- Cloudflare Realtime TURN com credencial temporária;
- Worker protege o segredo;
- se TURN falhar, RTDB continua mantendo a partida.

---

## Ordem da próxima sessão

1. Não mexer nos efeitos visuais.
2. Criar a interface `MatchTransport`.
3. Mover o transporte local atual para `LocalTransport`.
4. Configurar Firebase Auth anônimo e RTDB.
5. Fazer dois aparelhos jogarem usando somente RTDB.
6. Implementar assento P2 por transação.
7. Implementar observador via RTDB.
8. Tornar o relógio autoritativo com `serverTimeOffset`.
9. Implementar presença e grace period.
10. Adicionar Trystero por cima como caminho rápido.
11. Adicionar deduplicação e ACK.
12. Adicionar TURN apenas depois de o fallback RTDB estar comprovado.

---

## Não quebrar estas decisões

- Em Padrão, a plataforma gira a cada turno.
- Em dois aparelhos, cada jogador vê seu lado fixo; o tabuleiro não gira.
- No observador, o tabuleiro acompanha o turno.
- O QR injeta a chave automaticamente.
- O primeiro UID é P1, o segundo é P2 e os demais são observadores.
- Se só existe host e alguém escolhe observar, essa pessoa vira P2.
- O rádio aparece sobre a última peça viva movimentada.
- O relógio online é de 30 segundos.
- Míssil e explosão não trafegam; apenas o evento lógico trafega.
- Dama continua disparando quatro mísseis por alvo.
- Na rendição, cada peça vencedora dispara três mísseis.
- Nenhuma sugestão automática de rendição com três ou mais peças.
- O modo IA continua escondido até uma vitória da Aliança Bobby.

---

## Dívidas técnicas conhecidas

### `App.tsx` está grande

O arquivo concentra orquestração de jogo, efeitos, rede, relógio, IA e overlays. Antes de adicionar Firebase, extrair:

- `useMatchController`;
- `useBattleSequence`;
- `useTurnClock`;
- `useOnlineRoom`;
- `useRadio`.

Não fazer essa refatoração junto com mudanças visuais. Primeiro preservar comportamento com testes.

### Autoridade online ainda é client-side

O código atual aceita o estado recebido e valida localmente. Para o MVP de portfólio, RTDB com transação resolve ordem. Para antitrapaça real, mover `engine.ts` para uma função/Worker.

### Identidade local é fraca

`deviceId()` em `localStorage` serve para UX, mas pode ser alterado. Firebase anonymous UID deve virar a identidade real.

### Relógio é local

O timeout atual roda em `setInterval`. Migrar para `deadlineAt` de servidor e transação de timeout.

### Expiração não existe

Salas locais atuais não expiram. Adicionar `expiresAt` no backend.

### Documentação antiga no README

O README principal cresceu durante a implementação e possui trechos históricos. Para decisão de rede, este handoff e `MULTIPLAYER-HANDOFF.md` têm precedência.

---

## Arquivos principais

| Arquivo | Responsabilidade |
|---|---|
| `src/App.tsx` | orquestra fases, turno, animações, IA e protótipo online |
| `src/game/engine.ts` | regras puras do jogo |
| `src/game/ai.ts` | minimax e análise de risco |
| `src/game/net.ts` | transporte local provisório |
| `src/game/audio.ts` | mixer e synth Web Audio |
| `src/game/sprites.ts` | chroma-key, cache e sprites procedurais |
| `src/components/Board.tsx` | tabuleiro, peças, bandeiras, mira e rádio |
| `src/components/MissileLayer.tsx` | partículas, mísseis e explosões |
| `src/components/Cutscene.tsx` | abertura Bobby/Marcão |
| `src/components/MainMenu.tsx` | painel de modos, chave e QR |
| `src/components/RadioBox.tsx` | rádio e filtro |
| `src/components/WarScreen.tsx` | monitor CRT animado do menu |
| `README.md` | visão geral e histórico do projeto |

---

## Assets e build

Os assets podem aparecer restaurados como PNG bruto dependendo do ambiente de sandbox. O código mantém
URLs públicas de fallback para os sprites base, portanto o build continua funcional mesmo nesse estado.
Existe um script permanente para gerar a versão otimizada:

```bash
npm install --no-save sharp
node scripts/optimize-assets.cjs
```

Ele converte os arquivos para `.jpg` e reduz aproximadamente 25 MB para 427 KB. Depois de executá-lo,
alinhar os imports/URLs à versão otimizada antes do deploy final.

Depois:

```bash
npm run build
```

O build deve gerar `dist/index.html` único.

---

## Testes que precisam permanecer

- captura em `[1, 1]`;
- combo duplo e triplo;
- dama voadora;
- captura obrigatória;
- simulação de partidas completas;
- IA x aleatório;
- IA x IA;
- falsos positivos de rendição;
- filtro do rádio preservando `kkkkkk`;
- chave sem caracteres ambíguos;
- round-trip do tabuleiro de 64 chars;
- corrida de dois convidados pela cadeira P2;
- duplicação do mesmo evento por P2P e RTDB;
- reconexão no meio do turno;
- timeout com dois clientes tentando confirmar.

---

## Documentos de continuidade

- `docs/CASE-STUDY-ORQUESTRACAO.md`: história da criação e método de Marcos Eduardo.
- `docs/MULTIPLAYER-HANDOFF.md`: arquitetura de conexão e plano de implementação.
- `docs/SESSION-HANDOFF.md`: este resumo operacional.

---

## Última orientação

O próximo passo não é adicionar mais espetáculo. O espetáculo já está forte.

O próximo passo é fazer duas pessoas, em redes diferentes, abrirem a mesma Chave Diplomática e terminarem uma partida sem perceber qual canal carregou os eventos.

Quando isso funcionar, o multiplayer estará à altura da primeira daminha que virou uma unidade de guerra.
