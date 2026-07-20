import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const authMock = vi.hoisted(() => ({
  user: null,
  session: null,
  loading: false,
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
  connectGoogleCalendar: vi.fn(),
  signUp: vi.fn(),
  resetPassword: vi.fn(),
  updatePassword: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../context/useAuth', () => ({ useAuth: () => authMock }))

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envia o link de recuperação de senha', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /esqueci minha senha/i }))
    await user.type(screen.getByLabelText('E-mail'), 'bruno@example.com')
    await user.click(screen.getByRole('button', { name: /enviar link seguro/i }))
    await waitFor(() => expect(authMock.resetPassword).toHaveBeenCalledWith('bruno@example.com'))
    expect(screen.getByRole('status')).toHaveTextContent('Enviamos um link de recuperação')
  })

  it('mantém o login por e-mail e Google disponíveis', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /entrar no meu ritmo/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /continuar com google/i })).toBeEnabled()
  })
})
