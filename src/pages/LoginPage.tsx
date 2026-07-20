import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { useAuth } from '../context/useAuth'

function GoogleMark() {
  return (
    <svg className="google-mark" aria-hidden="true" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.93A6.02 6.02 0 0 1 6.09 12c0-.67.12-1.32.31-1.93V7.45H3.06A10 10 0 0 0 2 12c0 1.64.39 3.19 1.06 4.55l3.34-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.94 5.45l3.34 2.62C7.19 7.7 9.4 5.94 12 5.94Z" />
    </svg>
  )
}

export function LoginPage() {
  const { user, signIn, signInWithGoogle, signUp, resetPassword, updatePassword } = useAuth()
  const queryMode = new URLSearchParams(window.location.search).get('mode')
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'recovery'>(queryMode === 'recovery' ? 'recovery' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('error_description') ?? params.get('error')
    if (!oauthError) return
    setError(oauthError)
    window.history.replaceState({}, document.title, window.location.pathname)
  }, [])

  if (user && mode !== 'recovery') return <Navigate to="/" replace />

  async function handleGoogleSignIn() {
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar com o Google.')
      setSubmitting(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      if (mode === 'forgot') {
        await resetPassword(email)
        setSuccess('Enviamos um link de recuperação para o seu e-mail.')
      } else if (mode === 'recovery') {
        await updatePassword(password)
        setSuccess('Senha atualizada com segurança. Você já pode continuar.')
        window.history.replaceState({}, document.title, window.location.pathname)
        window.setTimeout(() => setMode('login'), 1200)
      } else if (mode === 'signup') {
        const signedIn = await signUp(email, password, name)
        if (!signedIn) {
          setSuccess('Conta criada. Confirme o link enviado ao seu e-mail e depois entre no aplicativo.')
          setMode('login')
          setPassword('')
        }
      } else await signIn(email, password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível autenticar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <span className="login-orbit orbit-one" aria-hidden="true" />
        <span className="login-orbit orbit-two" aria-hidden="true" />

        <header className="login-brand-row">
          <div className="brand light"><span className="brand-mark image-mark primary-brand-mark"><img src={`${import.meta.env.BASE_URL}app-icon-mr-192.png`} alt="" /></span> Meu Ritmo</div>
          <span className="login-brand-note"><ShieldCheck size={14} /> Pessoal e privado</span>
        </header>

        <div className="login-hero-content">
          <div className="login-hero-copy">
            <span className="eyebrow dark">Planejamento com intenção</span>
            <h1>Seu tempo com mais <em>clareza.</em></h1>
            <p>Organize prioridades, proteja seu foco e entenda seu ritmo — sem transformar a vida em uma lista infinita.</p>
            <div className="login-benefits" aria-label="Benefícios do Meu Ritmo">
              <span><CheckCircle2 size={16} /> Planejamento simples</span>
              <span><Clock3 size={16} /> Foco protegido</span>
              <span><Target size={16} /> Progresso visível</span>
            </div>
          </div>

          <div className="login-planner-preview" aria-hidden="true">
            <header><span><CalendarDays size={16} /> Hoje</span><small>3 de 5 concluídas</small></header>
            <div className="login-progress"><span /></div>
            <div className="login-preview-task done"><i><Check size={13} /></i><span><strong>Revisar prioridades</strong><small>15 min</small></span></div>
            <div className="login-preview-task active"><i /><span><strong>Preparar apresentação</strong><small>Foco atual · 45 min</small></span><em>Em foco</em></div>
            <div className="login-preview-task"><i /><span><strong>Planejar a semana</strong><small>30 min</small></span></div>
          </div>
        </div>

        <footer className="login-intro-footer"><small>Seu sistema pessoal de execução e revisão.</small><span><Sparkles size={13} /> Evolua um pouco a cada dia</span></footer>
      </section>

      <section className="login-panel">
        <div className="login-panel-inner">
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-heading">
              <span className="eyebrow">{mode === 'login' ? 'Bem-vindo de volta' : mode === 'signup' ? 'Comece no seu ritmo' : 'Segurança da conta'}</span>
              <h2>{mode === 'login' ? 'Entre no seu espaço.' : mode === 'signup' ? 'Crie seu espaço pessoal.' : mode === 'forgot' ? 'Recupere sua senha.' : 'Defina uma nova senha.'}</h2>
              <p>{mode === 'login' ? 'Continue de onde parou e cuide do que importa hoje.' : mode === 'signup' ? 'Leva menos de um minuto. Depois, você personaliza tudo.' : mode === 'forgot' ? 'Enviaremos um link seguro para o seu e-mail.' : 'Use pelo menos oito caracteres para proteger sua conta.'}</p>
            </div>

            {(mode === 'login' || mode === 'signup') && <>
              <button className="oauth-button" disabled={submitting} type="button" onClick={handleGoogleSignIn}>
                <GoogleMark /> Continuar com Google
              </button>
              <div className="auth-divider"><span>ou use seu e-mail</span></div>
            </>}

            {mode === 'signup' && <label><span>Seu nome</span><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Como podemos chamar você?" /></label>}
            {mode !== 'recovery' && <label><span>E-mail</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="voce@exemplo.com" /></label>}
            {mode !== 'forgot' && <label><span>Senha {mode === 'recovery' && 'nova'}</span><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Mínimo de 8 caracteres" /></label>}
            {mode === 'login' && <button className="forgot-password-button" type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}>Esqueci minha senha</button>}

            {success && <p className="form-success" role="status">{success}</p>}
            {error && <p className="form-error auth-error" role="alert">{error}</p>}

            <button className="primary-button auth-submit" disabled={submitting} type="submit">
              {submitting ? 'Aguarde…' : mode === 'login' ? 'Entrar no Meu Ritmo' : mode === 'signup' ? 'Criar minha conta' : mode === 'forgot' ? 'Enviar link seguro' : 'Salvar nova senha'} <ArrowRight size={18} />
            </button>

            {(mode === 'login' || mode === 'signup') ? <p className="auth-mode-copy">
              {mode === 'login' ? 'Novo por aqui?' : 'Já possui uma conta?'}
              <button className="text-button" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess('') }}>
                {mode === 'login' ? 'Criar conta grátis' : 'Fazer login'}
              </button>
            </p> : <button className="text-button auth-back-button" type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}>Voltar para o login</button>}

            <div className="auth-security-note"><ShieldCheck size={16} /><span>Seus dados são protegidos e nunca serão vendidos.</span></div>
            <div className="auth-legal-links"><Link to="/privacidade">Privacidade</Link><span aria-hidden="true">•</span><Link to="/termos">Termos de uso</Link></div>
          </form>
        </div>
      </section>
    </main>
  )
}
