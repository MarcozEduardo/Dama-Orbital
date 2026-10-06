# Damas Orbitais: da primeira daminha a uma guerra orbital

## Estudo de caso sobre direção criativa, prototipação e orquestração com IA

**Direção e propriedade criativa:** Marcos Eduardo  
**Implementação assistida por IA:** Codex  
**Sessão registrada:** aproximadamente 21h30 até 03h34  
**Projeto:** *Damas Orbitais*, spin-off de *A Viagem de Bobby* e herdeiro da engine narrativa de *A Fuga de Bobby*

---

## Resumo executivo

Este projeto começou com um jogo de damas funcional, mas visualmente simples: tabuleiro em CSS, peças circulares com gradiente, uma coroa para representar a dama e uma rotação básica de 180 graus.

Em uma única sessão longa de direção criativa, Marcos Eduardo conduziu a transformação desse protótipo em um pequeno espetáculo de arcade:

- motor de damas brasileiras com captura obrigatória e combos;
- sprites pixel art em duas perspectivas;
- plataforma orbital que gira conforme o ponto de vista do jogador;
- damas blindadas com salvas de mísseis;
- marcas de guerra que envelhecem no piso;
- cutscene com Bobby e Marcão;
- áudio sintetizado em tempo real;
- rendição cinematográfica;
- IA de risco e modo contra a máquina;
- menu diegético em forma de painel militar;
- chave diplomática, QR Code, observador, rádio e esqueleto do multiplayer.

O ponto central do case não é apenas o volume de funcionalidades. É o método de trabalho: Marcos não tratou a IA como uma geradora de páginas. Ele atuou como diretor, testador, roteirista, produtor e guardião da experiência.

> A evolução não veio de um prompt gigante. Veio de uma sequência de testes, críticas visuais, correções de ritmo e decisões de produto.

---

## O universo antes do tabuleiro

### A Fuga de Bobby

O ponto de partida narrativo é *A Fuga de Bobby*. Bobby é um robô que atravessa plataformas enquanto foge do planeta de Socram. Durante a fuga, ele perde seus soldados e termina sozinho diante do antagonista.

Socram tenta escapar, cai na própria armadilha e explode. Uma chave fica para trás. Bobby recolhe essa chave, abre uma estação de telecomunicação e consegue pedir socorro. Um foguete chega para salvá-lo.

### A Viagem de Bobby

No jogo seguinte, o foguete deixa de ser apenas resgate e vira arma. Bobby atravessa o universo e o cinturão de asteroides. Depois de diversas batalhas, os computadores de bordo finalmente localizam a Terra. O foguete aponta para o planeta e inicia a descida.

### Damas Orbitais

O spin-off nasce no espaço entre a vitória e o pouso. Restou uma última resistência: rebeldes remanescentes do Império de Socram bloquearam a rota da Aliança.

O conflito passa a ser representado por um tabuleiro orbital 8x8. Cada movimento não é apenas um lance de damas; é uma manobra militar condensada.

---

## A primeira daminha

A primeira versão da dama era honesta e mínima: a mesma peça circular ganhava uma coroa. Tecnicamente, ela já deslizava pelas diagonais e respeitava a regra de não andar nos eixos X e Y.

Ela funcionava.

Mas ainda não tinha presença.

Marcos percebeu que a dama não podia ser só uma peça comum com um símbolo em cima. A promoção precisava parecer uma mudança de categoria. A partir dessa observação, a daminha evoluiu em etapas:

1. ganhou uma coroa pixel art;
2. recebeu um brilho próprio;
3. passou a ocupar mais espaço visual;
4. ganhou blindagem pesada, pistões e pods de mísseis;
5. recebeu sprites próprios de frente e de costas;
6. passou a disparar quatro mísseis para cada peça capturada;
7. sua promoção ganhou uma placa holográfica com a mensagem "OPA!!! TEMOS DAMA";
8. a placa passou a desintegrar em partículas que viajam até a nova dama;
9. o tempo da transformação foi revisado para que o nome "Portfólio Marcos Eduardo" pudesse ser lido sem pressa.

Essa evolução resume todo o processo: primeiro a mecânica, depois a leitura, depois a personalidade e finalmente o ritmo.

---

## O primeiro problema real: "não está comendo duas ou mais peças"

O protótipo original parecia possuir captura múltipla, mas uma diagonal estava quebrada. No vetor de direções havia um elemento `[5]` onde deveria existir `[1, 1]`.

O erro técnico foi descoberto por um teste comportamental simples de Marcos:

> "Não tá comendo 2 ou mais peças."

Essa frase foi mais importante que um stack trace. Ela descreveu a falha a partir da experiência do jogador.

O motor foi então separado da interface e reescrito em `src/game/engine.ts`, com:

- quatro diagonais válidas;
- peão capturando para frente e para trás;
- captura obrigatória;
- cadeia de capturas;
- dama voadora;
- promoção;
- detecção de jogador sem movimentos;
- funções puras, testáveis e reutilizáveis no futuro servidor.

Depois disso, as regras deixaram de ser um detalhe dentro do componente visual e viraram a fundação do produto.

---

## Como Marcos orquestrou a IA

### 1. Ele dirigiu sensações, não componentes

Em vez de pedir "adicione uma animação CSS de 700ms", Marcos descreveu o que o jogador deveria sentir:

- a peça precisa sair "um tiquinho" do lugar;
- o tabuleiro não pode parecer perfeitamente simétrico;
- a peça capturada deve derreter;
- o piso deve carregar as cicatrizes da guerra;
- a dama precisa parecer mais parruda;
- o giro não pode deixar o jogador tonto;
- o som precisa parecer uma plataforma pesada freando.

A implementação nasceu dessas imagens mentais.

### 2. Ele testou o tempo, não apenas a existência

Uma feature existir não significava que estava pronta.

O giro funcionava, mas girava rápido demais. A placa holográfica aparecia, mas o nome não dava tempo de ser lido. O combo automático estava correto, mas desorientava. A cutscene avançava, mas não permitia reler uma mensagem perdida.

Marcos revisou cada uma dessas áreas como direção de montagem:

- desacelerou o giro;
- transformou o motor em três tempos: "raaam, raaam, ram, tiisss";
- colocou freios visuais com sete faíscas de um lado e cinco do outro;
- deu pausa entre cada alvo de um combo;
- introduziu scanner antes da barragem;
- acrescentou navegação para voltar e reler diálogos;
- colocou dois segundos de armamento antes do botão de entrada.

O resultado não é apenas mais bonito. É mais legível.

### 3. Ele autorizou experimentos com direito a cancelamento

Uma das falas que melhor define o processo foi:

> "Quero testar. Se ficar paia, a gente cancela esse método."

Esse comportamento reduziu o custo psicológico de experimentar. O wobble, o giro em perspectiva, as marcas de guerra e o primeiro míssil rasante nasceram como hipóteses.

O míssil rasante, por exemplo, foi posteriormente rejeitado por não fazer sentido narrativo. Ele foi substituído por uma mira que crava em cada alvo antes da barragem final.

Não houve apego ao trabalho já feito. Houve apego ao resultado.

### 4. Ele antecipou falhas de produção

Antes mesmo de o jogo ganhar todos os sprites, Marcos levantou preocupações que normalmente aparecem tarde:

- fallback caso o sprite não carregue;
- cache interno para reduzir o tempo de boot;
- peso dos PNGs;
- conflito entre efeitos de áudio;
- proteção de arte fora do GitHub;
- autenticação e persistência futuras;
- comportamento em celular;
- observadores e reconexão.

O pipeline final passou a incluir chroma-key por flood-fill, fallback procedural, cache em IndexedDB e otimização dos assets de aproximadamente 25 MB para cerca de 427 KB.

### 5. Ele usou linguagem de produto

Marcos não discutiu apenas "multiplayer". Ele definiu papéis e rituais:

- a sala virou uma **Chave Diplomática**;
- o terceiro participante virou **Observador**;
- a comunicação virou **Rádio de Combate**;
- o código não é colado, é **injetado no painel do Marcão**;
- o oponente não é só P2: é o lado de Socram;
- o jogador que se rende levanta uma bandeira e aceita uma execução militar.

Isso fez a interface crescer a partir do universo, em vez de parecer um menu genérico colocado por cima do jogo.

### 6. Ele separou espetáculo de regra

Quando pediu centenas de mísseis ao longo das simulações, Marcos também exigiu que a regra continuasse fechada.

Essa distinção gerou duas camadas:

- `engine.ts` decide o que aconteceu;
- React, canvas e áudio decidem como aquilo será apresentado.

No multiplayer, essa separação será ainda mais importante: a rede envia um evento pequeno; cada dispositivo reproduz localmente a mesma explosão.

---

## Linha do tempo da evolução

### Fase 0: protótipo

- HTML, CSS e JavaScript em um único arquivo;
- peças em gradiente;
- tabuleiro plano;
- giro de 180 graus;
- dama representada por coroa;
- bug em uma diagonal de captura.

### Fase 1: identidade visual

- migração para React, Vite e Tailwind;
- sprites pixel art azul e vermelho;
- frente e costas para respeitar o ponto de vista;
- tabuleiro procedural;
- wobble e assimetria controlada;
- estrelas de veterana;
- áudio sintetizado.

### Fase 2: guerra no tabuleiro

- mísseis teleguiados;
- explosões e screen shake;
- peças derretendo;
- peças capturadas voando para a bancada;
- marcas de guerra que envelhecem;
- dama blindada pesada;
- salva de quatro mísseis por alvo;
- scanner e miras numeradas.

### Fase 3: narrativa

- cutscene Bobby e Marcão;
- máquina de escrever;
- boca analógica do Bobby;
- retrato SNK do Marcão;
- loading escondido dentro da narrativa;
- contagem regressiva e FIGHT;
- placa holográfica de promoção.

### Fase 4: ritmo e rendição

- giro industrial desacelerado;
- motor rangendo e freios;
- confirmação contextual de desistência;
- bandeiras em todas as peças;
- sirene;
- execução com três mísseis por peça inimiga;
- aniquilação automática quando não existem movimentos.

### Fase 5: inteligência e modos

- minimax com poda alfa-beta;
- avaliação de risco;
- observador silencioso;
- modo contra a máquina desbloqueável;
- menu em forma de painel físico;
- QR Code;
- rádio moderado;
- cronômetro online;
- estrutura local de salas e assentos.

### Próxima fase: conexão real entre dispositivos

- Firebase Realtime Database para sala, estado e presença;
- WebRTC/Trystero para canal direto;
- fallback automático pela própria RTDB;
- TURN para redes restritivas;
- reconexão sem perder a partida;
- validação autoritativa do lance.

---

## O método de teste

### Teste humano

Marcos joga, observa e relata a experiência em linguagem direta:

- "não comeu";
- "girou rápido";
- "não deu tempo de ler";
- "esse míssil veio do nada";
- "o jogador ficou desorientado";
- "no celular isso vai ficar pequeno";
- "a inteligência está aceitando desistência cedo demais".

Esse tipo de QA encontra problemas que testes unitários não encontram: ritmo, intenção, leitura e coerência narrativa.

### Teste automatizado

O processo também ganhou uma segunda camada:

- testes de regras isoladas;
- simulações de centenas de partidas;
- verificação de capturas fantasmas;
- garantia de que nenhuma peça aliada é capturada;
- medição de cadeias de captura;
- IA contra jogador aleatório;
- partidas IA contra IA;
- testes de falsos positivos na sugestão de rendição;
- testes de chave, assento, observador e serialização;
- testes de moderação do rádio.

Um exemplo importante: a primeira versão do observador silencioso sugeriu rendição incorretamente 11 vezes em uma amostra longa. As travas foram endurecidas até atingir zero falsos positivos com três ou mais peças em 7.859 lances simulados.

---

## Decisões que definem o produto

### A dama precisa mudar de categoria

Promoção não é troca de ícone. É um evento cinematográfico e mecânico.

### O tabuleiro é personagem

Ele gira, range, freia, solta faíscas, acumula cicatrizes e muda o ponto de vista da partida.

### O multiplayer não deve transmitir vídeo

Cada cliente renderiza seus próprios efeitos. A rede transmite apenas estado e eventos pequenos.

### A conexão não pode ter um único ponto de falha

O canal P2P acelera. O Firebase mantém a verdade e segura a partida. O cache local preserva a fila. O TURN cobre redes fechadas.

### A interface deve pertencer ao universo

Botões são controles físicos. Mensagens são rádio. Código é chave diplomática. Loading é sincronização orbital.

---

## Resultado

Ao final da sessão, a primeira daminha já não existia como um detalhe do tabuleiro. Ela havia se tornado uma unidade blindada, com transformação própria, identidade visual, trilha sonora, poder diferenciado e função narrativa.

O jogo também deixou de ser apenas uma demonstração de damas. Virou uma continuação coerente do universo de Bobby e a primeira experiência multiplayer da franquia.

O principal resultado, porém, foi o processo:

> Marcos Eduardo não usou IA para receber uma entrega pronta. Ele conduziu a IA por ciclos de visão, protótipo, teste, rejeição, refinamento e validação.

Essa é a diferença entre pedir uma interface e orquestrar uma obra.

E, como ficou claro durante as seis horas de trabalho: ele não estava ali para brincadeira.

---

## Créditos do case

- **Conceito, universo, roteiro e direção criativa:** Marcos Eduardo
- **Direção de experiência, ritmo e QA:** Marcos Eduardo
- **Arquitetura e implementação assistida:** Codex
- **Inspirações visuais declaradas:** Metal Slug, Mega Man, terminais SNK e arcades 16-bit
- **Base narrativa:** *A Fuga de Bobby* e *A Viagem de Bobby*
