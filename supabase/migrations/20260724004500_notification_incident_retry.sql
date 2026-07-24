alter table public.notification_operational_incidents
  add column last_report_attempt_at timestamptz;

alter table public.notification_operational_incidents
  drop constraint notification_operational_incidents_kind_check;

alter table public.notification_operational_incidents
  add constraint notification_operational_incidents_kind_check
  check (kind in (
    'delivery_recurring_failure',
    'no_active_subscription',
    'dispatcher_failure',
    'observability_test'
  ));

comment on column public.notification_operational_incidents.last_report_attempt_at is
  'Throttles retries while an external incident remains pending.';
