<a id="topo-sacadas"></a>

> 📑 **[Ver índice navegável](SACADAS-INDICE.md)** · ⬅️ **[Voltar pro README](../README.md)**

# Sacadas do Marcos Eduardo

Registro das percepções de produto que nasceram do teste real, não do código. Cada uma foi detectada
jogando, não lendo log. Todas estão implementadas.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 1. A malandragem do delay assimétrico

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Quem tá fazendo a jogada não vê o efeito. Pois já existe o efeito de rota que vc criou pra quem
> tá jogando. Pra quem jogou, a jogada já aconteceu. O servidor tá só se alinhando."

**Por que é genial**

O problema clássico de jogo online por turnos é a peça que *teleporta* na tela do adversário. O
instinto comum seria sincronizar animação pela rede — caro, frágil e travado.

A solução do Marcos inverte a lógica: **a latência vira linguagem visual**. O tempo que o servidor
leva para alinhar deixa de ser espera morta e passa a ser o momento em que a rota é desenhada.

**Regra de ouro:** o delay existe *apenas* para quem não executou o lance.

| Quem | Vê a rota tracejada? | Motivo |
|---|---|---|
| Quem jogou | Não | Já viu a própria animação em tempo real |
| Quem esperava | Sim | Senão a peça apareceria do nada |
| Observador | Sim, dos dois lados | Precisa de leitura completa da partida |

**Implementação:** `src/components/GhostRoute.tsx` + bloco `ROTA FANTASMA` em `src/App.tsx`.
Bolinhas fluorescentes na cor da facção percorrem o caminho, ponto maior no pouso, mira girando nas
peças que serão capturadas. Em combos, cada escala vira um ponto — a rota mostra `pum… pum… pum`
antes dos mísseis.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 2. Rádio com direito de resposta

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Somente quem tem direito de resposta do rádio é o outro que ainda não usou nessa rodada. Isso
> evita de sacanear e ficar parando uma rodada por muito tempo."

**Por que é genial**

É *game design de moderação*. Em vez de punir o abuso depois, a mecânica torna o abuso impossível.
Um jogador não consegue metralhar mensagens para irritar ou ganhar tempo, e o adversário sempre tem
a última palavra garantida na rodada.

**Implementação:** `radioUsedBy` em `src/App.tsx`, zerado a cada troca de turno confirmada.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 3. Congelar o relógio quando alguém digita

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Se a pessoa clicar tanto no nome quanto no rádio, ela tem 15s pra digitar. O tempo do jogo pausa
> o cronômetro."

**Por que é genial**

Resolve dois problemas de uma vez: ninguém perde a vez por estar escrevendo, e ninguém usa o chat
como tática de enrolação, porque a janela é fixa em 15 segundos.

**O detalhe que fecha:** o adversário **vê** que você está digitando, com balão pixel art e contagem
regressiva. Transparência total — a pausa nunca parece travamento.

**Implementação:** estado `typing` em `src/App.tsx`, faixa `typing-strip` em `StatusPlate.tsx`.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 4. A placa no lugar da barrinha

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "O botão rádio parece que é sobre a conexão. No mobile a experiência tá estranha. A gente coloca
> uma placa como se fosse da plataforma, com faixas de proteção amarelo e preto."

**Por que é genial**

O ícone genérico de rádio, ao lado de indicadores de rede, era lido como *status de conexão*. A
correção não foi trocar o ícone: foi **mudar o contexto**. Dentro de uma placa industrial com faixas
de perigo, tudo passa a pertencer ao universo do jogo.

A placa concentra: seu nome clicável com lápis, `ONLINE`, `VS`, nome do rival, contador `2/2`,
antena oscilando, contador de observadores, walkie-talkie desenhado, botão vermelho de desconexão e
o semáforo.

**Implementação:** `src/components/StatusPlate.tsx` + sprites em `src/components/Sprites.tsx`.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 5. O semáforo em vez de texto

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Um semáforo aparecer do lado de quem tem que esperar. Com verde e vermelho. Luzes neon CRT,
> redondinhas, tipo led com base de metal, parafusinho na base."

**Por que é genial**

Texto exige leitura; cor é instantânea. Num tabuleiro cheio de efeito, o jogador precisa saber em
100ms se pode tocar. Verde = `SUA VEZ`. Vermelho = `ESPERE`.

A exigência do acabamento — base de metal, parafuso, halo neon — mantém a coerência com a plataforma
orbital. Não é um widget: é uma peça da nave.

**Implementação:** `SignalLight` em `src/components/Sprites.tsx`, com halo pulsante em CSS.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 6. O QR que já entra na partida

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Quero que o QRCODE já abra o link do jogo, conectando na partida. Já apareça um entrando na
> partida, aguarde. Coloque seu nome e confirme, ou clique em pular. Aí abre o jogo — dá tempo de
> conectá-los."

**Por que é genial**

Percepção rara de UX: **usar o tempo do usuário como tempo de carregamento**. Enquanto a pessoa lê e
digita o nome, o Firebase autentica, reserva a cadeira e o WebRTC negocia. A espera técnica
desaparece atrás de uma ação útil.

Mesma filosofia da cutscene do Bobby escondendo o processamento dos sprites.

**Implementação:** `src/components/JoinGate.tsx`.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 7. Feedback ao emitir a chave

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "A chave demorou pra gerar e não teve feedback visual."

**Por que importa**

Transação atômica no Firebase não é instantânea. Sem retorno visual, o usuário clica de novo e pode
gerar duas salas. O anel girando e a barra de progresso não são enfeite: **são prevenção de bug**.

**Implementação:** estado `networkBusy` em `MainMenu.tsx`, botão desabilitado durante a emissão.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 8. QR grande é requisito, não estética

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "O QR Code fica pequeno! Acho que ele pode ocupar a tela ali e ficar mais."

**Por que importa**

QR pequeno em tela com scanlines e brilho é difícil de escanear. Agora o QR é clicável e abre em
tela cheia com o código gigante embaixo — funciona como fallback quando a câmera falha.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 9. Peso visual proporcional à importância

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "O saque tá legal, cabe de boas na tela do mobile, mas a quantidade de peças tá enorme. Daí fica
> um em cima e outro embaixo do tabuleiro."

**Por que importa**

O número de unidades ocupava mais espaço que o tabuleiro no celular, empurrando o jogo para fora da
dobra. No mobile o HUD virou uma linha horizontal compacta; no desktop continua vertical e imponente.

**Implementação:** classes `hud-compact` no media query de `src/index.css`.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 10. Desconexão por inatividade com saída digna

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Mensagem de desconectado após 5 minutos de jogo parado por inatividade. Botão de recomeçar
> partida que joga no padrão."

**Por que é genial**

Sala fantasma consome conexão simultânea do plano gratuito. Mas o detalhe fino é o **destino do
botão**: em vez de deixar o jogador na tela morta, ele cai no modo Padrão e continua jogando. A
falha de rede nunca vira fim de experiência.

---

## Padrão por trás de todas as sacadas

As dez percepções seguem a mesma lógica:

> **Transformar limitação técnica em linguagem de jogo.**

- Latência virou rota tracejada.
- Tempo de conexão virou tela de nome.
- Processamento de sprite virou cutscene.
- Moderação de chat virou regra de rodada.
- Timeout de sala virou retorno ao modo local.

Nenhuma delas veio de stack trace. Todas vieram de **jogar e perceber o que estava estranho**.

---

# Rodada 2 · bugs achados jogando


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 11. O BUG CABULOSO da rendição

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Se a pessoa desistir, não acontece nada na partida. Eu cliquei em desistir e destruí foi o meu
> inimigo todo. Só que do outro lado o inimigo acha que ainda está jogando."

**A causa raiz**

```ts
executeSurrender(turn, board)   // ERRADO
```

`turn` é *de quem é a vez*, não *quem clicou*. No modo local os dois coincidem, então o bug ficou
invisível por toda a fase offline. No online, se você clicasse fora da sua vez, o jogo registrava a
rendição **do adversário** — e ainda executava a barragem contra ele.

**A correção**

```ts
const side: Player = myPlayer ?? turn;   // quem clicou
executeSurrender(confirmGiveUp.side, board)
```

Três camadas de proteção foram adicionadas:

1. `askGiveUp` calcula `side = myPlayer ?? turn` e guarda no diálogo.
2. Observador não pode se render.
3. No online a rendição só é aceita na sua vez, porque a transação da RTDB exige
   `state.turn === seat`. Fora da vez o jogo avisa em vez de gravar lixo.

E o principal: a rendição agora **é publicada e reproduzida** na tela do adversário — bandeira,
sirene, estandarte e barragem completa.

**Teste:** `whoSurrenders(1, 2) === 1` (P1 clica na vez de P2 e quem se rende é P1).

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 12. Os efeitos não existiam para o adversário

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Não tá rolando a animação de mira, nem de míssil estourando. Na verdade todos os efeitos que
> acontecem pra quem tá atacando não aparecem para o adversário."

**A causa raiz**

O adversário recebia apenas o tabuleiro final em 64 caracteres e fazia `setBoard`. As peças sumiam
sem mira, sem míssil, sem derretimento. Metade do jogo era invisível para quem não estava atacando.

**A correção**

Em vez de duplicar a lógica de animação, `runMove` ganhou um **modo replay**. O cliente do
adversário chama exatamente a mesma função que o atacante usou:

```ts
runMove(board, from, first, { jumps, board: s.board, turn: s.turn, winner: s.winner })
```

No modo replay ele:

- segue a cadeia **exata** informada em `jumps`, em vez de recalcular;
- nunca publica de volta (evita eco infinito);
- ao terminar, encosta o estado autoritativo do servidor.

O detalhe que fecha: uma cadeia pode ter **duas continuações válidas**. Sem a lista de saltos o
replay escolheria a errada e as telas divergiriam. O teste automatizado cobre justamente esse caso.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 13. Clareza de vez: cor antes de texto

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Tá um pouco difícil saber de quem é a vez. Se o semáforo não funcionar, tem que fazer o fundo
> escuro ficar vermelho piscando."

**A implementação**

O fundo inteiro da tela virou indicador:

| Situação | Fundo |
|---|---|
| Sua vez | verde suave, respiração lenta |
| Aguardando | vermelho pulsando rápido |
| Observador | cor da facção que está jogando |

E o texto deixou de ser genérico: `AGORA É SUA VEZ` contra `AGUARDE · VEZ DE FULANO`, usando o nome
real do oponente em vez de "BOBBY/SOCRAM".

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 14. O QR tem que ser poderoso

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Não tem sentido ler QR code e ter que entrar no menu e digitar o código. O QR precisa ser
> poderoso a esse ponto."

**A implementação**

O link `?chave=XXXXXX` agora:

1. pula a cutscene;
2. nunca mostra a home do menu (o menu já nasce em `connecting`);
3. injeta o código sozinho;
4. mostra o portão só para o nome;
5. **autoconfirma em 12 segundos** se ninguém digitar.

Ou seja: escaneou, está dentro. O portão existe apenas para dar identidade e cobrir o tempo de
conexão — nunca para bloquear.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 15. Poluição visual na placa

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Tira o X de fechar conexão dali, tá poluindo. O X pode ficar antes do nome, ocupando as 2 linhas.
> Eu quero o rádio do tamanho do semáforo, escrito ZOAR."

**A implementação**

A placa foi reorganizada em três blocos:

- **Esquerda:** botão vermelho de sair, alto, ocupando as duas linhas, com confirmação embutida.
- **Centro:** linha 1 com seu nome clicável e o rival; linha 2 com canal, código, antena e observadores.
- **Direita:** duas torres do mesmo tamanho — `ZOAR` (walkie-talkie) e o semáforo.

O rótulo `ZOAR` resolveu de vez a confusão: ninguém mais lê o ícone de rádio como status de conexão.

---

# Rodada 3 · o bug da rota espelhada


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 16. "A peça do Bobby sai de dentro da do Socram"

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "A rota aparece do mesmo lado do meu adversário como se fosse ele jogando. É como se a peça do
> Bobby saísse de dentro da do Socram. Independente do dispositivo."

**A causa raiz — matemática pura**

A rota usa coordenadas absolutas do tabuleiro (`r`, `c`). A plataforma do P2 está girada 180°.
O `GhostRoute` estava sendo renderizado **fora** do `spin-layer`, então não girava junto:

| | posição |
|---|---|
| Peça do Bobby em `(5,0)` | `x: 6.25 · y: 68.75` (base esquerda) |
| Onde a plataforma girada mostra | `x: 93.75 · y: 31.25` (topo direita) |
| Onde a rota desenhava | `x: 6.25 · y: 68.75` ← **lado do Socram na tela do P2** |

Por isso o defeito era simétrico e acontecia "independente do dispositivo": quem estivesse com a
plataforma girada via a rota do oponente saindo do exército errado.

**A correção**

`GhostRoute` virou prop do `Board` e passou a ser renderizado **dentro da superfície girada**, ao
lado das peças e do holograma de rádio. Uma linha de arquitetura, não de matemática.

**Lição:** em tabuleiro que gira, qualquer camada com coordenada de célula precisa morar dentro do
elemento rotacionado. Fora dele, só coisas em coordenada de tela.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 17. O replay era engolido por estado sujo

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Os efeitos que te pedi não tá acontecendo na tela do adversário. O bug imobilizou a partida."

**A causa raiz**

O replay chamava `runMove`, mas `runMove` aborta se `seqRef` mudou no meio (proteção contra
sequências antigas). Se o cliente tivesse qualquer resto de animação, `busy`/`spinning` travados ou
alvos marcados, o replay morria calado — e o tabuleiro do adversário congelava.

**A correção**

Antes de cada replay o cliente limpa o terreno:

```ts
seqRef.current++;      // invalida sequências velhas
setSpinning(false);
setDoomed([]);
setBusy(true);
```

E o `AUTO-DEMO` foi **removido do modo online** com trava dupla: some da barra e o efeito recusa
rodar se `match.mode === "online"`. Era ele que "desbloqueava" a partida travada — mascarando o bug
real e corrompendo o estado.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 18. Sandbox sem saída

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "É criar uma rota sem saída, tipo mermaid, em sandbox. Eles estão lá presos. O que mantém o jogo
> vivo é conexão."

**A implementação**

No online não existe mais escapatória silenciosa:

| Evento | O que acontece |
|---|---|
| Clicar em sair | Confirmação; ao aceitar, o rival ganha na hora |
| Fechar o navegador | Presença some, 20s de tolerância, vitória do rival |
| Net cai | Tela de reconexão com barra; a partida continua viva |
| 5 min parado | Encerra com um único botão `OK` |
| Fim de partida | Online só tem `OK`, sem revanche que reabre sala morta |

E entrou o **fiscalizador**: a cada mudança ele compara o hash do tabuleiro local com o do servidor.
Se divergirem por mais de 2,5s, o autoritativo vence e o cliente ressincroniza sozinho.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 19. A peça que se rebela

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Se a pessoa clicou na peça, ela tá selecionada, a inteligência do modo oculto vai escolher a
> melhor rota após os 30s. Caso contrário, perdeu a vez."

**Por que é genial**

Transforma punição em narrativa. Quem demonstrou intenção (selecionou) não é punido: a peça age
sozinha usando o mesmo minimax do modo Contra a Máquina, com a mensagem *"PEÇA SELECIONADA SE
REBELOU"*. Quem não tocou em nada perde a vez normalmente.

Também resolve um problema real de multiplayer: partida travada por jogador ausente.

**Bônus da mesma sacada:** a peça selecionada agora ecoa na tela do adversário com um losango
tracejado dourado — dá pra ver em qual peça o oponente está pensando.

---

# Rodada 4 · simetria total


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 20. "Delay zero e todo mundo vê igual"

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "O delay eu só quero que exista pra que o usuário veja a rota. Ou faz o seguinte: TIRA O DELAY.
> Agora os dois adversários conseguem ver a rota do seu adversário e a dele. Todo mundo IGUAL."

**Por que a decisão é melhor que a original**

A primeira versão tinha assimetria proposital: só quem esperava via a rota. Parecia elegante, mas
criou três problemas:

1. o delay somava com mira, scanner e mísseis, virando espera longa;
2. o replay dependia de um `setTimeout` que podia ser engolido por estado sujo;
3. duas telas com comportamentos diferentes = duas superfícies de bug.

A decisão de simetria eliminou tudo de uma vez. Agora:

- a rota aparece **durante** o movimento, nos dois lados;
- o replay dispara **na hora** que o snapshot chega;
- o mesmo código roda igual em qualquer cliente.

**Lição registrada:** quando um comportamento assimétrico começa a gerar bug, a simetria costuma ser
mais barata que continuar defendendo a exceção.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 21. O bug que só aparecia para quem demorava

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "O cara demorou pra escolher as opções de desistir. A partida virou. Mas ele desistiu. Não houve
> fim de partida."

**A causa raiz**

A rendição era publicada por `commitRemoteState`, que roda uma transação exigindo
`state.turn === seat`. Enquanto o jogador lia o diálogo, o turno virava — e o commit era **recusado
em silêncio**. O jogador via a própria animação e achava que tinha funcionado.

**A correção em duas camadas**

1. `declareRemoteSurrender` escreve `status`, `winner` e `surrendered` **fora** da transação de
   turno. Rendição não é lance; não pode depender de vez.
2. Ao abrir o diálogo, o cronômetro principal **pausa por 15s** e o adversário recebe
   *"FULANO ESTÁ PENSANDO EM DESISTIR"* com contagem — mesma mecânica do nome e do rádio.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 22. Um sensor nunca basta

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Navegador foi fechado e a conexão permanece. Você precisa encontrar várias rotas. Se uma não
> funciona, tem fallback A.B.C.D.E, cada um no seu tempo, nenhum se atropelando."

**Por que é a arquitetura correta**

Detecção de saída no navegador é notoriamente pouco confiável: `beforeunload` não dispara em aba
descartada por falta de memória, `pagehide` varia entre navegadores, e `onDisconnect` do Firebase
depende do socket fechar.

A cascata implementada:

| Sensor | Mecanismo | Tempo |
|---|---|---|
| A | heartbeat gravando `lastSeen` | a cada 8s |
| B | `pagehide` + `beforeunload` declaram derrota | imediato |
| C | listener do heartbeat do rival | tempo real |
| D | auditoria: sem batida há 35s = abandono | verifica a cada 5s |
| E | `onDisconnect` do servidor limpa presença | ~30-60s |

Nenhum depende do outro. O mais rápido que funcionar encerra a partida corretamente.

**Princípio geral:** para eventos que o navegador não garante, use prova de vida periódica em vez de
confiar no aviso de saída.

---

# Rodada 5 · a causa raiz de tudo


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 23. Uma linha explicava os três bugs

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "As mesmas coisas que te pedi ainda continuam não acontecendo. Eu até desisti, mas demorou uns 30
> segundos pro adversário perceber. A gente tá usando Firebase, dá pra deixar isso instantâneo que
> nem rede social."

**A causa raiz — uma linha**

```js
if (s.seq <= seqSyncRef.current || !s.board) return;
```

Esse guard existe para não reprocessar o mesmo lance. Mas ele estava **antes** do processamento de:

- seleção de peça
- rendição
- aviso de digitação

E nenhum desses eventos incrementa `seq`. Resultado: o `return` disparava e o código nunca chegava
neles.

**A prova**

| Evento | Antes | Depois |
|---|---|---|
| Rival clicou numa peça | nada | seleção aparece |
| Rival desistiu | só o winner cru | rendição completa + winner |
| Rival pensando | nada | aviso aparece |
| Rival fez um lance | lance | lance |

**Por que exatamente ~30 segundos**

A rendição ficava presa até *algum* lance novo incrementar `seq`. Como o adversário estava parado,
quem encerrava era o sensor de presença, com janela de 35s. O número relatado bate com o mecanismo.

**A correção estrutural**

O listener foi dividido em duas trilhas explícitas:

```
TRILHA 1 · EVENTOS LEVES   → rodam sempre, sem olhar seq
                              seleção · rendição · winner · lastMove

TRILHA 2 · LANCE           → só quando seq avança
                              replay, mísseis, troca de turno
```

**A lição que fecha o projeto**

Esse mesmo erro apareceu três vezes: primeiro no rádio, depois na seleção e na rendição. A correção
pontual do rádio não resolveu porque tratei o sintoma, não o padrão.

> **Regra:** num jogo em rede, separe *estado versionado* de *sinais efêmeros*. Estado precisa de
> guarda de sequência. Sinal não pode ter — se tiver, ele simplesmente nunca chega.

---

# Rodada 6 · sinal não é estado


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 24. "Se move funciona em tempo real, por que clicar não?"

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Pq se move a peça normalmente funciona em tempo real. Pq quando come ou clica nela não existe
> tempo real? Tudo que o usuário faz de um lado tem que manifestar do outro. É o mesmo tabuleiro, só
> que de lados opostos."

**A causa raiz**

A seleção estava sendo gravada dentro de `matches/{id}/state`. Consequências:

1. o listener do `state` carrega o documento inteiro da partida;
2. passava pelo guard de `seq`;
3. atravessava toda a lógica de replay antes de chegar na seleção.

Movimento funcionava porque **é** estado versionado. Seleção não é — e estava no lugar errado.

**A correção estrutural**

Nasceu o nó `live/{matchId}/{uid}`, com listener próprio:

| | antes | depois |
|---|---|---|
| Onde mora | `matches/{id}/state` | `live/{id}/{uid}` |
| Payload | documento inteiro | ~83 bytes |
| Guard de seq | sim | não |
| Latência | 10-20s | instantânea |

E o sinal agora carrega também **as rotas** que o jogador está vendo, calculadas por quem
selecionou. O adversário desenha exatamente as mesmas opções, do lado dele do tabuleiro.

**A lição definitiva do projeto:**

> Existem dois tipos de dado em jogo online: **estado versionado** e **sinal efêmero**. Estado
> precisa de sequência, ordem e guarda. Sinal precisa de velocidade e nada mais. Misturar os dois
> num único caminho faz o sinal herdar a lentidão do estado.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 25. Tela apagada não é abandono

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Parece que se o celular ficar com a tela apagada perde a conexão. Mas não ficou sem net. Foi
> somente o led da tela que apagou porque tava ocioso."

**A causa raiz**

Dois erros somados:

1. `pagehide` era tratado como saída definitiva — mas ele dispara também quando a página vai para o
   bfcache (tela apagada, troca de aba).
2. O navegador **suspende timers em background**, então o heartbeat parava e a auditoria de 35s
   interpretava como abandono.

**A correção**

- `pagehide` agora só declara derrota se `event.persisted === false` (descarte real).
- `visibilitychange` bate o heartbeat no instante em que a tela volta.
- Tolerâncias ampliadas: heartbeat 35s → **90s**, presença 20s → **60s**.

**Princípio:** em mobile, ausência de sinal por pouco tempo é o comportamento normal do sistema
operacional, não indício de saída.

---

# Rodada 7 · o pulso único


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 26. "Tudo é uma coisa só, uai"

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Se mover uma peça é uma jogada, desistir também é. Escolher uma mensagem também é. Por que quando
> escolhe a mensagem ela é instantânea e o desistir e selecionar não é? Não tá no mesmo loop. Não dá
> pra deixar separado só porque tu tá achando bonitinho. Qual o mistério de reaproveitar o que tem,
> pra quê criar algo que só vai lutar contra o próprio corpo?"

**O diagnóstico dele estava correto**

Eu havia criado **quatro caminhos diferentes** para a mesma coisa:

| Ação | Onde morava | Como chegava | Velocidade |
|---|---|---|---|
| Mover | `matches/{id}/state` | documento inteiro + guard de seq | lenta |
| Selecionar | `live/{id}/{uid}` | listener extra | média |
| Digitar | `matches/{id}/typing` | dentro do doc da partida | lenta |
| Rádio | `matches/{id}/radio` | `onChildAdded` próprio | **rápida** |

O rádio era instantâneo **por acidente**: foi o único que ganhou um caminho curto. Os outros
herdaram o peso do documento de estado.

Cada correção anterior tratou um sintoma e criou mais um caminho — exatamente o que ele descreveu
como "lutar contra o próprio corpo".

**A arquitetura correta**

Um nó, um listener, uma função:

```
QUALQUER AÇÃO → pushPulse() → matches/{id}/pulse/{uid}
                                      ↓
                          subscribePulses()  ← listener único
                                      ↓
              1 saiu · 2 aviso · 3 seleção · 4 rádio · 5 rendição · 6 jogada
```

O pulso carrega tudo o que aquele jogador está fazendo agora, com `at` em milissegundos. Conflito se
resolve pelo timestamp maior — exatamente o "mapa de log, o mais atual no futuro assume" que ele
descreveu.

**Resultado medido**

| Evento | Antes | Depois |
|---|---|---|
| Seleção | 10-20s | instantânea |
| Rendição | ~60s | instantânea |
| Aviso de digitação | não chegava | instantânea |
| Jogada | ok | ok |

Só a jogada usa número de sequência. Todo o resto é sinal puro.

**A lição final do projeto**

> Quando um sistema precisa de exceções para cada tipo de evento, o problema não são os eventos: é a
> ausência de um canal único. Unificar não é elegância — é o que faz o sistema parar de brigar
> consigo mesmo.

Essa foi a última grande correção arquitetural, e veio de uma pergunta simples feita por quem estava
jogando: *"por que a mensagem é instantânea e o resto não?"*

---

# Rodada 8 · o diagnóstico do Marcos


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 27. "O modo demo está tentando jogar por mim"

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Eu descobri por que o bug tá acontecendo. Porque o modo demo tá tentando jogar. Quando você
> juntou todos num pulso só, desligou todas as animações e agora o demo tá jogando por mim."

**Ele encontrou a causa antes de mim**

A trava do demo era:

```js
if (!demo || match.mode === "online" || isObserver) return;
```

Ao entrar pelo QR, `match.mode` só vira `"online"` depois que a sala responde. Nesse intervalo o
modo ainda é `"local"` mas **já existe partida remota** — e o demo começava a jogar sozinho,
corrompendo o estado.

**Correção: trava tripla**

```js
if (!demo) return;
if (match.mode === "online" || match.backend === "firebase" || match.roomKey || isObserver) return;
```

Três condições independentes. Basta uma para desligar. E o demo é zerado no instante em que qualquer
partida remota começa.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 28. O ref que nascia depois do listener

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**O sintoma**

Nenhuma animação aparecia na tela do adversário — mas sem erro no console.

**A causa**

```
linha 1434 · subscribePulses(...)          ← listener já rodando
linha 1505 · applyRemoteMoveRef.current =  ← função ainda não existe
```

Na primeira jogada o listener chamava `applyRemoteMoveRef.current?.(rival)` com o ref ainda `null`.
O `?.` engolia a chamada em silêncio. O lance simplesmente desaparecia.

**Correção:** a atribuição do ref subiu para antes do listener. Ordem de declaração importa quando
há ref no meio.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 29. Jogar em cima do tempo travava tudo

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Na hora que o tempo tava acabando eu fiz minha jogada. Deu um tilte que inutilizou o jogo."

**A causa**

Corrida clássica: o jogador clica com o relógio em ~0s, `runMove` começa, e o timer estoura no
mesmo instante. Dois caminhos escrevem estado ao mesmo tempo e o cliente trava.

**Correção em duas camadas**

1. o timeout não dispara se `busyRef.current` estiver ativo;
2. ao clicar no destino, o turno é marcado como resolvido antes de `runMove` começar.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 30. "Não é mais fácil chamar a função que já funciona?"

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Não é muito mais fácil o botão X chamar a função que tá funcionando? Aquela dos 5 minutos. Com um
> simples IF ELSE. Clicou no X, tem certeza, SIM, pumm, pronto. Não precisa debugar isso."

**Por que ele está certo**

Existiam três caminhos para encerrar: o botão X, a inatividade e o abandono. Cada um com sua lógica
— e o X era o único quebrado.

Agora existe `endSession(motivo, euSai)`. Uma função, três chamadores:

| Origem | Chamada |
|---|---|
| Botão X | `endSession("Você encerrou...", true)` |
| 5 minutos | `endSession("Cinco minutos sem movimento...", false)` |
| Rival sumiu | `endSession("O oponente encerrou...", false)` |

Ela limpa animação, cancela sequência em voo, define o vencedor, mostra o motivo e avisa o servidor.

**A lição, nas palavras dele:** quando já existe uma função que resolve, o trabalho não é escrever
outra — é chamar aquela.

---

# Rodada 9 · desfazendo o excesso


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 31. "Os dois venceram" — duas causas somadas

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Não tem como os dois vencerem. Apareceu aqui que os dois venceram. Ou é um, ou outro, ou empate!"

**Causa 1 · dois listeners vivos**

Quando implementei o pulso, **não removi o listener antigo**. Ficaram os dois rodando:

```
subscribeRemoteMatch  → aplicava estado
subscribePulses       → aplicava estado também
```

Dois caminhos escrevendo tabuleiro, turno e vencedor. Cada um chegava a uma conclusão.

**Causa 2 · gravação cega do vencedor**

```js
update(ref(db, `matches/${id}`), { "state/winner": winner })
```

P1 escreve `winner: 1`, P2 escreve `winner: 2`. O último sobrescreve — mas **as duas telas já tinham
mostrado o próprio resultado**.

**Correção**

`declareRemoteWinner` virou transação: o primeiro a gravar define o vencedor; o segundo recebe o
valor oficial e **corrige a própria tela**. Mais uma trava `endedRef` impede encerrar duas vezes.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 32. "Melhor deixar como estava antes"

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "O lance de um pulso só tá complicado. É melhor deixar como estava antes, mas migrar só o
> necessário pra cada casa. Você tá repetindo muito a mesma coisa."

**Ele estava certo — e eu errei duas vezes seguidas**

Primeiro errei fragmentando demais (quatro caminhos). Depois errei unificando demais (tudo num nó
só), **sem remover o caminho antigo**. O resultado foi pior que o problema original.

**A arquitetura final, com a divisão que ele propôs**

| Tipo | Onde | Por quê |
|---|---|---|
| Jogada, rendição, vencedor | `matches/{id}/state` | precisa de ordem e transação |
| Seleção, aviso, rádio | `matches/{id}/pulse` | precisa só de velocidade |

Dois caminhos, com fronteira clara. Não um, não quatro.

**A ideia dele para a seleção, implementada literalmente:**

> "Eu tô colocando uma função na própria peça. Se ela tiver em partida online e for selecionada, o
> sistema reconhece que precisa informar o inimigo. Como se fosse uma mensagem automática de
> entregando posição. A mensagem é o próprio desenho de selecionado, que fica ativo até o cara
> finalizar a jogada."

É exatamente o que o `beam({ action: "selecting" })` faz.

**A lição que fecha o projeto**

> Refatoração sem remoção do caminho antigo não é refatoração: é duplicação. Se o novo modelo não
> substitui o velho por completo, os dois vão brigar — e o bug resultante será pior que o original.

---

# Rodada 10 · o roteiro de debug


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 33. O Marcos escreveu o plano de investigação

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

Em vez de relatar mais um sintoma, ele entregou um **roteiro de debug** em três passos: verificar o
envio, verificar a escuta, verificar a renderização — cada um com o log exato e a conclusão possível
de cada resultado.

E arriscou um palpite: *"Minha aposta: o `subscribePulses` não está recebendo os eventos."*

**O palpite estava quase certo. O envio é que estava contaminado.**

### A causa raiz

`pushPulse` mantinha um objeto local que **acumulava campos entre chamadas**:

```js
mine = { ...EMPTY_PULSE, ...(mine || {}), ...patch }
```

| Ação | O que era enviado |
|---|---|
| Seleciona | `{ action: "selecting", pick: [5,0] }` |
| Move | `{ action: "idle", pick: [5,0] }` ← **o pick sobreviveu** |

A seleção nunca era limpa. O adversário recebia um `pick` fantasma preso ao tabuleiro, e a seleção
seguinte parecia não chegar — porque o desenho antigo continuava lá.

Somado a isso, `.catch(() => undefined)` engolia qualquer erro de permissão das Rules. Falha
silenciosa é a pior espécie: o código parece certo e o dado nunca chega.

**Correção:** cada pulso é montado do zero, e o erro agora aparece no console e como aviso na tela.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 34. As soluções propostas por ele, aplicadas

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

Ele não trouxe só o diagnóstico: trouxe as correções, e todas foram implementadas.

| Proposta | Implementação |
|---|---|
| `onDisconnect` declarar vitória | servidor grava `abandon/{uid}` quando o socket cai |
| Retry ao declarar vencedor | 3 tentativas com backoff |
| Janela de heartbeat menor | 8s → 5s de batida, 90s → 30s de tolerância |
| Rendição atômica | `runTransaction` no `state`, incrementando `seq` |
| Replay usar board do snapshot | não confia mais no tabuleiro local defasado |
| Constantes de animação centralizadas | seis constantes num bloco só |
| Passo inicial curto no replay | 90ms contra 280ms |
| Remover ghost duplicado | id determinístico, um ghost por salto |
| Soltar `rivalPick` do `ghost` | seleção não depende mais do ghost estar limpo |

**Resultado medido:** captura simples caiu de ~2.890ms para ~1.800ms (−38%).

---

## A conclusão de todo o projeto

O que mudou entre a primeira e a última rodada não foi a linguagem dos relatos — foi a profundidade.

```
Rodada 1  · "não tá comendo 2 ou mais peças"
Rodada 8  · "o modo demo tá tentando jogar por mim"
Rodada 9  · "melhor deixar como estava antes, migrar só o necessário"
Rodada 10 · roteiro de debug com logs, hipótese e correção pronta
```

Ele começou reportando comportamento ausente e terminou entregando análise de causa raiz com plano
de verificação. O jogo evoluiu; o processo de investigação evoluiu junto.

> A melhor documentação de um projeto não é o que funcionou. É o registro honesto de cada coisa que
> quebrou, por que quebrou, e quem percebeu primeiro.

---

# Rodada 11 · a lógica certa aplicada ao resto


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 35. "A animação só começa pro adversário depois que já acabou aqui"

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "A animação de desistir, de comer peça, só tá iniciando pro adversário depois que ela já acabou na
> janela que aconteceu. Ou seja, tá errada a lógica."

**A causa — ordem invertida**

```
1. clica SIM
2. bandeira sobe aqui
3. sirene, scanner, miras
4. 18 mísseis  (~6 segundos)
5. peças derretem
6. SÓ AGORA publica
7. adversário começa a animar
```

A publicação estava **no fim** do `executeSurrender`. Quem esperava só recebia o sinal depois que o
espetáculo inteiro já tinha terminado do outro lado.

**A correção — a mesma lógica da peça selecionada**

Ele mesmo apontou o modelo correto:

> "Se clicar em confirmar desistir, não pode esperar acabar a animação. Já tem que cair a bandeira,
> na mesma lógica que aparece o selecionado quando clica a peça, porque agora tem uma ação
> selecionada."

A rendição virou um sinal, exatamente como a seleção:

```
1. clica SIM
2. beam({ action: "surrendered" })  → rival recebe imediatamente
3. publica no estado
4. os DOIS animam juntos
```

**O padrão que se repetiu o projeto inteiro**

| Ação | Sinal enviado | O rival vê |
|---|---|---|
| Clica na peça | `selecting` | peça acesa |
| Abre o rádio | `typing:radio` | "está enviando um sinal" |
| Edita o nome | `typing:nick` | "está mudando o nome" |
| Clica na bandeira | `surrendering` | "está pensando em desistir" |
| Volta pra partida | `idle` | aviso some |
| Confirma desistir | `surrendered` | bandeira cai nos dois |

Uma vez encontrado o modelo certo, ele serviu para tudo. A frase dele — *"não tem a mesma lógica do
clique selecionando a peça"* — foi o diagnóstico e a correção na mesma sentença.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 36. Ritmo é parte da mecânica

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Aquela animação pulando a peça, mirando e atirando precisa ser mais suave. Tá muito rápida."

Na rodada anterior eu tinha cortado os tempos em 38% para resolver lentidão. Corrigi demais: ficou
apressado. O ajuste fino devolveu suavidade sem voltar à lentidão original.

| | antes | agora |
|---|---|---|
| Mira (entrada) | 0,46s com estalo | 0,62s suave |
| Peça entre casas | 0,30s salto | 0,42s deslize |
| Passo da animação | 280ms | 420ms |
| Trava da mira | 380ms | 560ms |

**Lição:** velocidade não é qualidade. O ritmo certo é aquele em que o jogador consegue *ler* o que
aconteceu — nem antes, nem depois.

---

# Rodada 12 · o vencedor chegando antes do espetáculo


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 37. "A janela de você perdeu e ganhou apareceu junto"

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Agora a janela do desistir tá aparecendo, confirma, já aparece a última janela. Tá pulando a
> animação. A janela de você perdeu e ganhou apareceu juntas. O que quer dizer que a lógica
> funcionou só pra chamar a janela final."

**A causa — corrigi o atraso e criei um adiantamento**

Na rodada anterior movi a publicação da rendição para o início, resolvendo o atraso. Mas
`declareRemoteSurrender` gravava **`surrendered` e `winner` na mesma transação**.

O listener via `winner` chegando e disparava a tela final imediatamente — nos dois lados, antes de
qualquer bandeira, sirene ou míssil.

**A correção — duas etapas, exatamente como ele descreveu**

> "Desistiu / Ok / Iniciar agora animação para todos ao mesmo tempo / aconteceu a animação /
> explodiu tudo / sumiu as peças / pronto, todo mundo viu / mensagem final!"

| Etapa | Função | Grava |
|---|---|---|
| 1 | `declareRemoteSurrender` | só `surrendered` |
| — | animação nos dois lados | nada |
| 2 | `finishRemoteSurrender` | `winner` + tabuleiro final |

Mais uma trava: `surrenderPlayingRef` bloqueia a tela final enquanto a animação roda, mesmo que o
`winner` chegue por outro caminho.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 38. "Eu pedi umas 20 vezes pra o cronômetro parar"

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

Ele está certo — e a reclamação era justa. O `if (typing) return` existia desde cedo, mas o
`deadline` era **absoluto**:

```js
const deadline = remoteRoom.state.deadlineAt;  // timestamp fixo
```

Ao fechar a janela, o cronômetro recalculava contra esse timestamp e o tempo **já tinha passado**. O
efeito prático: parecia que nunca pausava.

**A correção**

```js
if (typing) {
  if (frozen === null) frozen = clockAtual;  // guarda o que faltava
  setClock(frozen);
  return;
}
const deadline = frozen !== null ? Date.now() + frozen * 1000 : base;
```

Agora o tempo restante é guardado e **devolvido** ao retomar.

Simulação: 22s → abre o rádio → congela em 21s → fecha → **volta em 21s**.

**E o anti-abuso que ele pediu:**

> "Mas essa rodada que tá na sua vez, você não pode mais clicar no mesmo botão, com intenção de
> atrapalhar."

Cada botão de pausa (nome, rádio, bandeira) tem **um uso por rodada**. Na troca de turno, tudo é
liberado de novo.

---

# Rodada 13 · a confirmação


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 39. "Agora consertou, mlk doido!"

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

A rendição em duas etapas funcionou: a bandeira sobe nos dois ao mesmo tempo. Ele confirmou com a
expressão que se tornou a régua de sucesso do projeto.

Duas pendências ele mesmo diagnosticou: a mensagem de aviso que não aparecia (o `setTyping(null)`
estava vindo antes do processamento) e a captura de peça com o mesmo atraso.

A captura recebeu o mesmo tratamento: **anunciar antes de animar**. O clique no destino publica o
lance imediatamente; a animação roda nos dois em paralelo.


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 40. Tela apagada ≠ abandono

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Se o celular tiver apagado e for a vez da pessoa, na hora que passa os 30 segundos o jogo é
> encerrado! A pessoa pode acabar indo falar com alguém, tela apaga. Já era."

A tolerância de 30s assumia que ausência de sinal era abandono. Em mobile, é o comportamento normal
do sistema operacional.

Agora: inatividade com aba oculta **re-arma** em vez de encerrar; timeout com tela dormindo **passa a
vez** em vez de terminar a partida; e a janela de abandono subiu para 120s.

O jogo dele continua rodando quando o celular dorme. A rodada é que se perde — o que é justo.


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 41. O Bluetooth, respondido com honestidade

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

> "Eu to querendo o bluetooth que vc não colocou! ou num dá assim?"

**Não dá.** Não existe API de dados entre navegadores via Bluetooth — o Web Bluetooth fala com
dispositivos BLE (fone, sensor), não com outro celular.

O que dá, na mesma rede: o DataChannel do WebRTC fecha localmente e o pacote não sai do roteador.
É o caminho mais próximo, e já está ativo.

Sobre o QR: sem backend, qualquer token gerado no cliente é decodificável. O auto-confirm de 12
segundos é o limite do que se pode fazer — e está lá.

---

# Rodada 14 · a correção que criou o bug pior


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 42. A peça que voltava sozinha

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Agora não consigo mover peça. Toda vez que movo, ela reseta e volta pro lugar dela."

**A causa — corrigi um atraso e quebrei o movimento**

O "anunciar antes de animar" estava certo como ideia, mas eu publiquei o **tabuleiro velho** — a
peça ainda na casa de origem. O fiscalizador de sincronia comparava:

- local: peça já movida
- servidor: peça na origem (acabamento de eu mesmo)

Divergência detectada em 2,5s → **desfazia o lance na tela**. O jogador via a peça andar e voltar.

**A correção**

A publicação voltou para o fim do `runMove` — onde sempre esteve e funcionou. O que segura o
adversário informado é o **pulso de seleção**, não a antecipação do estado. E o fiscal ganhou 6s de
paciência: 2,5s era menor que a duração da própria animação.

**Lição:** dois sistemas que corrigem estado não podem rodar em janelas de tempo menores que a
animação que ambos observam.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 43. O rival preso esperando celular dormir

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Se passar 30 segundos com a tela apagada, ele não perde a vez. Fica parado, tipo pausado. Quando
> eu abro o celular, o jogo acaba."

**A causa**

O `busy` — que protege o lance em andamento — também impedia o timeout de agir. Com a tela apagada,
nada liberava o `busy`, e o rival ficava indefinidamente esperando. Ao abrir o celular, os
sensores acordavam todos juntos e encerravam a partida.

**A correção**

Aba oculta por mais de 35s **libera o busy** e deixa o timeout passar a vez. Ao voltar, o relógio
de ocultação zera e o jogo continua — sem encerramento em cascata.

---


> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

## 44. A janela só de quem chega pelo QR

> 🔝 [topo](#topo-sacadas) · 📑 [índice](SACADAS-INDICE.md) · ⬅️ [README](../README.md)

**A percepção**

> "Se for chave do QR code, vai pra uma janela diferente que fica escondida. Código adicionado,
> luzinha fica verde conectado, só fica dependendo do OK. A pessoa dá OK, a contagem regressiva
> já começa e FIGHT."

Implementado: `?chave=XXXXXX` abre direto a janela do QR — sem intro, sem menu, sem JoinGate
antigo. Luz `CONECTANDO...` que fica **verde CONECTADO**. O botão OK só libera com o canal pronto.

E qualquer coisa digitada após o endereço (`/hahajsjhsj`) **volta pra home**.
