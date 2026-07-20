import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UpdatePrompt } from './components/UpdatePrompt'
import { initializeMonitoring, reportError } from './lib/monitoring'
import './index.css'

initializeMonitoring()

window.addEventListener('error', (event) => reportError(event.error ?? event.message, { source: 'window.error' }))
window.addEventListener('unhandledrejection', (event) => reportError(event.reason, { source: 'unhandledrejection' }))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

const routerBase = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('meu-ritmo:update-available'))
          }
        })
      })
    }).catch((error) => reportError(error, { source: 'service-worker-registration' }))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={routerBase}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ErrorBoundary><App /><UpdatePrompt /></ErrorBoundary>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
