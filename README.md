# Dinâmica de Inovação

Plataforma de gamificação para eventos presenciais, com dois modos de jogo:

- **Desafio individual** — cada pessoa participa pelo próprio celular, dentro de uma janela de tempo definida pelo admin.
- **Duelo ao vivo** — dois participantes disputam em tempo real, com painel do apresentador e telão, controlado manualmente rodada a rodada.

Veja a arquitetura completa, o modelo de dados e as decisões técnicas no plano de implementação em `~/.claude/plans` (gerado durante o desenvolvimento) — este README foca em como instalar, configurar, rodar e publicar.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS (pasta `app/`)
- **Backend**: Supabase (Postgres + Auth + Realtime), com toda a lógica de pontuação e de estado de partida em funções Postgres `SECURITY DEFINER` (pasta `supabase/`)
- **Hospedagem sugerida**: Vercel/Netlify para o frontend, Supabase Cloud para o backend

## Estrutura de pastas

```
Inovação/
├── app/                        # aplicativo React (todas as 4 experiências: participante, telão, apresentador, admin)
│   └── src/
│       ├── routes/             # páginas, uma pasta por área (individual, duel, screen, presenter, admin)
│       ├── components/         # componentes de UI reutilizáveis
│       ├── contexts/           # Auth, Theme (identidade visual), Toast
│       ├── hooks/               # useRealtimeRow/List, useCountdown, useDuelTimer
│       ├── lib/                 # cliente Supabase, storage local, CSV
│       └── types/               # tipos gerados a partir do schema (database.types.ts)
└── supabase/
    ├── migrations/               # schema, RLS, funções RPC — aplicadas em ordem numérica
    ├── seed.sql                  # perguntas de exemplo (claramente marcadas como demo)
    └── config.toml
```

## 1. Pré-requisitos

- Node.js 20+ e npm
- Uma conta em [supabase.com](https://supabase.com) (plano gratuito é suficiente para testar)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase` ou `brew install supabase/tap/supabase`)

## 2. Criar e configurar o projeto Supabase

1. Crie um projeto novo em [supabase.com/dashboard](https://supabase.com/dashboard).
2. Anote a **Project URL** e a **anon public key** em *Project Settings → API* — vão para o `.env` do frontend.
3. Faça login e vincule o projeto local ao projeto remoto:
   ```bash
   supabase login
   cd Inovação
   supabase link --project-ref SEU_PROJECT_REF
   ```
4. Aplique todas as migrations (cria o schema completo: tabelas, RLS, funções, Realtime):
   ```bash
   supabase db push
   ```
5. Carregue as perguntas de exemplo (opcional, mas recomendado para testar antes de cadastrar o conteúdo real):
   ```bash
   psql "$(supabase db remote-url)" -f supabase/seed.sql
   ```
   Ou, pelo SQL Editor do painel do Supabase, cole o conteúdo de `supabase/seed.sql` e execute.

### Criando o administrador

O acesso ao painel é simplificado de propósito: só existe **uma senha**, sem tela de e-mail. Por baixo, é uma conta real do Supabase Auth (por isso RLS e o log de auditoria continuam funcionando) — a UI só esconde o campo de e-mail.

1. No painel do Supabase, vá em *Authentication → Users → Add user*, crie um usuário com um e-mail (ex.: `admin@seu-evento.com`) e uma senha forte.
2. Promova esse usuário a `admin` pelo SQL Editor:
   ```sql
   update admin_profiles set role = 'admin' where user_id =
     (select id from auth.users where email = 'admin@seu-evento.com');
   ```
3. Configure `VITE_ADMIN_EMAIL` no `.env` (passo 3) com esse mesmo e-mail — é ele que a tela de login usa internamente quando você digita só a senha.

O acesso ao painel fica atrás de um ícone discreto de engrenagem no canto da tela inicial (`/`), ou diretamente por `/admin/login`.

## 3. Configurar e rodar o frontend

```bash
cd app
npm install
cp .env.example .env
```

Edite `.env` com a Project URL e a anon key do passo 2, e com o e-mail do administrador criado no passo anterior:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
VITE_ADMIN_EMAIL=admin@seu-evento.com
```

```bash
npm run dev
```

Acesse `http://localhost:5173`. Sem o `.env` preenchido, o app roda normalmente mas mostra um aviso no topo e nenhuma tela com dados funciona (login, perguntas, tempo real) — é o comportamento esperado, não um erro.

## 4. Publicação

**Frontend (Vercel/Netlify):**
1. Conecte o repositório, apontando a raiz do projeto para `app/` (build command `npm run build`, output `dist/`).
2. Configure as mesmas variáveis `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no painel da hospedagem.

**Backend (Supabase Cloud):** já está em produção assim que você aplicou as migrations com `supabase db push` — não há passo extra de deploy do backend. Para futuras alterações de schema, crie uma nova migration (`supabase migration new nome`) e rode `supabase db push` novamente; nunca edite uma migration já aplicada em produção.

## 5. Roteiro de teste — partida completa ponta a ponta

Use este roteiro para validar a instalação antes do evento (ver critérios de aceite do projeto).

### Modo individual
1. Entre no painel admin pelo ícone de engrenagem na tela inicial (ou `/admin/login`) com a senha configurada.
2. Em **Sessões e partidas**, edite a "Sessão de exemplo" (criada pelo seed): mude o status para **Aberta** e defina abertura/encerramento cobrindo o horário atual.
3. Abra `/j/DEMO01` em uma aba anônima (ou celular) — digite um nome e inicie o desafio.
4. Responda as 5 perguntas de exemplo, observando o cronômetro e o feedback de acerto/erro.
5. Ao final, confira a pontuação e o link para o ranking (`/ranking/<id-da-sessão>`) — abra em uma segunda aba e repita o passo 3-4 com outro nome para ver o ranking com 2 posições.

### Modo duelo
1. Autenticado como admin/apresentador, acesse **Painel do apresentador → Nova partida** (`/apresentador/nova`), escolha o "Conjunto de exemplo" e crie a partida.
2. Você será redirecionado ao painel de controle (`/apresentador/<id>`), com QR Code e código da partida.
3. Abra o telão em uma aba/tela separada: `/telao/<id>`.
4. Em duas outras abas (ou celulares), acesse `/duelo/entrar/<código>` e entre com dois nomes diferentes.
5. No painel do apresentador, marque os dois participantes como disputantes e clique em **Iniciar partida**.
6. Clique em **Liberar pergunta** → **Iniciar cronômetro**. Responda pelos dois celulares.
7. Clique em **Revelar resposta** e confira o placar atualizando nas 4 telas (participantes, telão, apresentador).
8. Repita para a segunda rodada; ao final, confira a tela de vencedor no telão e nos celulares.
9. Teste um caso especial: atualize (F5) a tela do telão e do apresentador no meio de uma rodada — o estado deve se recompor sozinho, sem perder o placar ou a pergunta atual.

### Painel administrativo
1. Cadastre uma pergunta nova em **Perguntas**, com 4 alternativas, marque a correta e salve.
2. Adicione-a a um conjunto em **Conjuntos**.
3. Em **Resultados**, confira o ranking e a exportação em CSV da sessão de exemplo já testada.
4. Em **Configurações**, ajuste o bônus de velocidade da fórmula de pontuação e confirme que uma nova sessão passa a usar o novo valor.

## Limitações conhecidas

- Perguntas do tipo `multiple_choice` (múltipla seleção) e `poll` (votação sem gabarito) existem no schema mas não têm submissão/pontuação implementada na interface — os formulários de cadastro só oferecem `single_choice`, `true_false`, `image` e `tiebreaker`, que funcionam ponta a ponta.
- Não há tipagem gerada automaticamente (`supabase gen types`) neste ambiente de desenvolvimento por falta de Docker local; os tipos em `app/src/types/database.types.ts` foram escritos manualmente espelhando o schema. Se o Supabase CLI com Docker estiver disponível, regenere com:
  ```bash
  supabase gen types typescript --project-id SEU_PROJECT_REF > app/src/types/database.types.ts
  ```
