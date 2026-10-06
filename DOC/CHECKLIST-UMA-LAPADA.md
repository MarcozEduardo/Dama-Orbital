# Checklist de integração em uma lapada

## Contexto para a próxima IA

Não reescreva o jogo. Não mexa nos efeitos. O objetivo é substituir o transporte local pelo remoto preparado.

## Leia somente estes arquivos primeiro

1. `DOC/README.md`
2. `DOC/FIREBASE-PASSO-A-PASSO.md`
3. `src/game/net.ts`
4. `src/game/network/types.ts`
5. `src/game/network/firebase.ts`
6. `src/game/network/trystero.ts`
7. `src/game/network/resilient.ts`
8. `src/config/firebase.ts`
9. `src/components/MainMenu.tsx`
10. `src/App.tsx`, apenas os blocos `SINCRONIA ONLINE`, `CRONÔMETRO` e o render de `MainMenu`.

## Atalhos de busca

Use estas strings:

```text
// ── SINCRONIA ONLINE ──
// ── CRONÔMETRO DO LANCE (online) ──
phase === "menu"
function hostRoom
function joinRoom
function subscribeRoom
function pushState
function pushRadio
```

## Troca necessária

### Atualização após receber o Firebase Config

O menu já escolhe automaticamente o backend Firebase quando `.env.local` está completo. O protótipo
local continua sendo usado somente sem configuração. Antes de mexer novamente em `MainMenu.tsx`, teste:

1. Anonymous Auth ativado;
2. `database.rules.json` publicado;
3. gerar chave no desktop;
4. abrir QR no celular.

### Hoje

`MainMenu.tsx` chama funções síncronas de `src/game/net.ts`:

- `hostRoom()`;
- `joinRoom()`;
- `watchRoom()`;
- `subscribeRoom()`.

### Amanhã

Transformar o fluxo em assíncrono:

- `createRemoteMatch()`;
- `joinRemoteMatch()`;
- `subscribeRemoteMatch()`;
- `createPlayerChannel()`.

Exibir estado de loading enquanto Auth/sala conectam.

## Ordem segura de alteração

1. Validar `firebaseReadiness()`.
2. Se não configurado, manter o modo local e mostrar aviso no 2 Dispositivos.
3. Se configurado, `await createRemoteMatch()` ao gerar chave.
4. No QR/injeção, `await joinRemoteMatch()`.
5. Converter `RemoteMatch` para o modelo de tela.
6. Assinar `subscribeRemoteMatch()`.
7. Jogadores criam `createPlayerChannel()`; observadores não.
8. Trocar `pushState` por `commitRemoteState`.
9. Trocar relógio local por `deadlineAt`.
10. Remover o protótipo local online somente depois de dois aparelhos passarem nos testes.

## Não faça

- não coloque service account no React;
- não coloque token TURN em `VITE_*`;
- não faça observador entrar no mesh WebRTC;
- não transmita sprites, canvas ou vídeo;
- não aceite o tabuleiro inteiro enviado pelo cliente como verdade final;
- não incremente turno sem transação;
- não apague o modo local;
- não mude regra de captura durante integração de rede.

## Definição de pronto

- dois aparelhos diferentes terminam uma partida;
- P2 recupera cadeira após refresh;
- terceiro vira observador;
- observador com sala vazia vira P2;
- rádio chega sem próximo lance;
- timeout acontece uma vez;
- P2P pode cair e RTDB mantém o jogo;
- evento duplicado é aplicado uma vez;
- build passa.
