import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react'
import { getNotificationDeliveryHealth, type DeliveryHealthLevel, type OutboxStatus } from '../services/notificationObservability'

interface NotificationDeliveryHealthProps {
  workspaceId: string
  userId: string
  pushEnabled: boolean
}

const statusLabels: Record<OutboxStatus, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  retry: 'Nova tentativa',
  sent: 'Entregue',
  failed: 'Falhou',
  cancelled: 'Cancelado',
}

const healthCopy: Record<DeliveryHealthLevel, { title: string; body: string }> = {
  healthy: { title: 'Entrega saudável', body: 'Nenhuma falha ou fila pendente foi detectada nos últimos 7 dias.' },
  warning: { title: 'Entrega requer atenção', body: 'Há falhas isoladas ou itens aguardando uma nova tentativa.' },
  critical: { title: 'Ação necessária', body: 'O dispositivo está desconectado ou ocorreram falhas recorrentes nas últimas 24 horas.' },
  inactive: { title: 'Monitoramento em espera', body: 'Ative o segundo plano para começar a acompanhar as entregas.' },
}

function formatDateTime(value: string | null) {
  if (!value) return 'Ainda não houve entrega'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function NotificationDeliveryHealth({ workspaceId, userId, pushEnabled }: NotificationDeliveryHealthProps) {
  const healthQuery = useQuery({
    queryKey: ['notification-delivery-health', workspaceId, userId, pushEnabled],
    queryFn: () => getNotificationDeliveryHealth(workspaceId, userId, pushEnabled),
    refetchInterval: 60_000,
  })

  if (healthQuery.isLoading) {
    return <section className="notification-health-card" aria-busy="true"><p className="notification-health-state">Carregando saúde das entregas…</p></section>
  }

  if (healthQuery.isError || !healthQuery.data) {
    return <section className="notification-health-card notification-health-error">
      <ShieldAlert size={22} />
      <div><strong>Observabilidade indisponível</strong><p>Não foi possível consultar o histórico agora.</p></div>
      <button className="secondary-button compact" type="button" onClick={() => void healthQuery.refetch()}><RefreshCw size={15} /> Tentar novamente</button>
    </section>
  }

  const health = healthQuery.data
  const copy = healthCopy[health.level]
  const StatusIcon = health.level === 'healthy' ? CheckCircle2 : health.level === 'critical' ? ShieldAlert : AlertTriangle

  return <section className={`notification-health-card health-${health.level}`}>
    <div className="notification-health-heading">
      <span className="notification-health-icon"><StatusIcon size={22} /></span>
      <div><span className="eyebrow">Últimos 7 dias</span><h2>{copy.title}</h2><p>{copy.body}</p></div>
      <button className="secondary-button compact" type="button" disabled={healthQuery.isFetching} onClick={() => void healthQuery.refetch()} aria-label="Atualizar observabilidade"><RefreshCw size={15} className={healthQuery.isFetching ? 'spin' : ''} /> Atualizar</button>
    </div>

    <div className="notification-health-metrics">
      <article><Smartphone size={18} /><span><strong>{health.activeSubscriptions}</strong><small>dispositivo ativo</small></span></article>
      <article><CheckCircle2 size={18} /><span><strong>{health.successRate === null ? '—' : `${health.successRate}%`}</strong><small>sucesso terminal</small></span></article>
      <article><Clock3 size={18} /><span><strong>{health.queued}</strong><small>na fila</small></span></article>
      <article><AlertTriangle size={18} /><span><strong>{health.failuresLast24Hours}</strong><small>falhas em 24h</small></span></article>
    </div>

    {health.recurringFailure && <div className="notification-health-alert"><ShieldAlert size={18} /><div><strong>Falhas recorrentes detectadas</strong><p>Três ou mais tentativas falharam em 24 horas. Verifique a permissão do navegador e reative o segundo plano.</p></div></div>}
    {health.lastError && <p className="notification-health-last-error"><strong>Último erro:</strong> {health.lastError}</p>}

    <div className="notification-health-history-heading">
      <div><Activity size={18} /><h3>Histórico recente</h3></div>
      <span>Última entrega: {formatDateTime(health.lastDeliveryAt)}</span>
    </div>
    {health.history.length === 0
      ? <p className="notification-health-empty">Nenhuma notificação processada neste período.</p>
      : <div className="notification-health-history">
        {health.history.map((item) => <article key={item.id}>
          <span className={`delivery-status status-${item.status}`}>{statusLabels[item.status]}</span>
          <div><strong>{item.title}</strong><small>{formatDateTime(item.sent_at ?? item.scheduled_for)} · {item.attempts} tentativa{item.attempts === 1 ? '' : 's'}{item.latest_status_code ? ` · HTTP ${item.latest_status_code}` : ''}</small></div>
        </article>)}
      </div>}
  </section>
}
