# Proteção do projeto no GitHub

O que pode e o que não pode ficar público, e como neutralizar cópia dos sprites e do motor.

---

## A verdade técnica primeiro

**Tudo que o navegador executa, o usuário consegue ler.** Não existe forma de esconder JavaScript
de quem insiste. O `dist/index.html` tem o jogo inteiro embutido.

Então a proteção não é "esconder do usuário final" — é **não entregar a fonte e a arte no mesmo
pacote que você publica**. O objetivo é: quem clonar o repositório não recebe um produto pronto
para reutilizar.

---

## O que é público por natureza (não adianta esconder)

| Item | Por quê |
|---|---|
| Config do Firebase Web (`apiKey`, `appId`, `databaseURL`) | vai no bundle por design; a segurança é Auth + Rules |
| Estrutura de dados da RTDB | legível no DevTools |
| Lógica do jogo no cliente | está no bundle |

A segurança real desses vem das **Security Rules**, não do segredo.

## O que fica protegido (não vai pro GitHub)

| Item | Onde fica |
|---|---|
| Sprites em alta resolução (PNGs originais) | Firebase Storage privado |
| Prompts de geração das artes | fora do repositório |
| `docs/` completo | pasta local, no `.gitignore` |
| `DOC/` completo | pasta local, no `.gitignore` |
| `.env.local` | já bloqueado |
| Service accounts / chaves | já bloqueados |
| Histórico de decisão do produto | está nos docs |

---

## Como fica o repositório público

Se você quiser portfólio público, o repositório contém apenas:

```
src/                  → código SEM os assets de arte
  game/engine.ts      → regras (pode ser público: é a parte "portfólio")
  game/ai.ts          → IA (idem)
  componentes/        → interface
public/
  sprites/            → vazio (assets baixados em runtime)
```

Sem `DOC/`, sem `docs/`, sem PNGs. Quem clonar recebe um jogo **sem arte** que não roda bonito.

O bundle publicado (`dist/`) contém a arte — mas ele fica no seu Hosting, não no GitHub.

---

## Como implementar os assets privados

### 1. Sprites no Storage privado

```
storage/
  sprites/piece-blue-front.png   (original, 256px+)
  sprites/king-red-front.png
  ...
```

Servidos por **signed URL de curta duração**, gerada por callable Function apenas para usuário
autenticado. Sem Firebase configurado, o jogo cai nos **fallbacks procedurais** — que são código,
não arte final. Ele roda, mas feio.

### 2. O mecanismo já existe

`src/game/sprites.ts` já tem esse desenho:

```
tenta PNG local → tenta URL remota → fallback procedural desenhado em canvas
```

É só apontar o segundo passo para as signed URLs.

### 3. Marca d'água invisível

Nas artes originais, antes de subir: pixels de assinatura em canais de cor de baixa ordem
(lsb watermark). Não impede cópia, mas **prova autoria** em disputa.

---

## Plano de ação (na ordem)

| Passo | O quê | Esforço |
|---|---|---|
| 1 | `.gitignore` já cobre `DOC/` e `docs/` | feito |
| 2 | Subir PNGs originais no Storage privado | ~30min |
| 3 | Function `getSpriteUrls` com signed URLs | ~1h |
| 4 | Remover PNGs do `src/assets/` do repo público | 5min |
| 5 | Watermark nos originais | opcional |
| 6 | Manter `engine.ts` público como demonstração de portfólio | decisão sua |

---

## O que NÃO protege (honestidade)

- **`VITE_` com segredo** — vai parar no bundle público. Nunca.
- **Obfuscar o bundle** — dificulta leitura, não impede. Custo alto, ganho baixo.
- **Bloquear botão direito / DevTools** — cosmético, irrita usuário real.

O que realmente conta: **não publicar a arte junto com o código**. Isso o `.gitignore` + Storage
privado resolvem.

---

## Sobre o histórico do Git

⚠️ Se você já commitou os PNGs em algum momento, eles **continuam no histórico** mesmo depois de
remover. Nesse caso:

```bash
# remove do histórico inteiro (destrutivo: faça backup antes)
npx gitingest  # ou use git filter-repo
```

Se o repositório ainda é privado e vai virar público, o mais seguro é começar um repositório novo
com o estado atual já limpo.

---

## Resumo em uma frase

> O jogo pode ser lido por quem joga — mas quem clona o GitHub não ganha a arte, nem os documentos,
> nem as decisões. Recebe um esqueleto funcional e feio.
