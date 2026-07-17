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

O frontend é publicado automaticamente no GitHub Pages a cada atualização da branch `main`. O workflow executa instalação limpa, lint, build e deploy do artefato estático.

- URL: `https://bruno-bfs.github.io/App_Sistema_Planejamento/`
- Variáveis exigidas no GitHub Actions: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
- Rotas diretas usam `404.html` como fallback da SPA

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
