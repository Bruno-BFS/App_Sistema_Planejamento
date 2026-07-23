import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: null }))

import { summarizeNotificationDelivery } from './notificationObservability'

const now = new Date('2026-07-23T12:00:00.000Z')

describe('summarizeNotificationDelivery', () => {
  it('classifica uma entrega estável e calcula a taxa de sucesso', () => {
    const health = summarizeNotificationDelivery(
      true,
      [{ id: 'sub-1', failure_count: 0, last_error: null, last_seen_at: now.toISOString(), disabled_at: null }],
      [
        { id: 'out-1', title: 'Resumo', status: 'sent', attempts: 1, scheduled_for: now.toISOString(), sent_at: now.toISOString(), last_error: null, created_at: now.toISOString() },
        { id: 'out-2', title: 'Revisão', status: 'sent', attempts: 1, scheduled_for: now.toISOString(), sent_at: now.toISOString(), last_error: null, created_at: now.toISOString() },
      ],
      [
        { id: 2, outbox_id: 'out-2', outcome: 'sent', status_code: 201, error_message: null, created_at: now.toISOString() },
        { id: 1, outbox_id: 'out-1', outcome: 'sent', status_code: 201, error_message: null, created_at: now.toISOString() },
      ],
      now,
    )

    expect(health.level).toBe('healthy')
    expect(health.activeSubscriptions).toBe(1)
    expect(health.successRate).toBe(100)
    expect(health.history[0].latest_status_code).toBe(201)
  })

  it('gera alerta crítico após três falhas em 24 horas', () => {
    const attempts = [1, 2, 3].map((id) => ({
      id,
      outbox_id: `out-${id}`,
      outcome: 'retryable_error' as const,
      status_code: 503,
      error_message: 'Serviço temporariamente indisponível',
      created_at: new Date(now.getTime() - id * 60_000).toISOString(),
    }))
    const health = summarizeNotificationDelivery(
      true,
      [{ id: 'sub-1', failure_count: 3, last_error: 'Falha temporária', last_seen_at: now.toISOString(), disabled_at: null }],
      [],
      attempts,
      now,
    )

    expect(health.level).toBe('critical')
    expect(health.recurringFailure).toBe(true)
    expect(health.failuresLast24Hours).toBe(3)
    expect(health.lastError).toBe('Serviço temporariamente indisponível')
  })

  it('sinaliza criticidade quando o push está ativo sem dispositivo conectado', () => {
    const health = summarizeNotificationDelivery(true, [], [], [], now)
    expect(health.level).toBe('critical')
    expect(health.activeSubscriptions).toBe(0)
  })
})
