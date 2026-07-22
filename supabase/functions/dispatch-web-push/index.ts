import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

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

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const requestId = crypto.randomUUID()

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
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: enqueued, error: enqueueError } = await serviceClient.rpc('enqueue_due_push_notifications')
    if (enqueueError) throw enqueueError
    const { data: claimedRows, error: claimError } = await serviceClient.rpc('claim_push_notifications', { p_limit: 50 })
    if (claimError) throw claimError
    const messages = (claimedRows ?? []) as OutboxMessage[]
    const summary = { enqueued: Number(enqueued ?? 0), claimed: messages.length, sent: 0, retried: 0, failed: 0 }

    for (const message of messages) {
      const { data: subscriptionRows, error: subscriptionError } = await serviceClient
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, failure_count')
        .eq('workspace_id', message.workspace_id)
        .eq('user_id', message.user_id)
        .is('disabled_at', null)
      if (subscriptionError) throw subscriptionError
      const subscriptions = (subscriptionRows ?? []) as StoredSubscription[]

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
          retryableFailure ||= !permanent
          lastError = details.message
          const [subscriptionUpdate, attemptInsert] = await Promise.all([
            serviceClient.from('push_subscriptions').update({
              failure_count: subscription.failure_count + 1,
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
    return json({ error: 'Não foi possível processar as notificações.', requestId }, 500)
  }
})
