import { BarChart3, CalendarDays, CheckSquare2, LogOut, Sparkles, Target } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export function AppLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={20} /></span>
          <span>Meu Ritmo</span>
        </div>

        <nav className="nav-list" aria-label="Navegação principal">
          <NavLink className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end to="/"><CalendarDays size={19} /> Hoje</NavLink>
          <NavLink className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} to="/tarefas"><CheckSquare2 size={19} /> Tarefas</NavLink>
          <span className="nav-item disabled"><Target size={19} /> Objetivos <small>em breve</small></span>
          <span className="nav-item disabled"><BarChart3 size={19} /> Análises <small>em breve</small></span>
        </nav>

        <div className="sidebar-footer">
          <div className="user-summary">
            <span className="avatar">{user?.email?.slice(0, 1).toUpperCase()}</span>
            <span><strong>{user?.user_metadata.name ?? 'Minha conta'}</strong><small>{user?.email}</small></span>
          </div>
          <button className="icon-button" type="button" onClick={() => void signOut()} aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="main-content"><Outlet /></main>
    </div>
  )
}
