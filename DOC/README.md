# Central de handoff: Damas Orbitais

Se você acordou e quer colocar o multiplayer real para funcionar, comece aqui.

## Ordem de leitura

1. [`FIREBASE-PASSO-A-PASSO.md`](FIREBASE-PASSO-A-PASSO.md) — o que clicar no console Firebase.
2. [`O-QUE-ME-ENVIAR.md`](O-QUE-ME-ENVIAR.md) — os valores públicos que podem ser enviados para a próxima IA.
3. [`FUNCTIONS-NECESSARIAS.md`](FUNCTIONS-NECESSARIAS.md) — nomes e responsabilidade das Functions.
4. [`TESTE-DOIS-APARELHOS.md`](TESTE-DOIS-APARELHOS.md) — roteiro de validação celular x desktop.
5. [`CHECKLIST-UMA-LAPADA.md`](CHECKLIST-UMA-LAPADA.md) — mapa de arquivos para integrar sem reler o projeto inteiro.
6. [`ARQUIVOS-DA-CONEXAO.md`](ARQUIVOS-DA-CONEXAO.md) — mapa dos arquivos de rede e bugs recorrentes.
7. [`HANDOFF-MOTOR.md`](HANDOFF-MOTOR.md) — depoimento do motor: o que foi feito para funcionar.
8. [`PROTECAO-DO-PROJETO.md`](PROTECAO-DO-PROJETO.md) — o que pode ficar público e como blindar sprites e motor.
9. [`SACADAS-DO-MARCOS.md`](SACADAS-DO-MARCOS.md) — as percepções de produto detectadas jogando, e por que cada uma virou mecânica.

## Segurança imediata

O `.gitignore` já bloqueia `.env.local`, service accounts, chaves privadas, logs do Firebase e diretórios
gerados pelas Functions. Não remova essas regras. O único arquivo de ambiente que deve ir ao GitHub é
`.env.example`, sempre vazio.

## O que já está preparado no código

- Firebase SDK instalado.
- `@trystero-p2p/firebase` instalado.
- `.env.example` com todos os nomes esperados.
- `src/config/firebase.ts` com Auth anônimo, persistência e emuladores.
- `src/game/network/firebase.ts` com criação de sala, assento P2, observador, presença e commit transacional.
- `src/game/network/trystero.ts` com DataChannel, detecção de conexão direta/relay e TURN opcional.
- `src/game/network/resilient.ts` com envio duplicado seguro, deduplicação e fallback RTDB.
- `src/game/network/outbox.ts` com fila IndexedDB.
- `database.rules.json` com regras MVP autenticadas.
- `firebase.json` com RTDB, Hosting e Emulator Suite.
- templates das Functions em `firebase/functions/src/`.

## O que falta para ficar online de verdade

### Já concluído

- projeto `damaorbital` criado;
- Web App criado;
- Realtime Database informada em `https://damaorbital-default-rtdb.firebaseio.com/`;
- configuração pública salva em `.env.local`;
- alias local salvo em `.firebaserc`;
- menu ligado ao gateway remoto quando as variáveis Firebase existem;
- criação/entrada/observador usando RTDB preparada;
- WebRTC/Trystero inicializa depois que a partida abre;
- modo local permanece disponível.

### Falta confirmar no Console

1. Ativar Anonymous Auth.
2. Publicar `database.rules.json`.
3. Fazer o primeiro teste RTDB em dois aparelhos.
4. Confirmar se a região das futuras Functions será `us-central1` ou outra.
5. Configurar TURN apenas depois do teste básico.

## Decisão que não deve ser revista sem teste

**WebRTC é o caminho rápido. Firebase RTDB é a verdade e o fallback quente. IndexedDB preserva a fila. TURN cobre redes restritivas.**
