import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { useAuth } from './context/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'
import { TodayPage } from './pages/TodayPage'

const TasksPage = lazy(() => import('./pages/TasksPage').then((module) => ({ default: module.TasksPage })))
const PrivacyPage = lazy(() => import('./pages/LegalPage').then((module) => ({ default: module.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/LegalPage').then((module) => ({ default: module.TermsPage })))

function ProtectedApp() {
  const { user, loading } = useAuth()

  if (loading) return <div className="loading-screen">Carregando seu planejamento…</div>
  if (!user) return <Navigate to="/login" replace />
  return <AppLayout />
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupPage />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/privacidade" element={<Suspense fallback={<div className="loading-screen">Carregando documento…</div>}><PrivacyPage /></Suspense>} />
      <Route path="/termos" element={<Suspense fallback={<div className="loading-screen">Carregando documento…</div>}><TermsPage /></Suspense>} />
      <Route element={<ProtectedApp />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/tarefas" element={<Suspense fallback={<div className="page-state">Carregando tarefas…</div>}><TasksPage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
