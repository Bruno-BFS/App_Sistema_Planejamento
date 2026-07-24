export type OperationalIncidentKind =
  | 'delivery_recurring_failure'
  | 'no_active_subscription'
  | 'dispatcher_failure'

export function incidentWindow(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function operationalIncidentKey(kind: OperationalIncidentKind, subject: string, date = new Date()) {
  const normalizedSubject = subject.replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 180)
  return `${kind}:${normalizedSubject}:${incidentWindow(date)}`.slice(0, 300)
}

export function operationalContext(input: {
  requestId: string
  failureCount?: number
  statusCode?: number | null
  outboxId?: string
  attempts?: number
}) {
  return {
    request_id: input.requestId,
    failure_count: input.failureCount,
    status_code: input.statusCode,
    outbox_id: input.outboxId,
    attempts: input.attempts,
  }
}
