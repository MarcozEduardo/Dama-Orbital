# Functions necessárias

## Resumo

Existem seis funções previstas. As quatro primeiras cuidam da autoridade do jogo; a quinta entrega TURN; a sexta limpa salas.

O template está em:

```text
firebase/functions/src/index.ts.template
```

Não implante o template sem terminar `engine-adapter.ts.template`.

## 1. `createMatch`

**Tipo:** callable HTTPS  
**Auth:** obrigatório, inclusive anônimo  
**Entrada:** `{ nick }`  
**Saída:** `{ matchId, code, seat: 'host' }`

Responsabilidades:

- gerar Match ID;
- reservar código de seis caracteres por transação;
- nunca reutilizar código emitido;
- criar P1;
- criar estado inicial;
- expirar sala aguardando em 15 minutos.

## 2. `joinMatch`

**Tipo:** callable HTTPS  
**Auth:** obrigatório  
**Entrada:** `{ code, nick, intent }`  
**Saída:** `{ matchId, code, seat }`

Responsabilidades:

- validar chave e expiração;
- devolver a cadeira anterior ao mesmo UID;
- ocupar P2 por transação se estiver livre;
- se P2 já existir, registrar observador;
- se o usuário pediu Observador mas só existe P1, transformá-lo em P2.

## 3. `submitMatchEvent`

**Tipo:** callable HTTPS  
**Auth:** obrigatório  
**Entrada:** `{ event }`  
**Saída:** `{ commit }`

Esta é a Function mais importante.

Responsabilidades:

- confirmar que UID é P1/P2;
- confirmar turno;
- confirmar `seqExpected`;
- deduplicar `eventId`;
- rodar a engine compartilhada;
- rejeitar movimento ilegal;
- aplicar captura obrigatória;
- calcular combo, promoção, vencedor e próximo deadline;
- gravar estado e evento na mesma transação.

Arquivos que precisam virar código compartilhado:

- `src/game/engine.ts`;
- serialização atualmente em `src/game/net.ts`;
- hash em `src/game/network/hash.ts`.

## 4. `sendRadio`

**Tipo:** callable HTTPS  
**Auth:** obrigatório  
**Entrada:** `{ matchId, text }`  
**Saída:** `{ ok: true }`

Responsabilidades:

- somente P1/P2;
- observador bloqueado;
- máximo de 40 caracteres;
- cooldown de cinco segundos pelo servidor;
- copiar o filtro de `src/components/RadioBox.tsx` para módulo compartilhado;
- preservar `kkkkkk` e `hahaha`;
- guardar somente as últimas mensagens necessárias.

## 5. `getTurnCredentials`

**Tipo:** callable HTTPS ou Worker pública autenticada  
**Auth:** obrigatório  
**Entrada:** opcional `{ ttl: 3600 }`  
**Saída:** `{ iceServers: [...] }`

Responsabilidades:

- ler segredo da Cloudflare no servidor;
- gerar credencial com duração curta;
- nunca enviar token mestre;
- limitar abuso por UID/IP/App Check.

Secrets previstos:

```bash
npx firebase-tools functions:secrets:set CLOUDFLARE_TURN_API_TOKEN
npx firebase-tools functions:secrets:set CLOUDFLARE_TURN_KEY_ID
```

O endpoint público entra em:

```text
VITE_TURN_CREDENTIAL_ENDPOINT=
```

## 6. `expireMatches`

**Tipo:** scheduled  
**Frequência sugerida:** 15 minutos

Responsabilidades:

- marcar sala antiga como expirada;
- remover eventos/radio/presença pesados;
- preservar a chave como tombstone;
- não reutilizar a chave;
- opcionalmente manter placar agregado.

## Auth necessário

Ativar apenas:

- Anonymous Auth no MVP.

Adicionar Google/e-mail no futuro somente se houver perfil/ranking.

## Cloud Functions e plano

O primeiro multiplayer pode funcionar no Spark sem Functions, usando `src/game/network/firebase.ts` e as regras MVP.

Para autoridade total e geração segura de TURN, o deploy de Functions normalmente exige Blaze. Ative orçamento e alertas antes.
