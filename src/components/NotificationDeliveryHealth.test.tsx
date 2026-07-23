import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationDeliveryHealth } from './NotificationDeliveryHealth'

const observabilityMock = vi.hoisted(() => ({ getHealth: vi.fn() }))

vi.mock('../services/notificationObservability', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/notificationObservability')>()
  return { ...original, getNotificationDeliveryHealth: observabilityMock.getHealth }
})

function renderHealth(pushEnabled = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationDeliveryHealth workspaceId="workspace-1" userId="user-1" pushEnabled={pushEnabled} />
    </QueryClientProvider>,
  )
}

describe('NotificationDeliveryHealth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra métricas e histórico de uma entrega saudável', async () => {
    observabilityMock.getHealth.mockResolvedValue({
      level: 'healthy',
      activeSubscriptions: 1,
      sent: 1,
      failed: 0,
      queued: 0,
      cancelled: 0,
      successRate: 100,
      failuresLast24Hours: 0,
      recurringFailure: false,
      lastDeliveryAt: '2026-07-23T12:00:00.000Z',
      lastError: null,
      history: [{
        id: 'out-1',
        title: 'Teste Web Push',
        status: 'sent',
        attempts: 1,
        scheduled_for: '2026-07-23T12:00:00.000Z',
        sent_at: '2026-07-23T12:00:00.000Z',
        last_error: null,
        created_at: '2026-07-23T12:00:00.000Z',
        latest_outcome: 'sent',
        latest_status_code: 201,
      }],
    })

    renderHealth()

    expect(await screen.findByRole('heading', { name: 'Entrega saudável' })).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('Teste Web Push')).toBeInTheDocument()
    expect(screen.getByText(/HTTP 201/)).toBeInTheDocument()
  })

  it('expõe orientação quando existem falhas recorrentes', async () => {
    observabilityMock.getHealth.mockResolvedValue({
      level: 'critical',
      activeSubscriptions: 1,
      sent: 0,
      failed: 1,
      queued: 0,
      cancelled: 0,
      successRate: 0,
      failuresLast24Hours: 3,
      recurringFailure: true,
      lastDeliveryAt: null,
      lastError: 'Serviço temporariamente indisponível',
      history: [],
    })

    renderHealth()

    expect(await screen.findByRole('heading', { name: 'Ação necessária' })).toBeInTheDocument()
    expect(screen.getByText('Falhas recorrentes detectadas')).toBeInTheDocument()
    expect(screen.getByText(/Serviço temporariamente indisponível/)).toBeInTheDocument()
  })
})
