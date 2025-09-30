# Quiz EMR — MVP (GitHub Pages + Firebase Firestore)

Este é um exemplo funcional para rodar um quiz estilo Kahoot com pontuação por acerto e velocidade, hospedado gratuitamente no **GitHub Pages** e usando **Firebase Firestore** no plano grátis (Spark).

## Estrutura
- `index.html` — Tela inicial (nome/e-mail) → inicia o jogo
- `quiz.html` — Perguntas, cronômetro e cálculo de pontuação
- `leaderboard.html` — Ranking ao vivo (top 50)
- `js/questions.js` — Perguntas e regra de pontuação
- `assets/styles.css` — Estilo dark moderno
- `firebase.rules` — Regras de segurança do Firestore (somente CREATE e READ para `scores`)

## Como configurar (passo a passo)
1. **Crie um projeto no Firebase**
   - https://console.firebase.google.com → Add project → Firestore Database (modo production).
2. **Crie um app Web**
   - Em “Project settings” → “General” → “Your apps” → “Web app”.
   - Copie o `firebaseConfig` e **substitua** nos arquivos `quiz.html` e `leaderboard.html` (há blocos `const firebaseConfig = { ... }`).
3. **Aplique as regras do Firestore**
   - Em Firestore → “Rules” → cole o conteúdo de `firebase.rules` e Publique.
4. **Ative o GitHub Pages**
   - Crie um repositório (pode ser `seu-usuario.github.io` ou qualquer outro).
   - Suba todos os arquivos deste projeto na branch `main`.
   - Em **Settings → Pages**: Source = `main`, `/root`.
   - Aguarde gerar a URL (ex.: `https://seu-usuario.github.io/quiz-mvp-firestore/`).
5. **Teste**
   - Abra `index.html` publicado → preencha nome e e-mail → responda.
   - No final, clique **Enviar e Ver Ranking** → confira em `leaderboard`.
6. **QR Code**
   - Gere um QR apontando para a URL de `index.html` (pode usar https://www.qr-code-generator.com/).

## Personalizações rápidas
- **Perguntas:** edite `js/questions.js` (array `QUESTIONS`).
- **Cálculo de pontuação:** ajuste a função `computeScore()`.
- **Visual:** edite `assets/styles.css` (cores e layout).
- **Campos do ranking:** em `leaderboard.html`, altere as colunas conforme sua necessidade.

## Observações de segurança / anti-trapaça leve
- As regras `firebase.rules` **impedem atualizações** e **exclusões** de resultados (`scores`). Só cria e lê.
- A criação da **sessão** grava um `startedAt` com `serverTimestamp()`; a submissão final também grava `createdAt`. O tempo por pergunta é medido no cliente (suficiente para eventos). Para endurecer, mova o cálculo para um backend (Apps Script/Supabase).

## Suporte a domínios corporativos
- Se quiser restringir por e-mail corporativo, adicione validação no `index.html` (regex do domínio) ou use Authentication do Firebase.

Bom evento! 🎉
