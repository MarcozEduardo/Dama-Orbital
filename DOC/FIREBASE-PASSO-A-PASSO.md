# Firebase: passo a passo para o Marcos

## Objetivo

Ao terminar este manual, você terá:

- um Firebase Web App;
- login anônimo;
- Realtime Database;
- configuração pública pronta para colar;
- opção de emulador local;
- base para Functions e TURN.

## 1. Criar o projeto

1. Abra https://console.firebase.google.com/.
2. Clique em **Adicionar projeto**.
3. Nome sugerido: `damas-orbitais`.
4. Google Analytics é opcional para o primeiro teste.
5. Aguarde a criação.

Anote o **Project ID**. Ele não é segredo.

## 2. Criar o aplicativo Web

1. Na visão geral do projeto, clique no ícone `</>`.
2. Apelido sugerido: `damas-orbitais-web`.
3. Marque Firebase Hosting se quiser publicar por lá.
4. Registre o app.
5. O Firebase mostrará um objeto `firebaseConfig`.

Você precisará destes campos:

```ts
apiKey
authDomain
databaseURL
projectId
storageBucket
messagingSenderId
appId
```

Se `databaseURL` ainda não aparecer, volte depois de criar a Realtime Database.

## 3. Ativar Anonymous Auth

1. No menu lateral: **Build → Authentication**.
2. Clique em **Começar**.
3. Aba **Sign-in method**.
4. Abra **Anônimo/Anonymous**.
5. Ative e salve.

Não precisa ativar telefone. Não precisa cadastrar usuário manualmente.

## 4. Criar Realtime Database

1. **Build → Realtime Database**.
2. Clique em **Create Database**.
3. Escolha uma região próxima do público e compatível com futuras Functions.
4. A região da RTDB é uma decisão difícil de mudar; anote o que escolheu.
5. Comece em modo bloqueado, não em modo público.

Copie a URL parecida com:

```text
https://SEU-PROJETO-default-rtdb.firebaseio.com
```

## 5. Criar `.env.local`

Na raiz do projeto, copie `.env.example` para `.env.local` e preencha:

```text
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Deixe o TURN vazio inicialmente:

```text
VITE_TURN_CREDENTIAL_ENDPOINT=
```

O primeiro marco é fazer dois aparelhos jogarem pela RTDB. TURN vem depois.

## 6. Preparar o Firebase CLI

Sem instalar globalmente:

```bash
npx firebase-tools login
npx firebase-tools use --add
```

Quando pedir alias, use `default`.

Você também pode copiar `.firebaserc.example` para `.firebaserc` e trocar o Project ID.

## 7. Testar as regras no Emulator Suite

O projeto já possui `firebase.json`.

No `.env.local`, ative:

```text
VITE_USE_FIREBASE_EMULATORS=true
```

Em um terminal:

```bash
npx firebase-tools emulators:start --only auth,database,hosting
```

Em outro:

```bash
npm run dev
```

Painel do emulador: http://127.0.0.1:4000

## 8. Publicar regras e Hosting

Depois do teste:

```bash
npm run build
npx firebase-tools deploy --only database,hosting
```

Nunca publique regras com `".read": true` e `".write": true`.

## 9. App Check

Depois que o multiplayer básico funcionar:

1. **Build → App Check**.
2. Registre o Web App.
3. Use reCAPTCHA v3 ou Enterprise.
4. Primeiro deixe em modo monitor.
5. Depois de conferir as métricas, ative enforcement na RTDB.

O site key entra em:

```text
VITE_RECAPTCHA_SITE_KEY=...
```

## 10. Functions: quando criar

Cloud Functions é a fase de autoridade/antitrapaça e credencial TURN. O deploy normalmente exige plano Blaze.

Para testar grátis primeiro:

- use RTDB direta;
- valide ordem com transações;
- não configure Functions ainda.

Quando decidir ativar Blaze:

```bash
npx firebase-tools init functions
```

Escolha:

- TypeScript;
- Node 20 ou runtime oferecido atualmente;
- ESLint opcional;
- instalar dependências: sim.

Depois siga `FUNCTIONS-NECESSARIAS.md`.

## O que é seguro enviar para outra IA

Pode enviar o objeto `firebaseConfig` público.

Não envie:

- arquivo de service account;
- private key;
- refresh token do Firebase CLI;
- token secreto da Cloudflare;
- senha pessoal;
- chave de faturamento.
