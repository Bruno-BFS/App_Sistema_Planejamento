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

### Web Push

Gere o par VAPID uma única vez (`npx web-push@3.6.7 generate-vapid-keys`) e mantenha a chave privada somente no Supabase:

- Vercel/GitHub Actions: `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`;
- Supabase Edge Function: `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_VAPID_SUBJECT` (por exemplo `mailto:suporte@dominio.com`), `WEB_PUSH_CRON_SECRET`, `SENTRY_DSN` e `SENTRY_ENVIRONMENT=production`.

O dispatcher `dispatch-web-push` deve ser implantado com a configuração versionada `verify_jwt = false`; ele rejeita chamadas sem o header privado `x-cron-secret`. A migration `20260722213000_web_push_scheduler.sql` habilita `pg_cron`/`pg_net`, lê o segredo `web_push_cron_secret` do Vault e agenda a chamada a cada minuto. Não grave o segredo no SQL versionado.

```sql
select vault.create_secret(
  '<mesmo valor de WEB_PUSH_CRON_SECRET configurado na Edge Function>',
  'web_push_cron_secret',
  'Autenticação do Cron para o dispatcher Web Push'
);
```

Monitore `cron.job_run_details`, `net._http_response`, os logs da Edge Function e as tabelas `notification_outbox`/`notification_delivery_attempts`. O outbox é idempotente por usuário, workspace, canal e chave do lembrete; falhas transitórias usam backoff e endpoints expirados são desativados.

Incidentes operacionais ficam na tabela privada `notification_operational_incidents` e são enviados ao Sentry no máximo uma vez por tipo/origem a cada dia UTC. O dispatcher não envia endpoint, chaves push, título ou conteúdo da notificação ao Sentry. Se o Sentry estiver indisponível, o incidente permanece sem `reported_at` e o dispatcher tenta novamente a cada 15 minutos.

### Login com Google

O provedor Google OAuth está habilitado no Supabase. O Client Secret permanece somente no backend do Supabase e nunca deve ser adicionado ao React, à Vercel ou ao GitHub.

Para reaplicar `supabase/config.toml` com segurança, forneça as variáveis apenas no processo local da CLI:

- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`;
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`.

As URLs de callback autorizadas ficam versionadas em `supabase/config.toml`, sem credenciais.

## Supabase remoto

- Projeto: `nkrkjvknjwzfvmlhfhxl` (`Aplicativo Sistema Planejamento`)
- PostgreSQL: versão 17
- Migrations e políticas RLS aplicadas e validadas
- Confirmação de e-mail permanece obrigatória
- A URL e a Publishable key devem existir somente em `.env.local` ou nas variáveis do provedor de deploy

Após o cadastro, o aplicativo orienta o usuário a confirmar o link recebido antes do primeiro login.

## Deploy

### Vercel (produção recomendada)

O aplicativo está publicado em `https://app-sistema-planejamento.vercel.app` e conectado ao repositório `Bruno-BFS/App_Sistema_Planejamento`. Cada atualização da branch `main` gera automaticamente um novo deploy de produção.

Configuração atual:

- Framework Preset: `Vite`;
- Build Command: `npm run build`;
- Output Directory: `dist`;
- Production Branch: `main`;
- variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nos ambientes Production e Preview.

O arquivo `vercel.json` mantém as rotas do React Router funcionais em acessos diretos, como `/tarefas`. A URL da Vercel também é a `site_url` do Supabase Auth. Nunca configure `service_role` no frontend ou na Vercel.

Páginas públicas usadas no consentimento OAuth:

- Página institucional: `https://app-sistema-planejamento.vercel.app/sobre.html`;
- Política de Privacidade: `https://app-sistema-planejamento.vercel.app/privacidade`;
- Termos de Uso: `https://app-sistema-planejamento.vercel.app/termos`.

O arquivo `public/google903991729b07d044.html` mantém a propriedade da URL da Vercel verificada no Google Search Console e não deve ser removido.

### GitHub Pages (mantido durante a transição)

O workflow atual continua publicando a branch `main` em `https://bruno-bfs.github.io/App_Sistema_Planejamento/`, executando instalação limpa, lint e build. As variáveis exigidas no GitHub Actions são `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.

O GitHub Pages pode ser desativado em uma mudança separada depois de confirmar o fluxo de cadastro e login por e-mail em produção.

## MVP atual

- cadastro e login por e-mail;
- workspace pessoal criado automaticamente;
- tela Hoje responsiva;
- criação e conclusão de tarefas;
- gestão de tarefas com descrição, data, busca, filtros e exclusão;
- prioridades e estimativa de tempo;
- cronômetro persistido no servidor;
- gestão de objetivos com horizonte, prioridade, prazo e progresso manual ou calculado;
- vínculo de tarefas a objetivos e indicadores de tarefas abertas/concluídas;
- alertas de objetivos sem próximas tarefas, próximos do prazo ou em risco;
- datas calculadas no fuso horário local do usuário;
- isolamento multi-tenant por workspace e políticas RLS.

## Comandos

```powershell
npm run dev
npm run build
npm run lint
```
