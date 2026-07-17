import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useAuth } from '../context/useAuth'

export function LoginPage() {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'signup') await signUp(email, password, name)
      else await signIn(email, password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível autenticar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="brand light"><span className="brand-mark"><Sparkles size={20} /></span> Meu Ritmo</div>
        <div>
          <span className="eyebrow dark">Planejamento com intenção</span>
          <h1>Menos listas.<br />Mais progresso real.</h1>
          <p>Planeje o dia, proteja seu foco e aprenda com a forma como você usa seu tempo.</p>
        </div>
        <small>Seu sistema pessoal de execução e revisão.</small>
      </section>
      <section className="login-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div><span className="eyebrow">Comece agora</span><h2>{mode === 'login' ? 'Que bom ter você de volta.' : 'Crie seu espaço pessoal.'}</h2></div>
          {mode === 'signup' && <label>Seu nome<input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>}
          <label>E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label>Senha<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'} <ArrowRight size={18} />
          </button>
          <button className="text-button" type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho uma conta'}
          </button>
        </form>
      </section>
    </main>
  )
}
