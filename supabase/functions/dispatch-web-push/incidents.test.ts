import { describe, expect, it } from 'vitest'
import { incidentWindow, operationalContext, operationalIncidentKey } from './incidents'

describe('notification operational incidents', () => {
  const date = new Date('2026-07-24T03:15:00.000Z')

  it('cria uma chave estável por origem e janela UTC diária', () => {
    expect(incidentWindow(date)).toBe('2026-07-24')
    expect(operationalIncidentKey('delivery_recurring_failure', 'subscription/123', date))
      .toBe('delivery_recurring_failure:subscription-123:2026-07-24')
  })

  it('mantém apenas metadados operacionais permitidos no contexto', () => {
    expect(operationalContext({
      requestId: 'request-1',
      failureCount: 3,
      statusCode: 503,
      outboxId: 'outbox-1',
      attempts: 2,
    })).toEqual({
      request_id: 'request-1',
      failure_count: 3,
      status_code: 503,
      outbox_id: 'outbox-1',
      attempts: 2,
    })
  })
})
