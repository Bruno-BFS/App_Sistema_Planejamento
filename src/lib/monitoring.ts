const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim()
let sentryClient: typeof import('@sentry/react') | null = null

export function initializeMonitoring() {
  if (!sentryDsn) return

  void import('@sentry/react').then((Sentry) => {
    sentryClient = Sentry
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION,
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
    })
  })
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  const normalizedError = error instanceof Error ? error : new Error(String(error))

  if (sentryClient) {
    sentryClient.withScope((scope) => {
      if (context) scope.setContext('application', context)
      sentryClient?.captureException(normalizedError)
    })
  }

  if (import.meta.env.DEV) console.error(normalizedError, context)
}
