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
3. Aplique a migration de `supabase/migrations` no projeto `nkrkjvknjwzfvmlhfhxl`.
4. Execute `npm run dev`.

Nunca use a chave `service_role` no frontend.

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
