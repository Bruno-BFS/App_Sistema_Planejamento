import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Check, ChevronRight, Heart, ListTodo, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import {
  getActiveFocusSession,
  getDailyReview,
  getDefaultWorkspace,
  getProfilePreferences,
  listOverdueTasks,
  listTodayTasks,
  updateTask,
} from '../services/planning'
import type { Task } from '../types/domain'
import { companionNames } from './companionConfig'
import { getCompanionGuidance } from './companionGuidance'
import { MoodCompanion } from './MoodCompanion'

function localDateWithOffset(dayOffset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

export function CompanionCoach({ mode = 'floating' }: { mode?: 'floating' | 'inline' }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(mode === 'inline')
  const [showReplanning, setShowReplanning] = useState(false)
  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const profileQuery = useQuery({ queryKey: ['profile-preferences', user?.id], queryFn: () => getProfilePreferences(user!.id), enabled: Boolean(user) })
  const tasksQuery = useQuery({ queryKey: ['today-tasks', workspaceId], queryFn: () => listTodayTasks(workspaceId!), enabled: Boolean(workspaceId) })
  const overdueQuery = useQuery({ queryKey: ['overdue-tasks', workspaceId], queryFn: () => listOverdueTasks(workspaceId!), enabled: Boolean(workspaceId) })
  const focusQuery = useQuery({ queryKey: ['active-focus', workspaceId], queryFn: () => getActiveFocusSession(workspaceId!, user!.id), enabled: Boolean(workspaceId && user) })
  const reviewQuery = useQuery({ queryKey: ['daily-review', workspaceId, user?.id], queryFn: () => getDailyReview(workspaceId!, user!.id), enabled: Boolean(workspaceId && user) })
  const moveMutation = useMutation({
    mutationFn: ({ taskId, plannedDate }: { taskId: string; plannedDate: string }) => updateTask(taskId, { planned_date: plannedDate, status: 'planned' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['overdue-tasks', workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ['today-tasks', workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ['personal-reminders', workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-tasks', workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] }),
      ])
    },
  })

  const tasks = tasksQuery.data ?? []
  const overdueTasks = overdueQuery.data ?? []
  const activeTask = tasks.find((task) => task.id === focusQuery.data?.task_id)
  const guidance = getCompanionGuidance({
    activeTaskTitle: activeTask?.title,
    completedCount: tasks.filter((task) => task.status === 'completed').length,
    hasReview: Boolean(reviewQuery.data),
    hour: new Date().getHours(),
    overdueCount: overdueTasks.length,
    taskCount: tasks.length,
  })
  const companion = profileQuery.data?.companion_type ?? 'fox'
  const companionName = companionNames[companion].split(',')[0]
  const expanded = open || mode === 'inline'

  function moveTask(task: Task, dayOffset: number) {
    moveMutation.mutate({ taskId: task.id, plannedDate: localDateWithOffset(dayOffset) })
  }

  if (mode === 'floating' && !expanded) return (
    <button className="companion-coach-trigger" type="button" onClick={() => setOpen(true)} aria-label={`Abrir orientações de ${companionName}`}>
      <MoodCompanion type={companion} mood={guidance.mood} size="small" />
      {(overdueTasks.length > 0 || focusQuery.data) && <span className="companion-coach-badge">{overdueTasks.length || '•'}</span>}
      <span className="companion-coach-trigger-copy"><strong>{companionName}</strong><small>{focusQuery.data ? 'Foco ativo' : overdueTasks.length ? 'Pode te ajudar' : 'Estou por aqui'}</small></span>
    </button>
  )

  return (
    <section className={`companion-coach ${mode}`} aria-label={`Acompanhamento de ${companionName}`}>
      {mode === 'floating' && <button className="companion-coach-close" type="button" onClick={() => { setOpen(false); setShowReplanning(false) }} aria-label="Minimizar companheiro"><X size={17} /></button>}
      <div className="companion-coach-visual"><MoodCompanion type={companion} mood={guidance.mood} size="small" /></div>
      <div className="companion-coach-copy">
        <span><Heart size={13} /> {companionName} acompanha seu ritmo</span>
        <h2>{guidance.title}</h2>
        <p>{guidance.message}</p>
      </div>
      <div className="companion-coach-actions">
        {guidance.showReplanning ? (
          <button className="primary-button compact" type="button" onClick={() => setShowReplanning((current) => !current)} aria-expanded={showReplanning} aria-controls="companion-replanning"><Sparkles size={16} /> {showReplanning ? 'Ocultar pendências' : guidance.actionLabel}</button>
        ) : <Link className="primary-button compact" to={guidance.actionPath} onClick={() => setOpen(false)}>{guidance.actionLabel}<ChevronRight size={16} /></Link>}
        <Link className="companion-quick-link" to="/agenda" onClick={() => setOpen(false)}><CalendarClock size={15} /> Agenda</Link>
        <Link className="companion-quick-link" to="/tarefas" onClick={() => setOpen(false)}><ListTodo size={15} /> Tarefas</Link>
      </div>
      {showReplanning && guidance.showReplanning && (
        <div className="companion-replanning" id="companion-replanning">
          <div><strong>Replanejar sem perder a tarefa</strong><small>Escolha uma nova data para cada pendência.</small></div>
          {overdueTasks.slice(0, 5).map((task) => (
            <article key={task.id}>
              <span><strong>{task.title}</strong><small>{task.estimated_minutes} min</small></span>
              <div>
                <button type="button" disabled={moveMutation.isPending} onClick={() => moveTask(task, 0)}><Check size={14} /> Hoje</button>
                <button type="button" disabled={moveMutation.isPending} onClick={() => moveTask(task, 1)}>Amanhã</button>
              </div>
            </article>
          ))}
          {overdueTasks.length > 5 && <Link to="/tarefas" onClick={() => setOpen(false)}>Ver todas as {overdueTasks.length} pendências</Link>}
          {moveMutation.error && <p className="form-error">Não foi possível replanejar. Tente novamente.</p>}
        </div>
      )}
    </section>
  )
}
