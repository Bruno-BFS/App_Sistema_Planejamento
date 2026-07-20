import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const themeMock = vi.hoisted(() => ({ setTheme: vi.fn() }))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'bruno@example.com', user_metadata: { full_name: 'Bruno' }, app_metadata: { provider: 'google' } },
    signOut: vi.fn(), updatePassword: vi.fn(), updateProfile: vi.fn(),
  }),
}))
vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({
    theme: 'olive', saving: false, setTheme: themeMock.setTheme,
    options: [
      { value: 'olive', label: 'Oliva', description: 'Natural', colors: ['#1', '#2', '#3'] },
      { value: 'rose', label: 'Rosa', description: 'Suave', colors: ['#1', '#2', '#3'] },
      { value: 'charcoal', label: 'Cinza escuro', description: 'Sóbrio', colors: ['#1', '#2', '#3'] },
      { value: 'blue', label: 'Azul', description: 'Calmo', colors: ['#1', '#2', '#3'] },
    ],
  }),
}))

describe('SettingsPage', () => {
  it('mostra os quatro temas e permite escolher uma nova paleta', async () => {
    const user = userEvent.setup()
    themeMock.setTheme.mockResolvedValue(undefined)
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    expect(screen.getByRole('radio', { name: 'Oliva: Natural' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Rosa: Suave' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Cinza escuro: Sóbrio' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Azul: Calmo' })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Azul: Calmo' }))
    expect(themeMock.setTheme).toHaveBeenCalledWith('blue')
  })
})
