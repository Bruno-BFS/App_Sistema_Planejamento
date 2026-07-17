# Meu Ritmo

Aplicativo React para planejamento pessoal, tarefas e controle de tempo.

## Stack

- React 19 + TypeScript + Vite
- Supabase Auth + PostgreSQL + RLS
- TanStack Query
- React Router

## Modelo visual

O aplicativo utiliza **skeuomorphism moderno e sutil**: superfícies inspiradas em papel, controles táteis e profundidade moderada sobre uma estrutura limpa de SaaS. As regras e limites do sistema visual estão documentados em [`docs/visual-style.md`](docs/visual-style.md).

## Configuração

1. Copie `.env.example` para `.env.local`.
2. Preencha `VITE_SUPABASE_PUBLISHABLE_KEY` com a **Publishable key** do projeto.
3. Aplique as migrations de `supabase/migrations` no projeto `nkrkjvknjwzfvmlhfhxl`.
4. Execute `npm run dev`.

Nunca use a chave `service_role` no frontend.

## Supabase remoto

- Projeto: `nkrkjvknjwzfvmlhfhxl` (`Aplicativo Sistema Planejamento`)
- PostgreSQL: versão 17
- Migrations e políticas RLS aplicadas e validadas
- Confirmação de e-mail permanece obrigatória
- A URL e a Publishable key devem existir somente em `.env.local` ou nas variáveis do provedor de deploy

Após o cadastro, o aplicativo orienta o usuário a confirmar o link recebido antes do primeiro login.

## Deploy

### Vercel (produção recomendada)

Importe o repositório `Bruno-BFS/App_Sistema_Planejamento` na Vercel e configure:

- Framework Preset: `Vite`;
- Build Command: `npm run build`;
- Output Directory: `dist`;
- Production Branch: `main`;
- variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nos ambientes Production e Preview.

O arquivo `vercel.json` mantém as rotas do React Router funcionais em acessos diretos, como `/tarefas`. Nunca configure `service_role` no frontend ou na Vercel.

### GitHub Pages (mantido durante a transição)

O workflow atual continua publicando a branch `main` em `https://bruno-bfs.github.io/App_Sistema_Planejamento/`, executando instalação limpa, lint e build. As variáveis exigidas no GitHub Actions são `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.

Após validar a URL da Vercel e atualizar as URLs permitidas no Supabase Auth, o GitHub Pages poderá ser desativado em uma mudança separada.

## MVP atual

- cadastro e login por e-mail;
- workspace pessoal criado automaticamente;
- tela Hoje responsiva;
- criação e conclusão de tarefas;
- gestão de tarefas com descrição, data, busca, filtros e exclusão;
- prioridades e estimativa de tempo;
- cronômetro persistido no servidor;
- datas calculadas no fuso horário local do usuário;
- isolamento multi-tenant por workspace e políticas RLS.

## Comandos

```powershell
npm run dev
npm run build
npm run lint
```
