import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingExperience } from './OnboardingExperience'

const planningMocks = vi.hoisted(() => ({
  completeOnboarding: vi.fn(),
  getProfilePreferences: vi.fn(),
}))
const themeMocks = vi.hoisted(() => ({ setTheme: vi.fn() }))

vi.mock('../services/planning', () => planningMocks)
vi.mock('../context/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1', user_metadata: { full_name: 'Bruno Soares' } } }) }))
vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({
    theme: 'olive', saving: false, setTheme: themeMocks.setTheme,
    options: [
      { value: 'olive', label: 'Oliva', description: 'Natural', colors: ['#1', '#2', '#3'] },
      { value: 'rose', label: 'Rosa', description: 'Suave', colors: ['#1', '#2', '#3'] },
      { value: 'charcoal', label: 'Cinza escuro', description: 'Sóbrio', colors: ['#1', '#2', '#3'] },
      { value: 'blue', label: 'Azul', description: 'Calmo', colors: ['#1', '#2', '#3'] },
    ],
  }),
}))

function renderOnboarding() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<MemoryRouter><QueryClientProvider client={queryClient}><OnboardingExperience /></QueryClientProvider></MemoryRouter>)
}

describe('OnboardingExperience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planningMocks.getProfilePreferences.mockResolvedValue({
      id: 'user-1', name: 'Bruno', companion_type: 'fox', app_theme: 'olive', onboarding_completed_at: null,
    })
    planningMocks.completeOnboarding.mockResolvedValue(undefined)
    themeMocks.setTheme.mockResolvedValue(undefined)
  })

  it('apresenta o produto e salva tema e mascote escolhidos', async () => {
    const user = userEvent.setup()
    renderOnboarding()

    expect(await screen.findByRole('heading', { name: 'Organize seu tempo sem transformar a vida em uma lista infinita.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Conhecer meu espaço' }))
    await user.click(screen.getByRole('radio', { name: 'Azul: Calmo' }))
    expect(themeMocks.setTheme).toHaveBeenCalledWith('blue')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('radio', { name: 'Bento, a capivara' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('button', { name: 'Começar meu planejamento' }))

    await waitFor(() => expect(planningMocks.completeOnboarding).toHaveBeenCalledWith('user-1', 'capybara'))
  })

  it('não aparece para um perfil que já concluiu a introdução', async () => {
    planningMocks.getProfilePreferences.mockResolvedValue({
      id: 'user-1', name: 'Bruno', companion_type: 'fox', app_theme: 'olive', onboarding_completed_at: '2026-07-21T00:00:00Z',
    })
    renderOnboarding()

    await waitFor(() => expect(planningMocks.getProfilePreferences).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
