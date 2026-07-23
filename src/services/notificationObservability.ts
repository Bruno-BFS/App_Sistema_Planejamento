import { supabase } from '../lib/supabase'

export type DeliveryHealthLevel = 'healthy' | 'warning' | 'critical' | 'inactive'
export type DeliveryOutcome = 'sent' | 'retryable_error' | 'permanent_error'
export type OutboxStatus = 'pending' | 'processing' | 'retry' | 'sent' | 'failed' | 'cancelled'

interface PushSubscriptionRow {
  id: string
  failure_count: number
  last_error: string | null
  last_seen_at: string
  disabled_at: string | null
}

interface OutboxRow {
  id: string
  title: string
  status: OutboxStatus
  attempts: number
  scheduled_for: string
  sent_at: string | null
  last_error: string | null
  created_at: string
}

interface DeliveryAttemptRow {
  id: number
  outbox_id: string
  outcome: DeliveryOutcome
  status_code: number | null
  error_message: string | null
  created_at: string
}

export interface DeliveryHistoryItem extends OutboxRow {
  latest_outcome: DeliveryOutcome | null
  latest_status_code: number | null
}

export interface NotificationDeliveryHealth {
  level: DeliveryHealthLevel
  activeSubscriptions: number
  sent: number
  failed: number
  queued: number
  cancelled: number
  successRate: number | null
  failuresLast24Hours: number
  recurringFailure: boolean
  lastDeliveryAt: string | null
  lastError: string | null
  history: DeliveryHistoryItem[]
}

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

export function summarizeNotificationDelivery(
  pushEnabled: boolean,
  subscriptions: PushSubscriptionRow[],
  outbox: OutboxRow[],
  attempts: DeliveryAttemptRow[],
  now = new Date(),
): NotificationDeliveryHealth {
  const activeSubscriptions = subscriptions.filter((item) => !item.disabled_at).length
  const sent = outbox.filter((item) => item.status === 'sent').length
  const failed = outbox.filter((item) => item.status === 'failed').length
  const queued = outbox.filter((item) => ['pending', 'processing', 'retry'].includes(item.status)).length
  const cancelled = outbox.filter((item) => item.status === 'cancelled').length
  const terminal = sent + failed
  const last24Hours = now.getTime() - 24 * 60 * 60 * 1000
  const failedAttempts = attempts.filter((item) => item.outcome !== 'sent')
  const failuresLast24Hours = failedAttempts.filter((item) => new Date(item.created_at).getTime() >= last24Hours).length
  const recurringFailure = failuresLast24Hours >= 3
    || subscriptions.some((item) => !item.disabled_at && item.failure_count >= 3)

  let level: DeliveryHealthLevel = 'healthy'
  if (!pushEnabled) level = 'inactive'
  else if (activeSubscriptions === 0 || recurringFailure) level = 'critical'
  else if (failed > 0 || queued > 0 || failedAttempts.length > 0) level = 'warning'

  const attemptsByOutbox = new Map<string, DeliveryAttemptRow>()
  for (const attempt of attempts) {
    if (!attemptsByOutbox.has(attempt.outbox_id)) attemptsByOutbox.set(attempt.outbox_id, attempt)
  }

  const lastFailedAttempt = failedAttempts[0]
  const lastFailedOutbox = outbox.find((item) => item.last_error)
  const failingSubscription = subscriptions.find((item) => item.last_error)

  return {
    level,
    activeSubscriptions,
    sent,
    failed,
    queued,
    cancelled,
    successRate: terminal > 0 ? Math.round((sent / terminal) * 100) : null,
    failuresLast24Hours,
    recurringFailure,
    lastDeliveryAt: outbox.find((item) => item.sent_at)?.sent_at ?? null,
    lastError: lastFailedAttempt?.error_message ?? lastFailedOutbox?.last_error ?? failingSubscription?.last_error ?? null,
    history: outbox.slice(0, 8).map((item) => {
      const latestAttempt = attemptsByOutbox.get(item.id)
      return {
        ...item,
        latest_outcome: latestAttempt?.outcome ?? null,
        latest_status_code: latestAttempt?.status_code ?? null,
      }
    }),
  }
}

export async function getNotificationDeliveryHealth(
  workspaceId: string,
  userId: string,
  pushEnabled: boolean,
) {
  const client = requireClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [subscriptionsResult, outboxResult, attemptsResult] = await Promise.all([
    client
      .from('push_subscriptions')
      .select('id,failure_count,last_error,last_seen_at,disabled_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false }),
    client
      .from('notification_outbox')
      .select('id,title,status,attempts,scheduled_for,sent_at,last_error,created_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100),
    client
      .from('notification_delivery_attempts')
      .select('id,outbox_id,outcome,status_code,error_message,created_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (subscriptionsResult.error) throw subscriptionsResult.error
  if (outboxResult.error) throw outboxResult.error
  if (attemptsResult.error) throw attemptsResult.error

  return summarizeNotificationDelivery(
    pushEnabled,
    (subscriptionsResult.data ?? []) as PushSubscriptionRow[],
    (outboxResult.data ?? []) as OutboxRow[],
    (attemptsResult.data ?? []) as DeliveryAttemptRow[],
  )
}
