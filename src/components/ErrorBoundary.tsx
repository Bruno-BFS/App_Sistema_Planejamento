import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { reportError } from '../lib/monitoring'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { componentStack: info.componentStack })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="fatal-error" role="alert">
        <span><AlertTriangle size={28} /></span>
        <h1>Algo não saiu como esperado.</h1>
        <p>O erro foi registrado. Recarregue o aplicativo para continuar com segurança.</p>
        <button className="primary-button" type="button" onClick={() => window.location.reload()}>
          <RefreshCw size={17} /> Recarregar aplicativo
        </button>
      </main>
    )

  }
}
