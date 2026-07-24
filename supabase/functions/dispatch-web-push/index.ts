import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {
  incidentWindow,
  operationalContext,
  operationalIncidentKey,
  type OperationalIncidentKind,
} from './incidents.ts'

interface OutboxMessage {
  id: string
  workspace_id: string
  user_id: string
  reminder_key: string
  title: string
  body: string
  action_path: string
  attempts: number
  max_attempts: number
}

interface StoredSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  failure_count: number
}

type ServiceClient = ReturnType<typeof createClient>

interface OperationalIncidentInput {
  kind: OperationalIncidentKind
  subject: string
  severity: 'warning' | 'error'
  message: string
  workspaceId?: string
  userId?: string
  context: Record<string, unknown>
}

const sentryDsn = Deno.env.get('SENTRY_DSN')?.trim()
let sentryClientPromise: ReturnType<typeof loadSentry> | null = null

async function loadSentry() {
  const Sentry = await import('npm:@sentry/deno@10.67.0')
  Sentry.init({
    dsn: sentryDsn!,
    environment: Deno.env.get('SENTRY_ENVIRONMENT')?.trim() || 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
  })
  return Sentry
}

function getSentryClient() {
  sentryClientPromise ??= loadSentry()
  return sentryClientPromise
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

async function secureEquals(left: string, right: string) {
  const encoder = new TextEncoder()
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ])
  const leftBytes = new Uint8Array(leftHash)
  const rightBytes = new Uint8Array(rightHash)
  let difference = 0
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index]
  return difference === 0
}

function errorDetails(error: unknown) {
  const candidate = error as { statusCode?: number; message?: string }
  return {
    statusCode: typeof candidate?.statusCode === 'number' ? candidate.statusCode : null,
    message: typeof candidate?.message === 'string' ? candidate.message.slice(0, 1000) : 'Falha desconhecida no provedor push.',
  }
}

async function reportOperationalIncident(serviceClient: ServiceClient, input: OperationalIncidentInput) {
  try {
    const { data, error } = await serviceClient.rpc('register_notification_operational_incident', {
      p_incident_key: operationalIncidentKey(input.kind, input.subject),
      p_kind: input.kind,
      p_severity: input.severity,
      p_message: input.message,
      p_workspace_id: input.workspaceId ?? null,
      p_user_id: input.userId ?? null,
      p_context: input.context,
    })
    if (error) throw error

    const incident = (data?.[0] ?? null) as {
      incident_id: string
      should_report: boolean
      occurrence_count: number
    } | null
    if (!incident?.should_report) return false

    if (!sentryDsn) {
      await serviceClient
        .from('notification_operational_incidents')
        .update({ last_report_error: 'SENTRY_DSN não configurado.' })
        .eq('id', incident.incident_id)
      console.warn(JSON.stringify({
        event: 'notification_incident_pending',
        incidentId: incident.incident_id,
        kind: input.kind,
        reason: 'sentry_not_configured',
      }))
      return false
    }

    const Sentry = await getSentryClient()
    const eventId = Sentry.withScope((scope) => {
      scope.setLevel(input.severity)
      scope.setTag('component', 'web-push-dispatcher')
      scope.setTag('incident_kind', input.kind)
      scope.setFingerprint(['notification-operations', input.kind, incidentWindow()])
      scope.setContext('notification_operation', {
        ...input.context,
        occurrence_count: incident.occurrence_count,
      })
      return Sentry.captureMessage(input.message)
    })
    const flushed = await Sentry.flush(2_000)
    if (!flushed) throw new Error('Sentry não confirmou o envio dentro do prazo.')

    const { error: updateError } = await serviceClient
      .from('notification_operational_incidents')
      .update({
        reported_at: new Date().toISOString(),
        sentry_event_id: eventId,
        last_report_error: null,
      })
      .eq('id', incident.incident_id)
    if (updateError) throw updateError
    return true
  } catch (error) {
    console.error(JSON.stringify({
      event: 'notification_incident_report_failed',
      kind: input.kind,
      message: error instanceof Error ? error.message.slice(0, 500) : 'Falha desconhecida.',
    }))
    return false
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const requestId = crypto.randomUUID()
  let serviceClient: ServiceClient | null = null

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const cronSecret = Deno.env.get('WEB_PUSH_CRON_SECRET')
    const vapidPublicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('WEB_PUSH_VAPID_SUBJECT')
    if (!supabaseUrl || !serviceRoleKey || !cronSecret || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      return json({ error: 'Função sem configuração interna.', requestId }, 500)
    }

    const suppliedSecret = request.headers.get('x-cron-secret') ?? ''
    if (!suppliedSecret || !(await secureEquals(suppliedSecret, cronSecret))) {
      return json({ error: 'Não autorizado.', requestId }, 401)
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: enqueued, error: enqueueError } = await serviceClient.rpc('enqueue_due_push_notifications')
    if (enqueueError) throw enqueueError
    const { data: claimedRows, error: claimError } = await serviceClient.rpc('claim_push_notifications', { p_limit: 50 })
    if (claimError) throw claimError
    const messages = (claimedRows ?? []) as OutboxMessage[]
    const summary = { enqueued: Number(enqueued ?? 0), claimed: messages.length, sent: 0, retried: 0, failed: 0, incidents: 0 }

    for (const message of messages) {
      const { data: subscriptionRows, error: subscriptionError } = await serviceClient
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, failure_count')
        .eq('workspace_id', message.workspace_id)
        .eq('user_id', message.user_id)
        .is('disabled_at', null)
      if (subscriptionError) throw subscriptionError
      const subscriptions = (subscriptionRows ?? []) as StoredSubscription[]
      if (subscriptions.length === 0) {
        const reported = await reportOperationalIncident(serviceClient, {
          kind: 'no_active_subscription',
          subject: `${message.workspace_id}:${message.user_id}`,
          severity: 'warning',
          message: 'Notificação Web Push sem dispositivo ativo.',
          workspaceId: message.workspace_id,
          userId: message.user_id,
          context: operationalContext({
            requestId,
            outboxId: message.id,
            attempts: message.attempts,
          }),
        })
        if (reported) summary.incidents += 1
      }

      let delivered = false
      let retryableFailure = false
      let lastError = ''

      for (const subscription of subscriptions) {
        let pushResult: Awaited<ReturnType<typeof webpush.sendNotification>> | null = null
        let pushError: unknown = null
        try {
          pushResult = await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          }, JSON.stringify({
            title: message.title,
            body: message.body,
            actionPath: message.action_path,
            tag: `meu-ritmo:${message.reminder_key}`.slice(0, 120),
          }), { TTL: 3600, urgency: 'normal', topic: message.id.replace(/-/g, '').slice(0, 32) })
        } catch (error) {
          pushError = error
        }

        if (pushResult) {
          delivered = true
          const [subscriptionUpdate, attemptInsert] = await Promise.all([
            serviceClient.from('push_subscriptions').update({ failure_count: 0, last_error: null, last_seen_at: new Date().toISOString() }).eq('id', subscription.id),
            serviceClient.from('notification_delivery_attempts').insert({
              outbox_id: message.id, subscription_id: subscription.id, workspace_id: message.workspace_id,
              user_id: message.user_id, outcome: 'sent', status_code: pushResult.statusCode,
            }),
          ])
          if (subscriptionUpdate.error) throw subscriptionUpdate.error
          if (attemptInsert.error) throw attemptInsert.error
        } else {
          const details = errorDetails(pushError)
          const permanent = details.statusCode === 404 || details.statusCode === 410
          const nextFailureCount = subscription.failure_count + 1
          retryableFailure ||= !permanent
          lastError = details.message
          const [subscriptionUpdate, attemptInsert] = await Promise.all([
            serviceClient.from('push_subscriptions').update({
              failure_count: nextFailureCount,
              last_error: details.message,
              disabled_at: permanent ? new Date().toISOString() : null,
            }).eq('id', subscription.id),
            serviceClient.from('notification_delivery_attempts').insert({
              outbox_id: message.id, subscription_id: subscription.id, workspace_id: message.workspace_id,
              user_id: message.user_id, outcome: permanent ? 'permanent_error' : 'retryable_error',
              status_code: details.statusCode, error_message: details.message,
            }),
          ])
          if (subscriptionUpdate.error) throw subscriptionUpdate.error
          if (attemptInsert.error) throw attemptInsert.error
          if (!permanent && nextFailureCount >= 3) {
            const reported = await reportOperationalIncident(serviceClient, {
              kind: 'delivery_recurring_failure',
              subject: subscription.id,
              severity: 'error',
              message: 'Falhas recorrentes na entrega Web Push.',
              workspaceId: message.workspace_id,
              userId: message.user_id,
              context: operationalContext({
                requestId,
                failureCount: nextFailureCount,
                statusCode: details.statusCode,
                outboxId: message.id,
                attempts: message.attempts,
              }),
            })
            if (reported) summary.incidents += 1
          }
        }
      }

      if (delivered) {
        const { error } = await serviceClient.from('notification_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), locked_at: null, last_error: null }).eq('id', message.id)
        if (error) throw error
        summary.sent += 1
      } else if (retryableFailure && message.attempts < message.max_attempts) {
        const delayMinutes = Math.min(60, 2 ** Math.max(0, message.attempts - 1))
        const nextAttempt = new Date(Date.now() + delayMinutes * 60_000).toISOString()
        const { error } = await serviceClient.from('notification_outbox').update({ status: 'retry', next_attempt_at: nextAttempt, locked_at: null, last_error: lastError }).eq('id', message.id)
        if (error) throw error
        summary.retried += 1
      } else {
        const { error } = await serviceClient.from('notification_outbox').update({ status: 'failed', locked_at: null, last_error: lastError || 'Nenhuma assinatura push ativa.' }).eq('id', message.id)
        if (error) throw error
        summary.failed += 1
      }
    }

    console.log(JSON.stringify({ event: 'web_push_dispatch_completed', requestId, ...summary }))
    return json({ requestId, ...summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada.'
    console.error(JSON.stringify({ event: 'web_push_dispatch_failed', requestId, message }))
    if (serviceClient) {
      await reportOperationalIncident(serviceClient, {
        kind: 'dispatcher_failure',
        subject: 'dispatch-web-push',
        severity: 'error',
        message: 'Falha fatal no dispatcher Web Push.',
        context: operationalContext({ requestId }),
      })
    }
    return json({ error: 'Não foi possível processar as notificações.', requestId }, 500)
  }
})
