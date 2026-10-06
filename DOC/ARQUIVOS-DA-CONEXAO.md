# Mapa dos arquivos de conexão

Para passar a outra IA sem precisar reler o projeto inteiro.

---

## Os 5 arquivos que importam

### 1. `src/game/network/firebase.ts` — **o mais importante**

Tudo que fala com o Firebase Realtime Database.

| Função | O que faz |
|---|---|
| `createRemoteMatch` | cria sala, reserva a chave por transação |
| `joinRemoteMatch` | injeta código, ocupa P2 por transação ou vira observador |
| `subscribeRemoteMatch` | escuta o documento inteiro da partida |
| `commitRemoteState` | grava um lance (transação exige turno correto) |
| `declareRemoteSurrender` | rendição **fora** da transação de turno |
| `declareRemoteWinner` | encerra por saída/abandono |
| `commitRemoteTimeout` | qualquer jogador confirma timeout por transação |
| `probeRemoteMatch` | valida QR/Auth/sala antes do OK sem ocupar P2 |
| `pushLiveSignal` / `subscribeLiveSignals` | **canal leve** de seleção e rotas |
| `pushRemoteTyping` | aviso de 15s (nome/rádio/desistir) |
| `beatRemotePresence` / `subscribeRemoteHeartbeat` | prova de vida |
| `subscribeRemotePresence` | quem está conectado |
| `sendRemoteRadio` / `subscribeRemoteRadio` | rádio |

**Regra de ouro deste arquivo:** existem dois tipos de dado.

```
matches/{id}/state   → ESTADO VERSIONADO (tem seq, precisa de guard)
live/{id}/{uid}      → SINAL EFÊMERO (sem seq, nunca pode ter guard)
matches/{id}/typing  → SINAL EFÊMERO
```

### 2. `src/App.tsx` — orquestração

Blocos relevantes, buscáveis por comentário:

```
// ── SINCRONIA ONLINE ──              ← listener principal, DUAS TRILHAS
// ── CANAL AO VIVO ──                 ← seleção/rotas do rival
// ── SENSORES DE SAÍDA EM CASCATA ──  ← A a E
// ── FISCALIZADOR DE SINCRONIA ──     ← compara hash local x servidor
// ── MINHA CONEXÃO CAIU? ──
// ── CRONÔMETRO DO LANCE (online) ──
// ── INATIVIDADE
const runMove = useCallback(          ← tem o modo `replay`
const executeSurrender = useCallback( ← tem o modo `remote`
```

**A armadilha número 1 deste arquivo:**

```js
if (s.seq <= seqSyncRef.current) return;
```

Tudo que for colocado **depois** dessa linha só roda quando há lance novo. Seleção, rendição,
digitação e qualquer sinal precisam ficar **antes**.

### 3. `database.rules.json` — precisa ser republicado a cada campo novo

Nós existentes: `keys`, `matches` (com `state`, `events`, `radio`, `typing`, `observers`,
`players`), `live`, `presence`, `presenceMeta`, `__trystero_damas_orbitais__`.

Se um campo não estiver liberado, a escrita é **recusada em silêncio** — não aparece erro na tela.
Esse foi o motivo de vários "não funciona" durante o desenvolvimento.

### 4. `src/config/firebase.ts` — sessão

Auth anônimo, persistência, App Check opcional, emuladores. Nada de multiplayer aqui.

### 5. `src/components/StatusPlate.tsx` — a placa

Nome editável, antena, semáforo, ZOAR, botão de sair, faixa de digitação.

---

## Arquivos de apoio

| Arquivo | Papel |
|---|---|
| `src/game/network/types.ts` | contratos: `MatchEvent`, `MatchStateSnapshot`, `RemoteMatch` |
| `src/game/network/resilient.ts` | combina WebRTC + RTDB, deduplica |
| `src/game/network/trystero.ts` | WebRTC/DataChannel + TURN |
| `src/game/network/outbox.ts` | fila IndexedDB |
| `src/game/network/hash.ts` | hash de estado (usado pelo fiscalizador) |
| `src/game/net.ts` | protótipo local + reexporta a camada nova |
| `src/components/JoinGate.tsx` | portão do QR |
| `src/components/GhostRoute.tsx` | rota tracejada |
| `src/components/Board.tsx` | tabuleiro; recebe `ghost`, `rivalPick`, `rivalMoves` |

---

## Bugs recorrentes e onde nascem

| Sintoma | Causa provável | Arquivo |
|---|---|---|
| Evento não chega no rival | ficou depois do guard de `seq` | `App.tsx` |
| Escrita ignorada sem erro | campo não liberado nas regras | `database.rules.json` |
| Rota espelhada | camada fora do `spin-layer` | `Board.tsx` |
| Replay não roda | `busy`/`spinning`/`seqRef` sujos | `App.tsx` |
| Rendição recusada | passou por transação que exige turno | `firebase.ts` |
| Queda com tela apagada | `pagehide` sem checar `persisted` | `App.tsx` |

### Proibição importante

Não usar `onDisconnect` para gravar vencedor. Ele dispara também durante suspensão e troca de rede no
celular. Use-o apenas para remover presença; abandono exige cinco minutos sem heartbeat.

---

## Coisas que **não** devem ser feitas

- não colocar sinal efêmero dentro de `state`;
- não usar `beforeunload` para declarar derrota (não é confiável);
- não recalcular as rotas do rival localmente sem fallback (os estados podem divergir);
- não deixar observador entrar na malha WebRTC;
- não confiar em `deviceId` para segurança (use o `uid` anônimo);
- não publicar regras abertas.

---

## Estado atual, honesto

**Funciona:** criar sala, QR, entrar, jogar, sincronizar, rádio, rendição, observador, presença,
reconexão, PWA.

**Não implementado:** validação autoritativa em Cloud Functions (hoje o cliente decide e a RTDB
apenas ordena), TURN em produção, e conexão Bluetooth/LAN direta — WebRTC já cobre a mesma rede
quando o P2P fecha, mas Bluetooth puro não existe em navegador.
