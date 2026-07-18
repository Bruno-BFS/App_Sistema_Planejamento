import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { useAuth } from './context/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'

const TodayPage = lazy(() => import('./pages/TodayPage').then((module) => ({ default: module.TodayPage })))
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })))
const TasksPage = lazy(() => import('./pages/TasksPage').then((module) => ({ default: module.TasksPage })))
const RecurringTasksPage = lazy(() => import('./pages/RecurringTasksPage').then((module) => ({ default: module.RecurringTasksPage })))
const GoalsPage = lazy(() => import('./pages/GoalsPage').then((module) => ({ default: module.GoalsPage })))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage })))
const ReviewPage = lazy(() => import('./pages/ReviewPage').then((module) => ({ default: module.ReviewPage })))
const WeeklyReviewPage = lazy(() => import('./pages/WeeklyReviewPage').then((module) => ({ default: module.WeeklyReviewPage })))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })))
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage').then((module) => ({ default: module.NotificationSettingsPage })))
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage').then((module) => ({ default: module.IntegrationsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
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
        <Route path="/agenda" element={<Suspense fallback={<div className="page-state">Montando sua agenda…</div>}><CalendarPage /></Suspense>} />
        <Route path="/tarefas" element={<Suspense fallback={<div className="page-state">Carregando tarefas…</div>}><TasksPage /></Suspense>} />
        <Route path="/rotinas" element={<Suspense fallback={<div className="page-state">Carregando rotinas…</div>}><RecurringTasksPage /></Suspense>} />
        <Route path="/objetivos" element={<Suspense fallback={<div className="page-state">Carregando objetivos…</div>}><GoalsPage /></Suspense>} />
        <Route path="/projetos" element={<Suspense fallback={<div className="page-state">Carregando projetos…</div>}><ProjectsPage /></Suspense>} />
        <Route path="/revisao" element={<Suspense fallback={<div className="page-state">Carregando revisão…</div>}><ReviewPage /></Suspense>} />
        <Route path="/revisao-semanal" element={<Suspense fallback={<div className="page-state">Preparando revisão semanal…</div>}><WeeklyReviewPage /></Suspense>} />
        <Route path="/analises" element={<Suspense fallback={<div className="page-state">Calculando análises…</div>}><AnalyticsPage /></Suspense>} />
        <Route path="/notificacoes" element={<Suspense fallback={<div className="page-state">Carregando notificações…</div>}><NotificationSettingsPage /></Suspense>} />
        <Route path="/integracoes" element={<Suspense fallback={<div className="page-state">Preparando integrações…</div>}><IntegrationsPage /></Suspense>} />
        <Route path="/configuracoes" element={<Suspense fallback={<div className="page-state">Carregando configurações…</div>}><SettingsPage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
