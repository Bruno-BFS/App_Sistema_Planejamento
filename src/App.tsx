import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { useAuth } from './context/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'

const TodayPage = lazy(() => import('./pages/TodayPage').then((module) => ({ default: module.TodayPage })))
const TasksPage = lazy(() => import('./pages/TasksPage').then((module) => ({ default: module.TasksPage })))
const GoalsPage = lazy(() => import('./pages/GoalsPage').then((module) => ({ default: module.GoalsPage })))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage })))
const ReviewPage = lazy(() => import('./pages/ReviewPage').then((module) => ({ default: module.ReviewPage })))
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
        <Route path="/" element={<Suspense fallback={<div className="page-state">Carregando seu dia…</div>}><TodayPage /></Suspense>} />
        <Route path="/tarefas" element={<Suspense fallback={<div className="page-state">Carregando tarefas…</div>}><TasksPage /></Suspense>} />
        <Route path="/objetivos" element={<Suspense fallback={<div className="page-state">Carregando objetivos…</div>}><GoalsPage /></Suspense>} />
        <Route path="/projetos" element={<Suspense fallback={<div className="page-state">Carregando projetos…</div>}><ProjectsPage /></Suspense>} />
        <Route path="/revisao" element={<Suspense fallback={<div className="page-state">Carregando revisão…</div>}><ReviewPage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
