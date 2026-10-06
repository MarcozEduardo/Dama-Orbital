# Teste do multiplayer em dois aparelhos

## Antes de testar

- Anonymous Auth ativado.
- RTDB criada.
- `.env.local` preenchido.
- regras publicadas.
- app hospedado em HTTPS.
- celular e desktop podem usar redes diferentes.

## Diagnóstico automático sem criar partida

```bash
FIREBASE_API_KEY="sua-web-api-key" \
FIREBASE_DATABASE_URL="https://seu-projeto-default-rtdb.firebaseio.com" \
node scripts/check-firebase.mjs
```

O resultado esperado é `AUTH_OK` e `RULES_READ_OK null`. A conta anônima de teste é removida ao final.

## Teste 1: criação e QR

1. Abra o jogo no desktop.
2. Entre em `2 Dispositivos`.
3. Gere a Chave Diplomática.
4. Confirme que aparecem chave e QR.
5. Leia o QR pelo celular.
6. O celular deve entrar como P2.
7. O desktop deve sair automaticamente da espera.

## Teste 2: perspectivas

- Desktop/P1 enxerga Bobby do próprio lado.
- Celular/P2 enxerga Socram do próprio lado.
- Em dois dispositivos, o tabuleiro não gira a cada turno.
- Nenhum aparelho consegue mover no turno do outro.

## Teste 3: terceiro participante

1. Abra o QR em um terceiro aparelho.
2. Deve entrar como observador.
3. Não pode mover.
4. Não pode usar rádio.
5. Deve receber estado atual mesmo entrando no meio da partida.

## Teste 4: modo Observador com só um jogador

1. P1 cria sala.
2. Outro aparelho escolhe Observador e injeta a chave.
3. Como não existe P2, ele deve ocupar P2.

## Teste 5: queda do P2P

Depois da integração Trystero:

1. Force o DataChannel a fechar pelo DevTools.
2. A UI deve trocar de `DIRETO` para `CANAL RESERVA`.
3. Faça um lance.
4. O outro aparelho deve receber via RTDB.
5. A partida não pode voltar ao menu.

## Teste 6: queda de internet

1. Durante o turno, ative modo avião por dez segundos.
2. O relógio deve pausar depois de detectar a queda.
3. A cadeira deve permanecer reservada.
4. Ao voltar, comparar `seq` e `stateHash`.
5. RTDB vence qualquer conflito.

## Teste 7: refresh

1. Recarregue o celular no meio da partida.
2. Anonymous Auth deve recuperar o UID.
3. O jogador deve recuperar P2, não virar observador.
4. O tabuleiro deve voltar ao último estado confirmado.

## Teste 8: timeout

1. Não jogue durante 30 segundos.
2. O servidor troca o turno uma única vez.
3. Os dois aparelhos mostram a mesma contagem.
4. Dois clientes tentando confirmar timeout não podem duplicar o turno.

## Teste 9: rádio

- mensagem aparece sobre a última peça viva movida;
- chega sem depender do próximo lance;
- cooldown de cinco segundos;
- `kkkkkk` passa;
- spam/palavrão/link não passa;
- observador não envia.

## Teste 10: fim e expiração

- vencedor igual nos três aparelhos;
- depois de finalizada, nenhum lance novo entra;
- link antigo informa partida finalizada/expirada;
- chave não é reutilizada.

## Matriz mínima de rede

| P1 | P2 | Esperado |
|---|---|---|
| Chrome desktop, Wi-Fi | Chrome Android, mesmo Wi-Fi | direto |
| Chrome desktop, Wi-Fi | Android, 4G/5G | direto ou TURN |
| Firefox desktop | Chrome Android | direto ou TURN |
| Safari iPhone | Chrome desktop | direto ou TURN |
| rede corporativa | 4G/5G | TURN ou RTDB |
