# Handoff do motor · Damas Orbitais

## Depoimento do que foi feito para funcionar

Este documento conta como o multiplayer chegou ao estado atual — não como deveria ter sido, mas como
realmente aconteceu, incluindo os erros. Se outra IA for continuar daqui, ler isto evita repetir os
mesmos tropeços.

---

## O motor em uma frase

**O jogo é o mesmo em todas as telas. Só o ponto de vista muda.**

Nada é transmitido em vídeo. Cada cliente roda a mesma engine e os mesmos efeitos localmente. A rede
só carrega decisões — o resto é reconstrução.

---

## A arquitetura que funcionou

Dois canais, com fronteira explícita. Nem um, nem quatro:

```
┌─────────────────────────────────────────────────────┐
│  CANAL DE SINAL (instantâneo, sem sequência)        │
│  matches/{id}/pulse/{uid}                           │
│                                                     │
│  o que o jogador está FAZENDO AGORA                 │
│  · peça selecionada + rotas visíveis                │
│  · aviso de digitação (nome, rádio, bandeira)       │
│  · bandeira branca caindo                           │
│  · mensagem de rádio                                │
│  · aviso de saída                                   │
└─────────────────────────────────────────────────────┘
                        ↓ 1 listener
┌─────────────────────────────────────────────────────┐
│  CANAL DE ESTADO (versionado, com transação)         │
│  matches/{id}/state                                  │
│                                                     │
│  o que o jogador DECIDIU                            │
│  · tabuleiro em 64 chars                            │
│  · turno e sequência                                │
│  · vencedor                                         │
└─────────────────────────────────────────────────────┘
```

### Por que dois e não um

Tentamos um canal só. Resultado: o sinal herdou a lentidão do estado, porque o estado tem guarda de
sequência e o sinal não pode ter.

Tentamos quatro caminhos. Resultado: seleção num lugar, rádio noutro, digitação noutro — e cada um
com uma velocidade diferente.

**Dois é o número certo:** a fronteira é a pergunta *"isto precisa de ordem?"*

| Precisa de ordem? | Canal |
|---|---|
| Sim (lance, vencedor) | estado + transação |
| Não (seleção, aviso, bandeira) | pulso |

---

## As três regras de ouro

### 1. Anunciar antes de animar

Toda ação publica primeiro, anima depois. Se publicar no fim, o adversário só vê quando já acabou —
foi o bug mais demorado para perceber, apareceu três vezes:

```
ERRADO:  anima (6s) → publica → adversário começa a ver
CERTO:   publica → os dois animam juntos
```

### 2. Sinal não passa por guarda de sequência

```js
// ISTO MATA SINAIS:
if (s.seq <= seqSyncRef.current) return;   // ← seleção nunca passa

// CERTO: dois blocos separados
// TRILHA 1 · sinais (sempre rodam)
// TRILHA 2 · lance (só quando seq avança)
```

### 3. Espelhar, não recalcular

As rotas que o adversário vê são as mesmas que quem selecionou enviou. Recalcular localmente pode
divergir se os tabuleiros estiverem dessincronizados.

---

## O protocolo de rendição (o caso mais delicado)

Rendição é a única ação com **duas publicações**:

| Etapa | Grava | Por quê |
|---|---|---|
| 1 · clique em SIM | só `surrendered` | bandeira sobe nos dois, sem veredito |
| — | *animação inteira* | sirene, miras, 18 mísseis, derretimento |
| 2 · fim da barragem | `winner` + tabuleiro | agora sim, tela final |

Se as duas fossem juntas, o `winner` chegaria antes da animação e os dois veriam *"VOCÊ VENCEU /
VOCÊ FOI DERROTADO"* antes de qualquer bandeira — foi exatamente o bug da rodada 12.

Trava de segurança: `surrenderPlayingRef` bloqueia a tela final enquanto a animação roda.

---

## O relógio que para de verdade

Pausar não é deixar de contar — é **devolver o tempo**:

```js
if (typing) {
  if (frozen === null) frozen = clockAtual;   // guarda o que faltava
  setClock(frozen);
  return;
}
// ao retomar:
const deadline = frozen !== null ? Date.now() + frozen * 1000 : base;
```

Usar timestamp absoluto era o erro: ao fechar a janela, o cronômetro recuperava todo o atraso de uma
vez. Simulação: 22s → congela em 21s → fecha → volta em 21s.

**Anti-abuso:** cada botão de pausa (nome, rádio, bandeira) tem um uso por rodada.

---

## Telas que dormem

O navegador **suspende timers** quando a tela apaga. Consequências e respostas:

| Sintoma | Resposta |
|---|---|
| `pagehide` dispara com tela apagada | só encerra se `persisted === false` |
| heartbeat para de bater | tolerância de 120s, não 30s |
| inatividade de 5 min com aba oculta | **re-arma**, não encerra |
| 30s do turno com tela apagada | **perde a vez**, não encerra a partida |

O princípio: em mobile, ausência breve de sinal é comportamento normal do sistema operacional, não
indício de abandono.

### Correção posterior importante

Nunca declarar vencedor diretamente em `onDisconnect`. O socket da RTDB também cai quando o sistema
operacional suspende o navegador. O `onDisconnect` agora remove apenas presença; abandono exige cinco
minutos sem heartbeat. O timeout de 30 segundos é transacional e pode ser confirmado pelo outro aparelho,
portanto o celular da vez pode dormir sem congelar a partida.

Não reintroduzir `/abandon` como gatilho imediato. Um registro antigo nesse nó foi a causa de partidas
encerradas no segundo lance.

---

## A peça que anuncia a própria posição

A ideia original do Marcos, implementada literalmente:

> "Eu tô colocando uma função na própria peça. Se ela tiver em partida online e for selecionada, o
> sistema reconhece que precisa informar o inimigo. Como uma mensagem automática de entregando
> posição. A mensagem é o próprio desenho de selecionado."

Cada pulso carrega a peça e **as rotas que quem selecionou está vendo** — cerca de 250 bytes. O
adversário desenha o mesmo losango e os mesmos destinos, do lado dele do tabuleiro.

---

## Detecção de saída em cascata

Nenhum evento de navegador é confiável sozinho. Cinco sensores independentes:

| | Sensor | Tempo |
|---|---|---|
| A | heartbeat gravando `lastSeen` | 5s |
| B | `pagehide` declara derrota | imediato |
| C0 | `onDisconnect` grava abandono no servidor | ~30-60s |
| C | listener do heartbeat do rival | tempo real |
| D | auditoria sem batida | 120s |

---

## Os erros que custaram mais caro

Registrados para não repetir:

1. **`[5]` solto no array de direções** — faltava a diagonal `[1,1]`. Comida dupla não funcionava.
2. **Dois listeners vivos ao mesmo tempo** — refatorei sem remover o antigo. Os dois venceram.
3. **`pushPulse` acumulando estado** — o `pick` antigo sobrevivia e a seleção fantasma ficava presa.
4. **`.catch(() => undefined)`** — erro de permissão nas Rules engolido em silêncio.
5. **`applyRemoteMoveRef` atribuído depois do listener** — primeira jogada sumia sem erro.
6. **Timestamp absoluto no relógio** — pausar não pausava nada.
7. **Ref no objeto errado do listener** — bug de um minuto inteiro para reconhecer uma jogada.

---

## Coisas que não dão para fazer em navegador

Honestidade registrada:

- **Bluetooth P2P** — não existe API de dados entre navegadores. O Web Bluetooth fala com
  dispositivos BLE (fone, sensor), não com outro celular.
- **Link criptografado no QR** — qualquer token gerado no cliente é decodificável. Sem backend, não
  há segredo.
- **O QR que abre direto na partida** — funciona até o limite do HTTPS + Firebase. Se o navegador
  abrir o link em vez do app, o que dá para fazer é o auto-confirm de 12 segundos, que já está lá.

O que **dá** na mesma rede: WebRTC DataChannel fecha localmente e o pacote não sai do roteador.

---

## Arquivos do motor

| Arquivo | Papel |
|---|---|
| `src/game/engine.ts` | regras puras, sem React nem DOM |
| `src/game/network/pulse.ts` | canal de sinal |
| `src/game/network/firebase.ts` | estado, presença, abandono, rendição em 2 etapas |
| `src/App.tsx` | orquestração, replay, relógio, sensores |
| `database.rules.json` | precisa acompanhar qualquer campo novo |
| `src/components/Board.tsx` | tabuleiro; tudo que usa coordenada de célula fica DENTRO do spin-layer |

**Regra do spin-layer:** qualquer camada com coordenada de célula precisa morar dentro do elemento
rotacionado. Fora dele, só coordenada de tela.

---

## Estado atual

**Funcionando:** criar sala, QR, jogar, sincronizar, capturas com animação sincronizada, rendição em
duas etapas, rádio, aviso de digitação, observador, presença, reconexão, PWA instalável.

**Com limitação consciente:** validação autoritativa em Cloud Functions (hoje o cliente decide e a
RTDB ordena), TURN em produção, Bluetooth.

**A régua do projeto:** se duas telas mostram coisas diferentes para o mesmo evento, o bug é de
arquitetura — não de animação.

## QR: fluxo correto

O QR não deve marcar `CONECTADO` só porque os sprites carregaram. O fluxo correto é:

1. abrir `/?chave=XXXXXX`;
2. autenticar anonimamente;
3. consultar chave e sala com `probeRemoteMatch()` sem ocupar P2;
4. somente então acender a luz verde;
5. o botão OK executa `joinRemoteMatch()` e ocupa P2 por transação;
6. iniciar countdown e FIGHT.

Assim o host não começa antes de o convidado confirmar, mas a maior parte do trabalho de rede já ocorreu
enquanto ele digitava o nome.

### Implementação atual

`probeRemoteMatch()` autentica e valida a sala sem ocupar P2. A luz verde da janela do QR significa
Firebase/chave/sala confirmados, não mais "sprites carregados". O botão OK chama `joinRemoteMatch()` e
somente então o host inicia a batalha.

## Captura sincronizada em duas fases

Não publicar o tabuleiro final antes da animação; isso faz o fiscalizador desfazer a jogada local.

O fluxo correto é:

1. cada salto publica `pulse.action = moving`, com origem, destino, captura e board de prévia;
2. o adversário chama `runMove(..., replay)` imediatamente;
3. em cadeia, `moveDeferFinal` segura a barragem até o último salto;
4. os dois reproduzem rota, mira, scanner, mísseis e derretimento juntos;
5. somente no fim o autor grava o `state` oficial;
6. `anticipatedStateSeqRef` impede o state final de reproduzir o lance pela segunda vez.
