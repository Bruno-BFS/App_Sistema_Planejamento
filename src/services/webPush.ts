import { supabase } from '../lib/supabase'

export type WebPushAvailability = 'available' | 'unsupported' | 'missing-key' | 'service-worker-unavailable'

export function getWebPushAvailability(): WebPushAvailability {
  if (typeof window === 'undefined' || !('Notification' in window) || !('PushManager' in window)) return 'unsupported'
  if (!('serviceWorker' in navigator)) return 'service-worker-unavailable'
  if (!import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY) return 'missing-key'
  return 'available'
}

export function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const bytes = window.atob(base64)
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0))
}

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

async function persistSubscription(workspaceId: string, subscription: PushSubscription) {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('O navegador retornou uma assinatura incompleta.')
  const { error } = await requireClient().rpc('register_push_subscription', {
    p_workspace_id: workspaceId,
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent.slice(0, 500),
  })
  if (error) throw error
}

export async function enableWebPush(workspaceId: string) {
  const availability = getWebPushAvailability()
  if (availability !== 'available') throw new Error(`Web Push indisponível: ${availability}.`)
  const publicKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY
  if (!publicKey) throw new Error('Chave pública VAPID ausente.')

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permissão de notificações não concedida.')

  const registration = await navigator.serviceWorker.ready
  const current = await registration.pushManager.getSubscription()
  const subscription = current ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
  await persistSubscription(workspaceId, subscription)
  return subscription
}

export async function refreshWebPushRegistration(workspaceId: string) {
  if (getWebPushAvailability() !== 'available' || Notification.permission !== 'granted') return false
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return false
  await persistSubscription(workspaceId, subscription)
  return true
}

export async function disableWebPush() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  const { error } = await requireClient().rpc('unregister_push_subscription', { p_endpoint: endpoint })
  if (error) throw error
  await subscription.unsubscribe()
}
