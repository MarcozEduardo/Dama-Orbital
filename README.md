# 🛰️ DAMAS ORBITAIS — *A Viagem de Bobby*

> Spin-off jogável do universo **Bobby**. Damas brasileiras em uma grade 8×8 em órbita baixa da Terra,
> com sprites pixel art estilo *Metal Slug*, mísseis teleguiados, marcas de guerra que envelhecem no piso
> e um tabuleiro que **gira de verdade** — trocando a perspectiva de quem está jogando.
>
> **Criado e dirigido por Marcos Eduardo.**

## 📚 Portfólio

- [Estudo de caso: como Marcos Eduardo orquestrou a evolução do jogo](docs/CASE-STUDY-ORQUESTRACAO.md)
- [Sacadas do Marcão: decisões de game design que nasceram do teste real](docs/SACADAS-DO-MARCOS.md)

---

## 📖 A SAGA (canon)

### 1. A Fuga de Bobby — *o jogo que originou a engine*
Bobby é um robô preso no planeta de **Socram**. O jogo é de **plataforma**: ele pula, escala e foge
enquanto a base desaba atrás dele. A fuga cobra um preço alto — **Bobby perde todos os seus soldados**
pelo caminho, um por um. No confronto final, **Socram é derrotado**.

Ao tentar fugir, Socram cai na **própria armadilha e explode**. No estouro, uma **chave** cai no chão.
Bobby pega a chave e, com ela, **abre uma estação de telecomunicação** abandonada. Ele transmite um
pedido de socorro para o vazio... e **um foguete chega para salvá-lo**.

### 2. A Viagem de Bobby — *a continuação*
O foguete deixa de ser transporte e vira **a nova arma da batalha**. Bobby cruza o universo e o
**cinturão de asteroides**, travando batalhas épicas, até enxergar o **planeta Terra** crescendo na
janela. Na cutscene final, os computadores de bordo **miram na Terra**, o foguete desce — e é o fim.

### 3. Damas Orbitais — *este jogo (spin-off)*
Entre a chegada e o pouso, sobrou **uma última batalha**: os **rebeldes remanescentes** do Império de
Socram bloquearam a rota. Bobby chama o **Marcão** pelo codec e o combate acontece onde dá para ver
tudo de cima: um **tabuleiro orbital 8×8**.

É também o **primeiro título multiplayer** da franquia (hoje local, dois jogadores no mesmo aparelho —
o plano de rede está estudado no fim deste documento).

---

## 🎮 COMO JOGAR

| Regra | Comportamento |
|---|---|
| Movimento | Só **diagonal**. Nunca eixo X ou Y. |
| Captura | **Obrigatória** — a peça obrigada pisca com anel dourado. |
| Peão | Anda 1 casa pra frente, mas **captura pra frente E pra trás**. |
| Combo | Pulos múltiplos em cadeia. Se só existe 1 saída, o combo **dispara sozinho**. |
| Dama | Chega na última fileira → vira **blindada pesada**: voa qualquer distância na diagonal. |
| Estrelas ⭐ | Cada abate dá uma estrela de **veterana** à peça sobrevivente. |
| Vitória | Zerar as unidades inimigas **ou** deixá-las sem lance legal. |
| 🏳️ Rendição | Botão **DESISTIR**. Se ainda dá pra virar, o jogo avisa antes. |
| Encurralado | Ficou sem jogada? É executado na hora — **sem direito a bandeira**. |

### 🏳️ A Rendição (o troco mais caro do jogo)
Clicou na bandeira branca e o jogo mede a sua situação: com **3+ peças e diferença de até 2**, ele te
segura — *"Tem certeza? Sua aliança ainda parece ter chances de vencer!"*. Se já está perdido, ele
só confirma que os rebeldes não costumam ser gentis.

Confirmou? Então:
1. **Todas as suas peças erguem uma bandeirinha branca** e murcham no lugar, com **sirene** tocando
   e faróis vermelhos varrendo a plataforma.
2. Um **estandarte gigante** com a cruz de trégua balança no meio da tela.
3. Rufar grave, **scanner** varre tudo e as **miras cravam em cascata** em cada peça rendida.
4. **TRA-TRA-TRA**: cada peça inimiga sobrevivente despeja **3 mísseis** em alvos sorteados.
   1 peça contra 6 inimigas = **18 mísseis** caindo na sua cabeça. 12 contra 12 = **36**.

---

## 💥 O SHOW DE EFEITOS

**Ao comer uma peça:**
1. Uma **mira numerada** crava na vítima.
2. Em combos, cada novo salto ganha seu próprio alvo: `ALVO 1`, `ALVO 2`, `ALVO 3`.
3. Ao pousar, um scanner confirma a barragem e os mísseis saem da peça vencedora.

**Ao pousar (fim do lance):**
4. A peça que comeu **abre os pods e dispara mísseis teleguiados** — a dama lança quatro por alvo.
5. Os mísseis fazem curva (bezier quadrática), explodem com bola de fogo, anel de choque e estilhaços.
6. As vítimas **derretem** e voam para a bancada de troféus do jogador.

**Marcas de guerra:** cada explosão e cada peça que passa deixa decalque no piso. As brasas esfriam em
~5s, e a mancha **envelhece por 75 segundos**, dessaturando até virar cicatriz permanente. No fim de uma
partida longa o tabuleiro parece um campo de batalha de verdade.

**Outros detalhes:** turbinas azuis acesas nas saídas de ar (só aparecem na peça que está de costas pra
você), giro de 180° com troca de perspectiva no meio da animação, wobble que tira cada peça um tiquinho
do lugar, screen shake, scanlines CRT, contagem `3 · 2 · 1 · FIGHT!`, e a **placa holográfica bônus** que
entra em flash, desintegra em partículas e viaja até a peça que virou dama.

---

## 🎨 PIPELINE DE ARTE (o truque técnico)

Os sprites são PNGs gerados em estilo *Metal Slug* sobre **fundo magenta chapado** (`#FF00FF`). Em runtime:

1. **Chroma-key por flood-fill** a partir das 4 bordas (não por "tolerância global") — assim buracos
   internos da arte nunca são apagados por engano.
2. **Limpeza de halo** + feathering nos pixels de contorno.
3. **Auto-crop** pelo bounding box, com ancoragem na base (a peça "senta" na casa).
4. **Recoloração por matiz seletiva** em canvas: a dama vermelha de costas é gerada girando **só a faixa
   ciano** da dama azul — o dourado e o metal cinza ficam intactos.
5. **Fallback procedural**: se qualquer PNG falhar, uma versão pixel art é **desenhada por código** em
   canvas. O jogo nunca fica sem sprite.
6. **Cache em IndexedDB** (com fallback `localStorage`) das texturas já processadas → o segundo boot é
   instantâneo.

Tabuleiro, míssil, coroa e estrela são **100% procedurais** (canvas → PNG dataURL), com dithering,
rebites, chanfros e rachaduras.

**Peso:** os assets brutos somavam **25 MB**. Após reamostragem Lanczos + mozjpeg 4:4:4, ficaram em
**427 KB**. O tamanho exato do bundle muda conforme novas funcionalidades entram; valide sempre no build.

**Áudio:** zero arquivos. Tudo sintetizado na hora com **Web Audio API** — osciladores, ruído filtrado e
envelopes: explosões, chiado de derretimento, whoosh de míssil, fanfarra de dama e bipes da contagem.

---

## 🎬 MEU ESTILO DE ORQUESTRAR — *Marcos Eduardo*

Eu não escrevo o código: **eu dirijo a obra**. Meu processo é o de um diretor de arte técnico que sabe
exatamente o efeito que quer ver na tela e negocia a viabilidade com a máquina.

**1. Eu descrevo a sensação, não a implementação.**
"Quero que a peça derreta", "míssil que dá uma queimadinha", "que fique com a marca da guerra",
"quero um sprite de qualidade tipo Metal Slug". A tradução para código é problema da engine — o meu
trabalho é garantir que o *sentimento* chegue no jogador.

**2. Eu autorizo o experimento e já combino a saída.**
Minha frase-chave é: *"quero testar. se ficar paia a gente cancela esse método."* Nenhuma ideia entra
como definitiva. Cada efeito é uma hipótese com direito a rollback — foi assim que o wobble do giro e a
perspectiva de dois sprites por peça entraram.

**3. Eu antecipo o risco técnico antes de pedir.**
Quando peço sprite, eu já aviso: *"cuidar para ter sprites pois senão não vai renderizar"*, *"faz
fallback"*, *"tá pesando e demorando, tenta cachear"*. Eu não peço só a feature: peço a **feature com
rede de proteção**.

**4. Eu testo jogando, no olho.**
Meu QA é empírico e implacável: eu jogo e vejo o que **não** aconteceu. Foi assim que peguei o bug mais
importante do projeto — *"não tá comendo 2 ou mais peças!"*. Eu não reporto stack trace, reporto
**comportamento ausente**, que é o que realmente importa.

**5. Eu itero por camadas, sempre pra cima.**
Primeiro o tabuleiro funcionando. Depois sprites. Depois giro e perspectiva. Depois mísseis, cutscene,
placar, cutscene, envelhecimento. Nunca peço tudo de uma vez: **empilho qualidade**.

**6. Eu penso no negócio junto com a arte.**
No meio da direção criativa eu já levanto: *auth pelo Firebase, dados protegidos, fallback no
localStorage, assets fora do GitHub pra ninguém baixar*. Estética e propriedade intelectual caminham
juntas.

### Os testes que eu faço
- **Teste do "comeu?"** — forçar capturas duplas e triplas de propósito e conferir se a cadeia acontece.
- **Teste da diagonal** — tentar mover em X e Y pra garantir que o jogo recusa.
- **Teste da dama** — levar peça até a última fileira e ver se ela vira "a pode tudo" (menos X e Y).
- **Teste do giro** — girar o tabuleiro e conferir se a perspectiva das peças acompanha o jogador.
- **Teste de peso** — se demorar pra carregar, é bug. Cache e otimização são requisito, não enfeite.
- **Teste do "ficou paia?"** — o mais importante: se o efeito não impressiona, ele é cancelado.

### Testes automatizados que rodam por baixo
Para sustentar o que eu peço no olho, a engine é validada por fora do navegador:

- **Testes unitários de regra:** captura na diagonal `[1,1]` (o bug do `[5]` solto), cadeia dupla,
  dama voadora com múltiplos pousos, captura obrigatória filtrando lances normais, tabuleiro inicial.
- **Simulação de 400 partidas aleatórias** (21.090 lances, 7.441 capturas, 595 damas), verificando
  invariantes a cada lance: nunca comer peça aliada, nunca capturar casa vazia, nunca duplicar peça,
  nunca perder peça do tabuleiro, e **toda partida termina** (nada de loop infinito).
- **Checagem de equilíbrio:** 204 vitórias do P1 contra 196 do P2 — sem viés estrutural para nenhum lado.
- **Maior cadeia observada:** 5 pulos em sequência (ou seja, a barragem chega a lançar 5 mísseis).

---

## 🌐 ESTUDO: MULTIPLAYER ONLINE — *a Chave Diplomática*

**Status:** menu, chave diplomática, QR, regra dos assentos, rádio, relógio e modo observador já possuem
interface e protótipo. O transporte atual conecta **abas/janelas do mesmo navegador**
(BroadcastChannel → evento `storage` → polling 400ms). A conexão real entre aparelhos será híbrida:
Firebase Realtime Database como estado/presença/fallback e WebRTC via Trystero como caminho direto.
Veja `docs/MULTIPLAYER-HANDOFF.md` antes de alterar `src/game/net.ts`.

### 🧠 A IA (`src/game/ai.ts`) — um motor, dois usos

**1. Modo Contra a Máquina** (escondido até a Aliança Bobby vencer uma vez).
Minimax com poda alfa-beta em profundidade 4 — enxerga *meu lance → resposta dele → meu troco →
resposta dele*. A avaliação pesa material, avanço rumo à coroação, controle de centro, encosto na
parede lateral e defesa da última fileira. **100% de vitória contra jogador aleatório**, e cada lance
sai em **menos de 1ms**.

**2. Observador silencioso** — roda a cada lance só olhando, sem interferir. Calcula, peça por peça,
se existe **alguma** jogada que não a entregue de graça. Só então sugere a rendição.

As travas são deliberadamente duras (pedido do Marcos: *"tem que ser bem fechadinho"*):

| Situação | Sugere render? |
|---|---|
| 3 ou mais peças | **Nunca** — ainda dá pra sacrificar e abrir corredor pra dama |
| Qualquer chance de coroação | **Nunca** — entregar peça pode ser o plano |
| Dama viva com saída | **Nunca** |
| Duas ou mais peças com saída segura | **Nunca** |
| Busca profunda (nível 5) vê linha viável | **Nunca** |
| 1-2 peças, zero saída, sem dama, material −3 | Sim |
| Sem nenhum movimento legal | Sim (é execução direta, sem bandeira) |

**Validação:** 80 partidas IA×IA (7.859 lances) → **zero** sugestões falsas de rendição. A primeira
versão dava 11; apertei até zerar. O seu exemplo do "6 peças com 4 ameaçadas" está no conjunto de
testes e passa: o jogo **não** desiste.

### O que já funciona
- **Chave de 6 caracteres** sem `0/O/1/I/L` (testado: 4.000 chaves sem colisão), verificada contra
  a base antes de ser emitida.
- **QR Code** apontando para `?chave=XXXXXX` — abrir o link já cai no painel com a chave preenchida.
- **Regra dos assentos**: 1º anfitrião (P1), 2º oponente (P2), do 3º em diante **observador**.
  Reconectar recupera a cadeira.
- **Trava de mesmo aparelho**: o `deviceId` fica no `localStorage` (compartilhado por todas as abas),
  então não adianta gerar a chave e tentar entrar como oponente nem como observador na mesma máquina.
- **Estado em 64 chars** (~144 bytes por lance). Os mísseis e o derretimento são reproduzidos
  localmente por cada cliente — a rede não carrega animação.
- **Perspectiva**: em 2 Dispositivos o tabuleiro **não gira** (cada tela já é do dono);
  no Padrão e no Observador ele gira normalmente.
- **Nome do jogador** editável no menu e durante a partida — aparece no lugar de "Império Socram".

### Os modos (menu `MODO DE JOGO`)

| Modo | Como funciona | O tabuleiro gira? |
|---|---|---|
| **Normal** | Dois no mesmo aparelho (hot-seat), passando o celular. | **Sim** — é o que dá o "cada um do seu lado". |
| **2 Dispositivos** | Chave Diplomática ou QR Code. Cada um no seu aparelho. | **Não** — cada tela já nasce na perspectiva do dono. |
| **Observador** | Entrou com a chave depois das duas vagas: assiste. | **Sim** — acompanha a vez de quem joga. |
| **Contra a Máquina** | 🔒 Bloqueado. Destrava quando a Aliança Bobby vencer uma vez. | **Não** — do lado de lá é uma IA. |
| **Informações** | Cutscene do Bobby explicando os modos pro Marcão. | — |

### A Chave Diplomática (regra de ouro)
Um código **curto e legível** (ex.: `BOBBY7`, alfabeto sem `0/O/1/I` pra não confundir), gerado pelo
servidor com **unicidade garantida** — a chave é criada por transação atômica e **jamais é reemitida**.
Fluxo de assentos:
1. **Primeiro** que entra com a chave → **P1** (dono da partida).
2. **Segundo** → **P2** (adversário).
3. **Do terceiro em diante** → **observadores**, automaticamente. Sem exceção, sem fila.

Ao lado do código, um **QR Code** apontando pra `?chave=BOBBY7` — a pessoa escaneia e já senta na cadeira.

### 📻 Rádio (mensagens entre oponentes)
Botão de notificação de rádio. A mensagem aparece como **holograma pequeno flutuando sobre a última peça
mexida que ainda está em jogo** (se a peça foi capturada, cai pra última peça viva do remetente).

Moderação, já que tudo passa pelo mesmo servidor:
- **Lista de frases prontas** (o caminho mais seguro e mais rápido de digitar no celular):
  `Se lascou!` · `Boa jogada!` · `Vou te pegar` · `kkkkkk` · `Tá osso` · `Bora, tô esperando`.
- **Texto livre com filtro** na Cloud Function: bloqueia palavrão (lista + variações com `@`/`0`/`1`),
  limita a ~40 caracteres, **corta repetição de caractere** (`aaaaaaaa`) — com **exceção explícita pro
  `kkkkk`**, que é patrimônio cultural — e bloqueia sequências de números/letras aleatórias
  (heurística de entropia: pouca vogal + muito dígito = provável spam/link disfarçado).
- **Rate limit**: 1 mensagem a cada 5s, máx. 3 na fila. Observador **não** manda rádio.

### Progressão persistida (o desbloqueio da IA)
Guardado no `localStorage` (e espelhado no perfil quando logado):
```js
{ venceuComBobby: false, viuInfo: false, iaDesbloqueada: false }
```
- Antes de vencer: em **Informações**, o Bobby explica Normal e 2 Dispositivos, e fecha com
  *"Registrei uma notícia aqui sobre uma IA, mas parece que precisamos que a aliança do Bobby vença uma
  vez para desbloquear!"*
- Depois da primeira vitória da Aliança: ao voltar, aparece **"NOVA MENSAGEM"** e a cutscene abre com o
  Marcão perguntando da tal IA — o Bobby responde que o modo **CONTRA A MÁQUINA** foi liberado e já
  aparece no menu. *Câmbio, desligo.*

### Arquitetura recomendada: **estado autoritativo no servidor, cliente burro pra regra**

O ponto crítico: **a regra de damas não pode viver só no navegador**, senão qualquer um abre o DevTools e
move peça pra onde quiser. O cliente propõe o lance; quem valida é o servidor.

```
┌────────────┐   lance proposto    ┌──────────────────┐
│ Jogador A  │ ──────────────────▶ │ Cloud Function   │
│ (browser)  │                     │ (engine.ts roda  │
└────────────┘ ◀────────────────── │  no servidor)    │
      ▲          estado novo       └────────┬─────────┘
      │                                     │ grava
      │        onSnapshot em tempo real     ▼
┌────────────┐                     ┌──────────────────┐
│ Jogador B  │ ◀────────────────── │ Firestore / RTDB │
└────────────┘                     └──────────────────┘
```

A grande vantagem: **`src/game/engine.ts` é TypeScript puro, sem React e sem DOM** — o mesmo arquivo roda
no navegador (pra prever/animar) e dentro da Cloud Function (pra validar). Uma regra, uma fonte da verdade.

### Modelo de dados (Firestore)

```
/matches/{matchId}
  createdAt, status: 'waiting'|'playing'|'finished'
  players: { p1: uid, p2: uid|null }
  turn: 1|2
  board: string            // FEN compacta, 64 chars — cabe num campo só
  chain: {r,c}|null        // se há combo obrigatório em andamento
  captures: { p1: [], p2: [] }
  lastMove: {from,to,jumps:[]}   // o cliente usa pra reproduzir mísseis/derretimento
  updatedAt, winner
/matches/{matchId}/moves/{seq}   // histórico → replay e antifraude
/users/{uid}  { nick, vitorias, derrotas, maiorCombo }
```

Serializar o tabuleiro como **string de 64 caracteres** (`.`=vazio, `b/B`=Bobby peão/dama, `s/S`=Socram)
mantém o documento minúsculo e barato — cada lance é ~200 bytes trafegados.

### Regras de segurança (o que impede trapaça)

```js
match /matches/{id} {
  allow read: if request.auth != null
              && request.auth.uid in resource.data.players.values();
  allow update: if false;   // NINGUÉM escreve direto: só a Cloud Function
}
```
O cliente só chama `httpsCallable('playMove')`. A function verifica: (a) é a vez desse uid?
(b) o lance está em `allMoves(board, turn)`? (c) se havia captura obrigatória, ele capturou?
Se qualquer resposta for não → rejeita e nem grava.

### Autenticação
- **Firebase Auth anônimo** para entrar rápido ("JOGAR AGORA" sem cadastro) —
  e depois **link** da conta anônima com Google/e-mail sem perder o histórico.
- Sala por **código de 6 caracteres** (tipo `BOBBY7`) ou link direto — quem abre o link e está logado,
  senta na cadeira P2.

### Sincronizar os efeitos (o pulo do gato)
Os mísseis, o derretimento e o giro **não devem trafegar**. Trafega só o `lastMove` com a lista de casas
puladas; **cada cliente reproduz a animação localmente** com o mesmo `runMove`. Assim a rede carrega
200 bytes em vez de 60 quadros por segundo, e os dois jogadores veem o mesmo espetáculo.

Detalhe de perspectiva: o `facing` é **local** — cada jogador vê as próprias peças embaixo, de costas.
O tabuleiro do P2 já nasce girado 180°. Ninguém precisa girar nada pela rede.

### Fallback em camadas (sempre funcionar)
1. **Online (Firestore):** partida com outra pessoa, tempo real.
2. **Queda de conexão:** o estado da partida fica espelhado no `localStorage`
   (`damas-match-{id}`); ao voltar, o cliente compara `updatedAt` e ressincroniza pelo servidor.
3. **Sem Firebase configurado / offline total:** o jogo cai automaticamente no **modo local
   hot-seat** que já existe hoje, com o placar guardado no `localStorage`. O jogo **nunca** fica
   injogável — mesma filosofia do fallback procedural dos sprites.

Um `MatchProvider` com a interface `{ board, turn, play(move), status }` deixa isso transparente: o
componente `<Board>` não sabe (nem precisa saber) se o adversário está no sofá ou em outro estado.

### Proteger os assets (não deixar baixar do GitHub)
Plano combinado para depois:
- Tirar os PNGs do repositório público e subir no **Firebase Storage** em bucket privado.
- Servir por **signed URL de curta duração**, emitida por Cloud Function só para usuário autenticado.
- Guardar no repo apenas os **fallbacks procedurais** (que são código, não arte final).
- Marca d'água invisível nos sprites originais + `Cache-Control: private`.
- Não impede print de tela — mas impede o `git clone` sair com o pacote de arte pronto.

### Ordem sugerida de implementação
1. `MatchProvider` local (refatoração sem rede) → o jogo continua igual, mas desacoplado.
2. Firebase Auth anônimo + criação/entrada em sala por código.
3. Espelhar estado no Firestore com `onSnapshot` (ainda validando no cliente).
4. Mover a validação para a Cloud Function e **fechar as regras de escrita**.
5. Reconexão, `localStorage` de emergência e placar/ranking persistente.

---

## 🕹️ RODANDO

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # bundle único em dist/index.html
```

## 🧱 ESTRUTURA

```
src/
├── game/
│   ├── engine.ts        # regras puras (sem React/DOM) — roda no browser E no servidor
│   ├── sprites.ts       # chroma-key, recoloração, procedurais, cache IndexedDB
│   └── audio.ts         # synth chiptune (Web Audio API)
├── components/
│   ├── Board.tsx        # tabuleiro 3D, peças, decalques, turbinas
│   ├── MissileLayer.tsx # motor de partículas em canvas (rAF): mísseis, fogo, explosões
│   ├── Cutscene.tsx     # chamada de codec Bobby ↔ Marcão
│   ├── Countdown.tsx    # 3 · 2 · 1 · FIGHT!
│   ├── HoloPlaque.tsx   # placa bônus do portfólio
│   └── Hud.tsx          # placares, bancada de troféus, estrelas
└── App.tsx              # orquestração de fases e sequências assíncronas canceláveis
```

---

<p align="center">
  <b>★ PORTFÓLIO MARCOS EDUARDO ★</b><br>
  <sub>Damas Orbitais · A Viagem de Bobby · spin-off de A Fuga de Bobby</sub>
</p>
