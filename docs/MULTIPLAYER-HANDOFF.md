# Handoff cirúrgico: multiplayer real entre dispositivos

## Decisão técnica para a Chave Diplomática

**Status deste documento:** decisão pronta para implementação  
**Status do código atual:** protótipo local de salas; ainda não conecta dois aparelhos pela internet  
**Meta:** celular, desktop e observador na mesma partida, sem perder o jogo quando um canal oscilar

---

## Resposta curta

A arquitetura recomendada é híbrida:

1. **Firebase Realtime Database no plano Spark** guarda sala, assentos, presença, relógio, evento e último estado confirmado.
2. **WebRTC DataChannel via Trystero** envia lances e rádio diretamente entre os navegadores quando possível.
3. **Firebase RTDB também funciona como fallback quente de transporte.** Se o P2P falhar, a mesma partida continua pelo listener do Firebase.
4. **Cloudflare Realtime TURN** cobre NAT e firewall restritivos; se o TURN falhar, o fallback RTDB ainda mantém o jogo jogável.
5. **IndexedDB** guarda a fila local até o ACK voltar. Recarregar a página não perde o último lance enviado.

Não é necessário transformar o celular em servidor. O app continua sendo um site estático hospedado em HTTPS.

---

## Por que essa combinação

### Firebase Realtime Database, não apenas Firestore

Para esta fase, RTDB combina melhor com a partida porque oferece nativamente:

- stream em tempo real;
- reconexão automática do SDK;
- `/.info/connected` para saber se este cliente está ligado ao Firebase;
- `onDisconnect()` executado pelo servidor mesmo se o navegador travar;
- `serverTimestamp()`;
- `/.info/serverTimeOffset` para o cronômetro de 30 segundos;
- transações para disputar assentos e confirmar sequência de lances.

No plano Spark, a documentação oficial indica:

- 100 conexões simultâneas;
- 1 GB armazenado;
- 10 GB baixados por mês.

Para um jogo que transmite algo em torno de centenas de bytes por lance, isso é suficiente para protótipo e portfólio. O limite prático inicial será de aproximadamente 30 partidas simultâneas com dois jogadores e um observador em cada uma, antes de considerar abas extras.

### Trystero sobre WebRTC

Trystero fornece salas e ações sobre WebRTC. Ele aceita Firebase como meio de signaling e mantém a comunicação do jogo diretamente entre os peers depois do encontro.

Usos neste projeto:

- `move-intent`: proposta de lance;
- `move-commit`: confirmação rápida;
- `radio`: mensagem de combate;
- `presence-ping`: medição de latência;
- `state-request` / `state-response`: ressincronização direta;
- `surrender`: pedido de rendição;
- `timeout`: aviso de relógio expirado.

### Firebase continua sendo necessário mesmo com P2P

P2P sozinho é rápido, mas não guarda memória da partida e não decide quem é P1, P2 ou observador quando vários peers chegam juntos.

O Firebase resolve:

- unicidade da chave;
- reserva atômica das cadeiras;
- entrada de observador;
- persistência do último estado;
- retorno depois de refresh;
- presença;
- expiração;
- arbitragem de `seq`;
- fallback quando o DataChannel fecha.

---

## Arquitetura final

```text
                              CONTROLE / VERDADE
                      +--------------------------------+
                      | Firebase Realtime Database     |
                      | sala, assentos, seq, estado,   |
                      | presença, deadline, rádio      |
                      +-------+---------------+--------+
                              |               |
                        listener RTDB     listener RTDB
                              |               |
                    +---------v---+       +---v---------+
                    | Jogador P1  |=======| Jogador P2  |
                    | Bobby       | P2P   | Socram      |
                    +------+------|=======+------+------+
                           |                     |
                           +----------+----------+
                                      |
                             WebRTC DataChannel
                         direto ou relayed por TURN

 Observadores: recebem o stream de estado/eventos pela RTDB.
 Não entram na malha P2P dos jogadores.
```

### Regra de ouro

**O P2P é o caminho rápido; a RTDB é a verdade durável.**

Nenhum efeito visual é autoritativo. Míssil, giro, fumaça e holograma são reproduções locais de um evento confirmado.

---

## Os dois fallbacks pedidos

### Caminho principal: WebRTC direto

- Latência mínima.
- Comunicação end-to-end encrypted pelo próprio WebRTC.
- Depois do signaling, o payload do jogo não passa pelo Firebase.
- Ideal para lance, rádio e ACK imediato.

### Fallback 1: Firebase RTDB como transporte

Se `peerConnection.connectionState` virar `failed` ou o ACK P2P não chegar:

1. o cliente mantém a mesma sala;
2. escreve o evento em `/matches/{matchId}/events/{seq}`;
3. o oponente recebe por `onChildAdded`;
4. a interface mostra `CANAL RESERVA`;
5. a partida continua sem exigir refresh.

Isso é mais importante que o TURN. Mesmo se WebRTC não funcionar naquela rede, o jogo continua sendo um multiplayer comum cliente-servidor pelo Firebase.

### Fallback 2: fila local em IndexedDB

Se Firebase e P2P ficarem indisponíveis ao mesmo tempo:

- não inventar estado;
- pausar o relógio visual;
- mostrar `REESTABELECENDO ROTA`;
- armazenar o evento pendente em IndexedDB;
- manter `baseSeq`, `eventId` e `stateHash`;
- reenviar quando qualquer canal voltar;
- remover da fila somente depois do ACK autoritativo.

O jogo não continua às cegas. Ele preserva a jogada e espera reconciliação.

### Proteção adicional: TURN

TURN não substitui o Firebase. Ele ajuda o WebRTC a atravessar NAT simétrico e firewall.

Recomendação atual:

- **STUN:** `stun.cloudflare.com`, gratuito segundo a documentação da Cloudflare;
- **TURN:** Cloudflare Realtime TURN;
- a documentação consultada informa uma camada gratuita de 1.000 GB antes de cobrança;
- o jogo envia tão poucos dados que o consumo será desprezível.

Importante: a credencial TURN deve ser temporária. O token secreto da Cloudflare nunca pode ser colocado no bundle React. Uma Cloudflare Worker pequena deve gerar credenciais com validade curta. Se essa Worker cair, o jogo ainda tenta P2P com STUN e depois usa RTDB.

---

## Máquina de estados da conexão

```ts
type LinkState =
  | 'CONNECTING'
  | 'DIRECT'          // WebRTC P2P
  | 'RELAYED'         // WebRTC por TURN
  | 'DATABASE'        // Firebase RTDB transportando o jogo
  | 'RECONNECTING'    // nenhum canal com ACK no momento
  | 'PAUSED'
  | 'CLOSED'
```

### Regras de transição

| Estado atual | Evento | Próximo estado |
|---|---|---|
| CONNECTING | DataChannel abre | DIRECT ou RELAYED |
| CONNECTING | 8s sem peer, RTDB conectado | DATABASE |
| DIRECT | DataChannel fecha | RECONNECTING |
| RECONNECTING | RTDB conectado | DATABASE |
| DATABASE | P2P volta e hashes batem | DIRECT/RELAYED |
| Qualquer | nenhum ACK por 5s | RECONNECTING |
| RECONNECTING | 45s sem canal | PAUSED |
| PAUSED | canal volta | resync e estado adequado |
| Qualquer | partida expirada/finalizada | CLOSED |

O relógio do turno deve parar enquanto a partida estiver em `RECONNECTING` ou `PAUSED`.

---

## Protocolo de evento

Nunca enviar o tabuleiro inteiro como única intenção de jogada. Enviar a jogada e deixar o motor validar.

```ts
interface MatchEvent {
  eventId: string;       // uid + contador local; idempotência
  matchId: string;
  seqExpected: number;
  actorUid: string;
  actorSeat: 'p1' | 'p2';
  kind: 'MOVE' | 'SURRENDER' | 'TIMEOUT' | 'RADIO';
  payload: unknown;
  sentAt: number;
  baseHash: string;      // hash do estado que originou a intenção
}

interface MovePayload {
  from: { r: number; c: number };
  to: { r: number; c: number };
}

interface Commit {
  eventId: string;
  seq: number;
  board: string;         // 64 chars
  turn: 1 | 2;
  captures: { r: number; c: number }[];
  promoted: boolean;
  deadlineAt: number;
  stateHash: string;
}
```

### Idempotência

O mesmo `eventId` recebido por P2P e RTDB deve ser aplicado uma única vez.

Manter em memória e IndexedDB os últimos 128 IDs processados.

---

## Fluxo de um lance resiliente

1. O jogador toca na casa.
2. O cliente valida localmente para feedback imediato.
3. Cria `MOVE(eventId, seqExpected, baseHash)`.
4. Envia pelo P2P, se aberto.
5. Escreve a intenção na RTDB ou confirma por transação, dependendo da fase de segurança.
6. O lado autoritativo roda `engine.ts`.
7. Gera `Commit` com novo `seq` e `stateHash`.
8. Ambos reproduzem mísseis e efeitos a partir do `Commit`.
9. IndexedDB remove o evento pendente depois do ACK.

### MVP gratuito

Na primeira versão real entre aparelhos, o host pode validar e publicar o commit, com RTDB garantindo ordem e recuperação. Isso não é totalmente antitrapaça, mas já entrega o multiplayer.

### Versão endurecida

Mover a validação para uma Cloud Function ou Worker:

- receber a intenção;
- carregar o estado atual;
- rodar `engine.ts` no servidor;
- rejeitar lance ilegal;
- gravar commit atomizado.

Firebase Cloud Functions não está incluído no Spark da mesma forma que o banco. Para continuar sem cartão, implementar primeiro o MVP; para produção antitrapaça, considerar Blaze com orçamento/alertas ou uma Worker com cota gratuita.

---

## Modelo sugerido na RTDB

```text
/keys/{shortCode}
  matchId
  createdAt
  expiresAt

/matches/{matchId}
  meta/
    status: waiting | playing | reconnecting | finished | expired
    createdAt
    expiresAt
    hostUid
    guestUid
    winner
  players/
    p1: { uid, nick, connected, lastSeen }
    p2: { uid, nick, connected, lastSeen }
  observers/{uid}: { nick, connected, joinedAt }
  state/
    seq
    board
    turn
    deadlineAt
    stateHash
    lastEventId
  events/{seq}/
    eventId
    kind
    actorUid
    payload
    committedAt
  radio/{messageId}/
    uid
    text
    createdAt
```

Não manter arrays grandes dentro de `match`. Usar filhos por ID para evitar regravar o documento inteiro.

---

## Chave Diplomática

### O que existe hoje

`src/game/net.ts` gera uma chave local de seis caracteres e verifica colisão apenas no `localStorage`.

Isso serve como protótipo visual. Não garante unicidade global.

### O que deve existir online

1. gerar candidato com o alfabeto sem `0/O/1/I/L`;
2. executar `runTransaction(ref(db, 'keys/' + code))`;
3. se o nó for `null`, reservar com `matchId`, `createdAt` e `expiresAt`;
4. se já existir, gerar outro candidato;
5. depois de finalizada/expirada, a chave nunca é reutilizada dentro da janela de retenção.

O servidor jamais "escolhe" um código já emitido. A transação decide a colisão.

---

## Assentos

### Identidade

- ativar Firebase Auth anônimo;
- `uid` anônimo é a identidade real da cadeira;
- manter `deviceId` apenas como trava de UX contra abrir duas abas;
- nunca confiar em `deviceId` para segurança; ele é editável pelo usuário.

### Regra

- criador: P1 / Aliança Bobby;
- primeiro UID diferente: P2 / lado de Socram;
- demais UIDs: observadores;
- reconexão do mesmo UID recupera a cadeira;
- observador não pode escrever `MOVE`, `SURRENDER` ou `RADIO`.

O claim de P2 precisa ser uma transação. Dois convidados chegando no mesmo milissegundo não podem ocupar a mesma cadeira.

### Modo Observador

Observadores devem ouvir RTDB. Não conectar cada observador à malha P2P dos jogadores.

Razões:

- WebRTC mesh cresce uma conexão por observador;
- um observador lento não pode prejudicar o jogador;
- RTDB já possui o último estado;
- entrada tardia precisa de snapshot, não de histórico P2P.

Se alguém escolher "Observador" e só houver o host, a regra de produto manda promovê-lo a P2, pois não existe partida para observar.

---

## Presença e reconexão

### No login da sala

1. ouvir `/.info/connected`;
2. antes de marcar online, registrar `onDisconnect(presenceRef).set({ connected: false, lastSeen: serverTimestamp() })`;
3. marcar `connected: true`;
4. manter listener real na sala;
5. publicar heartbeat leve a cada 15s apenas se necessário.

### Janela de tolerância

- até 5s: não mostrar erro; apenas LED amarelo;
- 5-15s: `REESTABELECENDO ROTA`;
- 15-45s: pausar cronômetro e manter a cadeira;
- após 45s: permitir ao outro jogador esperar ou reivindicar vitória por abandono;
- se o UID voltar antes do encerramento, ressincronizar e continuar.

### Ressincronização

Comparar:

- `seq` local e remoto;
- `stateHash`;
- último `eventId` aplicado.

Se divergirem, a RTDB vence. O cliente substitui o estado lógico e apenas então volta a aceitar input.

---

## Cronômetro online

O relógio atual de `src/App.tsx` é local. Na versão online real, ele não pode decidir timeout sozinho.

Usar:

```ts
deadlineAt = serverTimestamp + 30_000
remaining = deadlineAt - (Date.now() + serverTimeOffset)
```

Quando chegar a zero, qualquer cliente elegível tenta uma transação:

```text
se state.seq continua igual
e state.deadlineAt expirou
então commit TIMEOUT e troca o turno
```

Se dois clientes tentarem ao mesmo tempo, apenas uma transação vence.

---

## Rádio de combate

O filtro atual em `src/components/RadioBox.tsx` é client-side e serve para UX. No online real, repetir o filtro no lado autoritativo.

Regras:

- máximo de 40 caracteres;
- uma mensagem a cada 5s;
- observador não envia;
- bloquear URL, palavrão e spam;
- preservar `kkkkkk` e `hahaha`;
- guardar no máximo as dez últimas mensagens por partida;
- mensagens expiram visualmente em cinco segundos;
- ancorar na última peça viva movimentada pelo remetente;
- se ela morreu, procurar a última peça viva dele;
- se nenhum lance ocorreu, usar a fileira frontal.

O rádio deve ser um evento independente de `seq` da partida. Ele não pode bloquear ou reordenar lances.

---

## Segurança mínima no Firebase

### Configuração web não é segredo

`apiKey`, `authDomain`, `databaseURL` e `projectId` do Firebase Web aparecem no bundle por design. A segurança vem de Auth, App Check e Security Rules.

### Regras essenciais

- negar tudo por padrão;
- exigir `auth != null`;
- permitir leitura da sala apenas para P1, P2 e observadores registrados;
- permitir rádio apenas para P1/P2;
- permitir intenção apenas para o UID da vez;
- validar tamanho e tipo dos campos;
- limitar nick e texto;
- impedir escrita direta em `winner`, `seq` e `board` quando a validação for migrada ao servidor.

Não usar regras abertas em produção.

### App Check

Ativar App Check na fase de publicação para reduzir scripts externos abusando da RTDB. App Check não substitui autenticação nem validação de regras.

---

## Expiração de partida

Chaves não podem durar para sempre.

Sugestão:

- sala aguardando: expira após 15 minutos;
- partida em andamento: expira após 2 horas sem evento;
- partida terminada: somente leitura por 30 minutos;
- histórico opcional: copiar resultado agregado e remover os eventos detalhados.

No Spark sem função agendada, clientes tratam `expiresAt` como inválido e fazem limpeza oportunista. Na fase de produção, uma função agendada remove salas antigas.

---

## Hospedagem

O app precisa estar em HTTPS para WebRTC e recursos modernos funcionarem corretamente em celular.

Opções:

- Firebase Hosting;
- Cloudflare Pages;
- Vercel;
- Netlify;
- GitHub Pages, se os assets protegidos não estiverem no repositório.

O projeto já gera um `dist/index.html` único e pequeno. O QR usa o próprio `location.origin`, então depois do deploy ele apontará automaticamente para a URL pública.

---

## Proteção dos sprites

Realidade técnica: se o navegador consegue desenhar uma imagem, um usuário determinado consegue extraí-la da memória, cache ou rede. Não existe proteção absoluta no cliente.

O que dá para fazer:

- não manter os arquivos-fonte e sprites em alta resolução no GitHub;
- servir somente versões otimizadas;
- marca d'água discreta ou assinatura forense;
- URLs temporárias;
- Storage privado;
- contratos/licença claros;
- manter os originais e prompts fora do repositório público.

Em 2026, Cloud Storage pode exigir plano Blaze/billing mesmo com cota gratuita. Verificar o plano antes de depender dele para assets. Para o MVP, o mais importante é não publicar os originais.

---

## Ordem cirúrgica de implementação

### Etapa 1: adaptar interfaces, sem mudar o jogo

Criar:

```ts
interface MatchTransport {
  connect(code: string): Promise<void>;
  send(event: MatchEvent): Promise<void>;
  subscribe(cb: (event: MatchEvent | Commit) => void): () => void;
  status(): LinkState;
  close(): void;
}
```

Implementações:

- `LocalTransport` usando o código atual;
- `FirebaseTransport`;
- `TrysteroTransport`;
- `ResilientTransport` que combina os dois.

### Etapa 2: Firebase Spark

- criar projeto;
- ativar Auth anônimo;
- criar RTDB;
- escrever regras;
- configurar App Check em modo monitor;
- implementar chave global e assentos por transação;
- implementar presença e expiração.

### Etapa 3: jogar somente pela RTDB

Antes de WebRTC, provar:

- celular x desktop;
- QR direto;
- P1/P2;
- terceiro observador;
- reconexão;
- timeout autoritativo;
- refresh sem perder sala.

Essa etapa já entrega o multiplayer real.

### Etapa 4: adicionar Trystero como caminho rápido

- instalar `@trystero-p2p/firebase`;
- usar a mesma RTDB para signaling;
- criar ações tipadas;
- ACK e deduplicação;
- manter RTDB como hot standby.

### Etapa 5: TURN

- criar conta Cloudflare Realtime;
- criar Worker para credencial efêmera;
- nunca incluir segredo no frontend;
- passar `turnConfig` ao Trystero;
- detectar `relay` via stats da PeerConnection;
- exibir `DIRETO`, `RELAY` ou `CANAL RESERVA` no painel.

### Etapa 6: endurecer autoridade

- mover `engine.ts` para função/Worker;
- validar intenções;
- proteger `state` contra escrita do cliente;
- adicionar replay e auditoria.

---

## Testes obrigatórios

### Matriz de rede

| Cenário | Resultado esperado |
|---|---|
| Desktop e celular no mesmo Wi-Fi | P2P direto |
| Desktop no Wi-Fi, celular no 4G/5G | P2P ou TURN |
| Rede corporativa bloqueando UDP | TURN/TLS ou RTDB |
| DataChannel fechado manualmente | muda para RTDB sem perder turno |
| Firebase desconectado com P2P aberto | continua e enfileira confirmação |
| Os dois canais caem | pausa e preserva outbox |
| Refresh do P2 | recupera cadeira pelo UID |
| Terceiro abre QR | observador |
| Observador chega antes de P2 | vira P2 |
| Dois tentam a cadeira P2 juntos | transação deixa apenas um |
| Dois tentam declarar timeout | um único commit |
| Evento chega por P2P e RTDB | aplicado uma única vez |

### Testes de jogo

- captura simples;
- combo com duas escolhas;
- combo automático;
- promoção no fim da cadeia;
- dama capturando a distância;
- rendição;
- ausência de movimentos;
- timeout;
- rádio durante animação;
- reconnect no meio de míssil;
- observer late join.

---

## Arquivos que serão tocados

### Alterar

- `src/game/net.ts`: deixar de ser localStorage-only e virar fachada de transporte;
- `src/App.tsx`: remover decisões online baseadas apenas no relógio local;
- `src/components/MainMenu.tsx`: usar create/join assíncrono real;
- `src/components/RadioBox.tsx`: enviar pelo transporte;
- `src/game/engine.ts`: exportar aplicação determinística de uma intenção completa.

### Criar

- `src/game/network/types.ts`;
- `src/game/network/firebase.ts`;
- `src/game/network/trystero.ts`;
- `src/game/network/resilient.ts`;
- `src/game/network/outbox.ts`;
- `src/game/network/hash.ts`;
- `src/config/firebase.ts`;
- `database.rules.json`;
- `workers/turn-credentials.ts` ou equivalente.

---

## Variáveis de ambiente futuras

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_TURN_CREDENTIAL_ENDPOINT=
```

Esses valores de configuração Firebase são públicos. O segredo da API Cloudflare fica somente na Worker.

---

## Critério de pronto

O multiplayer está pronto quando:

1. duas pessoas abrem o mesmo deploy em aparelhos diferentes;
2. P1 gera chave e QR;
3. P2 entra direto pelo QR;
4. ambos veem a mesma partida em perspectivas próprias;
5. o terceiro vira observador;
6. um DataChannel pode ser derrubado sem encerrar a partida;
7. refresh recupera cadeira e estado;
8. timeout é definido por tempo de servidor;
9. nenhum evento é aplicado duas vezes;
10. o jogo informa claramente qual rota está ativa.

---

## Fontes consultadas

- Trystero, arquitetura, estratégias e TURN: https://github.com/dmotz/trystero
- Firebase Realtime Database, limites: https://firebase.google.com/docs/database/usage/limits
- Firebase Realtime Database, presença e `onDisconnect`: https://firebase.google.com/docs/database/web/offline-capabilities
- Firebase Realtime Database, transações: https://firebase.google.com/docs/database/web/read-and-write
- Firebase, preços e cotas: https://firebase.google.com/pricing
- Cloudflare Realtime TURN, preços e credenciais: https://developers.cloudflare.com/realtime/turn/faq/

Os números de cota devem ser verificados novamente no dia da implementação, pois serviços gratuitos podem mudar.
