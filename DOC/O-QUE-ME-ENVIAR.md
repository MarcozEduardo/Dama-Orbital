# O que enviar na próxima sessão

## Estado recebido

```text
PROJECT ID: damaorbital
AUTH DOMAIN: damaorbital.firebaseapp.com
DATABASE URL: https://damaorbital-default-rtdb.firebaseio.com/
WEB APP: configurado
ANONYMOUS AUTH: ainda precisa ser confirmado
REGRAS: ainda precisam ser publicadas
TURN: não configurado
FUNCTIONS: desativadas no frontend até o deploy
```

## Mensagem pronta para copiar e colar

```text
O Firebase do Damas Orbitais está criado.

PROJECT ID:

REGIÃO DA REALTIME DATABASE:

FIREBASE CONFIG PÚBLICO:
apiKey=
authDomain=
databaseURL=
projectId=
storageBucket=
messagingSenderId=
appId=

ANONYMOUS AUTH: ATIVADO / NÃO ATIVADO
REALTIME DATABASE: CRIADA / NÃO CRIADA
REGRAS PUBLICADAS: SIM / NÃO
APP CHECK: DESATIVADO / MONITOR / ATIVO
FUNCTIONS: NÃO CRIADAS / CRIADAS
TURN: NÃO CONFIGURADO / ENDPOINT PRONTO

Quero integrar primeiro RTDB entre dois aparelhos e manter o modo local como fallback.
Leia DOC/CHECKLIST-UMA-LAPADA.md antes de alterar o código.
```

## Pode enviar

- Firebase Web config;
- Project ID;
- Database URL;
- região;
- URL pública do Hosting;
- mensagens de erro sem tokens;
- nome das Functions implantadas;
- URL pública da Function/Worker que entrega TURN.

## Não envie no chat

- `serviceAccountKey.json`;
- conteúdo de private key;
- token do `firebase login:ci`;
- `CLOUDFLARE_TURN_API_TOKEN`;
- `CLOUDFLARE_TURN_KEY_ID` se você quiser tratar como sensível;
- credencial fixa de TURN;
- cartão ou dados de faturamento.

Se uma IA pedir para colocar segredo em `VITE_*`, não faça. Tudo que começa com `VITE_` vai parar no JavaScript público.

O `.gitignore` já bloqueia `.env.local`, service accounts e chaves privadas. Antes de qualquer commit,
confira que o arquivo com valores reais não aparece em `git status`.

## Arquivos já esperando esses valores

- `.env.example`;
- `src/config/firebase.ts`;
- `src/game/network/firebase.ts`;
- `src/game/network/trystero.ts`;
- `database.rules.json`;
- `firebase.json`.
