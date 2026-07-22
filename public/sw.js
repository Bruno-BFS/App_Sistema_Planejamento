const CACHE_NAME = 'meu-ritmo-shell-__BUILD_VERSION__'
const scopeUrl = new URL('./', self.registration.scope)
const APP_SHELL = ['', 'manifest.webmanifest', 'app-icon-mr-192.png', 'app-icon-mr-512.png', 'brand/planner-mark-96.png']
  .map((asset) => new URL(asset, scopeUrl).toString())

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(scopeUrl.toString())))
    return
  }

  if (!['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) return
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        return response
      })
      return cached ?? network
    }),
  )
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() ?? '' }
  }

  const title = typeof payload.title === 'string' ? payload.title : 'Meu Ritmo'
  const body = typeof payload.body === 'string' ? payload.body : 'Você tem um novo lembrete.'
  const actionPath = typeof payload.actionPath === 'string' ? payload.actionPath : '/hoje'
  const tag = typeof payload.tag === 'string' ? payload.tag : 'meu-ritmo:reminder'
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    renotify: false,
    icon: new URL('app-icon-mr-192.png', scopeUrl).toString(),
    badge: new URL('brand/planner-mark-96.png', scopeUrl).toString(),
    data: { actionPath },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawPath = typeof event.notification.data?.actionPath === 'string' ? event.notification.data.actionPath : '/hoje'
  const targetUrl = new URL(rawPath.replace(/^\//, ''), scopeUrl).toString()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const current = clients.find((client) => new URL(client.url).origin === self.location.origin)
      if (current) {
        await current.navigate(targetUrl)
        return current.focus()
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
