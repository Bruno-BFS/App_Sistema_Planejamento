import { useState, type FormEvent } from 'react'
import { BellRing, ChevronRight, FileText, KeyRound, LogOut, PlugZap, Save, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export function SettingsPage() {
  const { user, signOut, updatePassword, updateProfile } = useAuth()
  const displayName = user?.user_metadata.full_name ?? user?.user_metadata.name ?? 'Minha conta'
  const avatarUrl = user?.user_metadata.avatar_url ?? user?.user_metadata.picture
  const provider = user?.app_metadata.provider === 'google' ? 'Conta Google' : 'Conta por e-mail'
  const [name, setName] = useState(displayName)
  const [newPassword, setNewPassword] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [securityMessage, setSecurityMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setProfileMessage('')
    try {
      await updateProfile(name.trim())
      setProfileMessage('Nome atualizado com sucesso.')
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSecurityMessage('')
    try {
      await updatePassword(newPassword)
      setNewPassword('')
      setSecurityMessage('Senha atualizada com segurança.')
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a senha.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="today-page settings-page">
    <header className="page-header">
      <div>
        <span className="eyebrow">Sua conta</span>
        <h1>Configurações</h1>
        <p>Gerencie sua conta, seus avisos e as conexões do Meu Ritmo em um único lugar.</p>
      </div>
    </header>

    <section className="settings-profile-card">
      <span className="settings-profile-avatar">
        {displayName.slice(0, 1).toUpperCase()}
        {avatarUrl && <img src={avatarUrl} alt={`Foto de ${displayName}`} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true }} />}
      </span>
      <div>
        <span className="eyebrow"><UserRound size={14} /> Perfil conectado</span>
        <h2>{displayName}</h2>
        <p>{user?.email}</p>
      </div>
      <span className="account-provider"><ShieldCheck size={16} /> {provider}</span>
    </section>

    <section className="settings-account-grid" aria-label="Dados da conta">
      <form className="settings-account-card" onSubmit={handleProfileSubmit}>
        <header><span className="settings-card-icon sage"><UserRound size={21} /></span><div><h2>Perfil</h2><p>Como seu nome aparece no aplicativo.</p></div></header>
        <label><span>Nome</span><input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
        {profileMessage && <p className="settings-feedback" role="status">{profileMessage}</p>}
        <button className="secondary-button" disabled={saving || name.trim() === displayName} type="submit"><Save size={16} /> Salvar perfil</button>
      </form>

      <form className="settings-account-card" onSubmit={handlePasswordSubmit}>
        <header><span className="settings-card-icon violet"><KeyRound size={21} /></span><div><h2>Segurança</h2><p>Atualize a senha da conta por e-mail.</p></div></header>
        <label><span>Nova senha</span><input required minLength={8} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" /></label>
        {securityMessage && <p className="settings-feedback" role="status">{securityMessage}</p>}
        <button className="secondary-button" disabled={saving || newPassword.length < 8} type="submit"><ShieldCheck size={16} /> Atualizar senha</button>
      </form>
    </section>

    <section className="settings-grid" aria-label="Opções de configuração">
      <Link className="settings-card" to="/notificacoes">
        <span className="settings-card-icon sage"><BellRing size={22} /></span>
        <span><strong>Notificações</strong><small>Defina lembretes, horários e avisos do navegador.</small></span>
        <ChevronRight size={19} />
      </Link>
      <Link className="settings-card" to="/integracoes">
        <span className="settings-card-icon violet"><PlugZap size={22} /></span>
        <span><strong>Integrações e aplicativo</strong><small>Conecte o Google Calendar e gerencie a instalação.</small></span>
        <ChevronRight size={19} />
      </Link>
      <Link className="settings-card" to="/privacidade">
        <span className="settings-card-icon blue"><ShieldCheck size={22} /></span>
        <span><strong>Privacidade</strong><small>Consulte como seus dados são tratados e protegidos.</small></span>
        <ChevronRight size={19} />
      </Link>
      <Link className="settings-card" to="/termos">
        <span className="settings-card-icon amber"><FileText size={22} /></span>
        <span><strong>Termos de uso</strong><small>Veja as condições de uso do Meu Ritmo.</small></span>
        <ChevronRight size={19} />
      </Link>
    </section>

    <section className="settings-session-card">
      <div><strong>Encerrar sessão</strong><p>Saia com segurança desta conta neste dispositivo.</p></div>
      <button className="secondary-button" type="button" onClick={() => void signOut()}><LogOut size={17} /> Sair da conta</button>
    </section>
  </div>
}
