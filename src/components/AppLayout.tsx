import { useEffect, useState } from 'react'
import {
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckSquare2,
  FolderKanban,
  LogOut,
  Menu,
  PlugZap,
  Settings2,
  Target,
  X,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { NotificationCenter } from './NotificationCenter'
import { CompanionCoach } from './CompanionCoach'

const mainNavigation = [
  { to: '/', label: 'Hoje', icon: CalendarDays, end: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarClock },
  { to: '/tarefas', label: 'Tarefas', icon: CheckSquare2 },
  { to: '/objetivos', label: 'Objetivos', icon: Target },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban },
]

const insightNavigation = [
  { to: '/revisao', label: 'Revisão diária', icon: CalendarCheck2 },
  { to: '/revisao-semanal', label: 'Revisão semanal', icon: CalendarRange },
  { to: '/analises', label: 'Análises', icon: BarChart3 },
  { to: '/integracoes', label: 'Integrações', icon: PlugZap },
  { to: '/configuracoes', label: 'Configurações', icon: Settings2 },
]

function Avatar({ avatarInitial, avatarUrl, displayName }: { avatarInitial?: string; avatarUrl?: string; displayName: string }) {
  return (
    <span className="avatar">
      {avatarInitial}
      {avatarUrl && <img src={avatarUrl} alt={`Foto de ${displayName}`} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true }} />}
    </span>
  )
}

function NavigationLink({ item, compact = false }: { item: typeof mainNavigation[number]; compact?: boolean }) {
  const Icon = item.icon
  return (
    <NavLink className={({ isActive }) => `${compact ? 'mobile-nav-item' : 'nav-item'} ${isActive ? 'active' : ''}`} end={item.end} to={item.to}>
      <Icon size={compact ? 20 : 19} />
      <span>{item.label}</span>
    </NavLink>
  )
}

export function AppLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const displayName = user?.user_metadata.full_name ?? user?.user_metadata.name ?? 'Minha conta'
  const avatarUrl = user?.user_metadata.avatar_url ?? user?.user_metadata.picture
  const avatarInitial = displayName === 'Minha conta'
    ? user?.email?.slice(0, 1).toUpperCase()
    : displayName.slice(0, 1).toUpperCase()
  const moreIsActive = insightNavigation.some((item) => location.pathname.startsWith(item.to)) || location.pathname === '/projetos'

  useEffect(() => setMoreOpen(false), [location.pathname])

  useEffect(() => {
    if (!moreOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [moreOpen])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark image-mark planner-brand-mark"><img src={`${import.meta.env.BASE_URL}brand/planner-mark-96.png`} alt="" /></span>
          <span>Meu Ritmo</span>
        </div>

        <nav className="desktop-navigation" aria-label="Navegação principal">
          <div className="nav-group">
            <span className="nav-group-label">Planejar</span>
            <div className="nav-list">{mainNavigation.map((item) => <NavigationLink item={item} key={item.to} />)}</div>
          </div>
          <div className="nav-group">
            <span className="nav-group-label">Acompanhar</span>
            <div className="nav-list">{insightNavigation.map((item) => <NavigationLink item={item} key={item.to} />)}</div>
          </div>
        </nav>

        <NotificationCenter />

        <div className="sidebar-footer">
          <Link className="user-summary user-summary-link" to="/configuracoes" aria-label="Abrir configurações da conta">
            <Avatar avatarInitial={avatarInitial} avatarUrl={avatarUrl} displayName={displayName} />
            <span><strong>{displayName}</strong><small>{user?.email}</small></span>
          </Link>
          <button className="icon-button" type="button" onClick={() => void signOut()} aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <header className="mobile-header">
        <div className="brand">
          <span className="brand-mark image-mark primary-brand-mark"><img src={`${import.meta.env.BASE_URL}app-icon-mr-192.png`} alt="" /></span>
          <span>Meu Ritmo</span>
        </div>
        <div className="mobile-header-actions">
          <NotificationCenter />
          <Link className="profile-avatar-link" to="/configuracoes" aria-label="Abrir configurações da conta">
            <Avatar avatarInitial={avatarInitial} avatarUrl={avatarUrl} displayName={displayName} />
          </Link>
        </div>
      </header>

      <main className="main-content"><Outlet /></main>

      {!['/', '/revisao'].includes(location.pathname) && <CompanionCoach />}

      <nav className="mobile-bottom-nav" aria-label="Navegação móvel">
        {mainNavigation.slice(0, 4).map((item) => <NavigationLink compact item={item} key={item.to} />)}
        <button className={`mobile-nav-item ${moreIsActive ? 'active' : ''}`} type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen}>
          <Menu size={20} />
          <span>Mais</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="mobile-more-overlay" role="presentation" onClick={() => setMoreOpen(false)}>
          <aside className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Mais opções" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <header>
              <div><span className="eyebrow">Seu espaço</span><h2>Mais opções</h2></div>
              <button className="icon-button light" type="button" onClick={() => setMoreOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
            </header>
            <nav className="mobile-more-list">
              {[mainNavigation[4], ...insightNavigation].map((item) => <NavigationLink item={item} key={item.to} />)}
            </nav>
            <footer>
              <Link className="user-summary user-summary-link" to="/configuracoes" aria-label="Abrir configurações da conta">
                <Avatar avatarInitial={avatarInitial} avatarUrl={avatarUrl} displayName={displayName} />
                <span><strong>{displayName}</strong><small>{user?.email}</small></span>
              </Link>
              <button className="secondary-button compact" type="button" onClick={() => void signOut()}><LogOut size={17} /> Sair</button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  )
}
