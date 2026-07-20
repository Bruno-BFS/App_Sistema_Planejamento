import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

vi.mock('../lib/monitoring', () => ({ reportError: vi.fn() }))

function BrokenComponent(): never {
  throw new Error('falha controlada')
}

describe('ErrorBoundary', () => {
  it('mostra uma recuperação segura quando um componente falha', () => {
    render(<ErrorBoundary><BrokenComponent /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('Algo não saiu como esperado.')
    expect(screen.getByRole('button', { name: /recarregar aplicativo/i })).toBeVisible()
  })
})
