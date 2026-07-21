import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const themeMock = vi.hoisted(() => ({ setTheme: vi.fn() }))
const avatarMock = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'bruno@example.com', user_metadata: { full_name: 'Bruno' }, app_metadata: { provider: 'google' } },
    signOut: vi.fn(), updatePassword: vi.fn(), updateProfile: vi.fn(),
    uploadProfileAvatar: avatarMock.upload, removeProfileAvatar: avatarMock.remove,
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
  beforeEach(() => {
    vi.clearAllMocks()
    avatarMock.upload.mockResolvedValue('https://example.com/avatar.webp')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:avatar-preview') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

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

  it('permite selecionar uma imagem local e confirmar o envio', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    const image = new File(['imagem'], 'perfil.png', { type: 'image/png' })

    await user.upload(screen.getByLabelText('Selecionar foto de perfil'), image)
    expect(screen.getByRole('button', { name: 'Salvar foto' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Salvar foto' }))

    expect(avatarMock.upload).toHaveBeenCalledWith(image)
    expect(await screen.findByText('Foto atualizada em todo o aplicativo.')).toBeInTheDocument()
  })
})
