import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from './ThemeContext'
import { useTheme } from './useTheme'

const planningMocks = vi.hoisted(() => ({
  getProfilePreferences: vi.fn(),
  updateAppTheme: vi.fn(),
}))

vi.mock('../services/planning', () => planningMocks)
vi.mock('../context/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))

function ThemeProbe() {
  const { theme, setTheme } = useTheme()
  return <div><span>tema:{theme}</span><button type="button" onClick={() => void setTheme('blue').catch(() => undefined)}>Usar azul</button></div>
}

function renderThemeProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><ThemeProvider><ThemeProbe /></ThemeProvider></QueryClientProvider>)
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
    planningMocks.getProfilePreferences.mockResolvedValue({ id: 'user-1', name: 'Bruno', companion_type: 'fox', app_theme: 'rose' })
    planningMocks.updateAppTheme.mockResolvedValue(undefined)
  })

  it('aplica o tema salvo no perfil ao entrar', async () => {
    renderThemeProvider()

    await screen.findByText('tema:rose')
    expect(document.documentElement.dataset.theme).toBe('rose')
    expect(window.localStorage.getItem('meu-ritmo:theme:user-1')).toBe('rose')
  })

  it('aplica e persiste uma nova escolha do usuário', async () => {
    const user = userEvent.setup()
    renderThemeProvider()
    await screen.findByText('tema:rose')

    await user.click(screen.getByRole('button', { name: 'Usar azul' }))

    await waitFor(() => expect(planningMocks.updateAppTheme).toHaveBeenCalledWith('user-1', 'blue'))
    expect(document.documentElement.dataset.theme).toBe('blue')
    expect(window.localStorage.getItem('meu-ritmo:theme:user-1')).toBe('blue')
  })

  it('restaura o tema anterior quando o salvamento falha', async () => {
    const user = userEvent.setup()
    planningMocks.updateAppTheme.mockRejectedValue(new Error('falha'))
    renderThemeProvider()
    await screen.findByText('tema:rose')

    await user.click(screen.getByRole('button', { name: 'Usar azul' }))

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('rose'))
    expect(window.localStorage.getItem('meu-ritmo:theme:user-1')).toBe('rose')
  })
})
