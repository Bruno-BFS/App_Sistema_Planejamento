create index if not exists notification_outbox_user_history_idx
  on public.notification_outbox (user_id, workspace_id, created_at desc);

comment on index public.notification_outbox_user_history_idx is
  'Supports the user-facing Web Push delivery history without scanning the dispatcher queue.';
