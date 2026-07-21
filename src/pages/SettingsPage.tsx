import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { BellRing, Camera, Check, ChevronRight, FileText, KeyRound, LogOut, Palette, PlugZap, Save, ShieldCheck, Trash2, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useTheme } from '../theme/useTheme'
import { validateAvatarFile } from '../services/profileAvatar'

export function SettingsPage() {
  const { user, signOut, updatePassword, updateProfile, uploadProfileAvatar, removeProfileAvatar } = useAuth()
  const { theme, options: themeOptions, saving: savingTheme, setTheme } = useTheme()
  const displayName = user?.user_metadata.full_name ?? user?.user_metadata.name ?? 'Minha conta'
  const avatarUrl = user?.user_metadata.avatar_url ?? user?.user_metadata.picture
  const provider = user?.app_metadata.provider === 'google' ? 'Conta Google' : 'Conta por e-mail'
  const [name, setName] = useState(displayName)
  const [newPassword, setNewPassword] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [securityMessage, setSecurityMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [themeMessage, setThemeMessage] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarMessage, setAvatarMessage] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const displayedAvatarUrl = avatarPreview || avatarUrl
  const hasCustomAvatar = Boolean(user?.user_metadata.custom_avatar_path)

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
  }, [avatarPreview])

  function chooseAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAvatarMessage('')
    try {
      validateAvatarFile(file)
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    } catch (error) {
      setAvatarFile(null)
      setAvatarPreview('')
      setAvatarMessage(error instanceof Error ? error.message : 'Não foi possível usar esta imagem.')
    }
  }

  function cancelAvatarChange() {
    setAvatarFile(null)
    setAvatarPreview('')
    setAvatarMessage('')
  }

  async function saveAvatar() {
    if (!avatarFile) return
    setAvatarSaving(true)
    setAvatarMessage('')
    try {
      await uploadProfileAvatar(avatarFile)
      setAvatarFile(null)
      setAvatarPreview('')
      setAvatarMessage('Foto atualizada em todo o aplicativo.')
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : 'Não foi possível salvar a foto.')
    } finally {
      setAvatarSaving(false)
    }
  }

  async function removeAvatar() {
    setAvatarSaving(true)
    setAvatarMessage('')
    try {
      await removeProfileAvatar()
      setAvatarMessage(user?.user_metadata.picture ? 'A foto da conta Google foi restaurada.' : 'Foto personalizada removida.')
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : 'Não foi possível remover a foto.')
    } finally {
      setAvatarSaving(false)
    }
  }

  async function chooseTheme(nextTheme: typeof theme) {
    if (nextTheme === theme || savingTheme) return
    setThemeMessage('')
    try {
      await setTheme(nextTheme)
      setThemeMessage('Tema atualizado e salvo na sua conta.')
    } catch {
      setThemeMessage('Não foi possível salvar o tema. Tente novamente.')
    }
  }

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
      <div className="settings-avatar-column">
        <span className="settings-profile-avatar">
          {displayName.slice(0, 1).toUpperCase()}
          {displayedAvatarUrl && <img src={displayedAvatarUrl} alt={`Foto de ${displayName}`} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true }} />}
          <button type="button" onClick={() => avatarInputRef.current?.click()} aria-label="Escolher nova foto"><Camera size={16} /></button>
        </span>
        <input ref={avatarInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Selecionar foto de perfil" onChange={chooseAvatarFile} />
      </div>
      <div>
        <span className="eyebrow"><UserRound size={14} /> Perfil conectado</span>
        <h2>{displayName}</h2>
        <p>{user?.email}</p>
      </div>
      <div className="settings-profile-controls">
        <span className="account-provider"><ShieldCheck size={16} /> {provider}</span>
        {avatarFile ? <div><button className="primary-button compact" disabled={avatarSaving} type="button" onClick={() => void saveAvatar()}><Save size={15} /> {avatarSaving ? 'Salvando…' : 'Salvar foto'}</button><button className="icon-button light" disabled={avatarSaving} type="button" onClick={cancelAvatarChange} aria-label="Cancelar nova foto"><X size={17} /></button></div>
          : <div><button className="secondary-button compact" disabled={avatarSaving} type="button" onClick={() => avatarInputRef.current?.click()}><Camera size={15} /> Alterar foto</button>{hasCustomAvatar && <button className="text-button compact danger-text" disabled={avatarSaving} type="button" onClick={() => void removeAvatar()}><Trash2 size={15} /> Remover</button>}</div>}
        {avatarMessage && <p className={avatarMessage.includes('atualizada') || avatarMessage.includes('restaurada') || avatarMessage.includes('removida') ? 'settings-feedback' : 'form-error'} role="status">{avatarMessage}</p>}
        <small>JPG, PNG ou WebP · máximo de 8 MB</small>
      </div>
    </section>

    <section className="settings-theme-card" aria-labelledby="theme-settings-title">
      <header>
        <span className="settings-card-icon sage"><Palette size={22} /></span>
        <div><h2 id="theme-settings-title">Aparência do aplicativo</h2><p>Escolha a paleta que combina melhor com o seu espaço.</p></div>
      </header>
      <div className="theme-choice-grid" role="radiogroup" aria-label="Tema do aplicativo">
        {themeOptions.map((option) => <button aria-checked={theme === option.value} aria-label={`${option.label}: ${option.description}`} className={theme === option.value ? 'active' : ''} disabled={savingTheme} key={option.value} onClick={() => void chooseTheme(option.value)} role="radio" type="button">
          <span className="theme-preview" aria-hidden="true">{option.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>
          <span><strong>{option.label}</strong><small>{option.description}</small></span>
          <span className="theme-selected-mark">{theme === option.value && <Check size={16} />}</span>
        </button>)}
      </div>
      <p className="settings-feedback theme-feedback" role="status">{savingTheme ? 'Salvando tema…' : themeMessage}</p>
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
