import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Check, Clock3, Flame, Heart, Plus, Repeat2, Square, Timer, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MoodCompanion } from '../components/MoodCompanion'
import { companionNames } from '../components/companionConfig'
import {
  createTask,
  getDailyReview,
  getActiveFocusSession,
  getDefaultWorkspace,
  getProfilePreferences,
  listTodayTasks,
  setTaskCompleted,
  startFocusSession,
  stopFocusSession,
} from '../services/planning'
import type { Priority } from '../types/domain'
import { useAuth } from '../context/useAuth'

const priorityLabel: Record<Priority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining = seconds % 60
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, '0')).join(':')
}

export function TodayPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [minutes, setMinutes] = useState(30)
  const [now, setNow] = useState(Date.now())
  const [companionMessage, setCompanionMessage] = useState(0)

  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const tasksQuery = useQuery({
    queryKey: ['today-tasks', workspaceId],
    queryFn: () => listTodayTasks(workspaceId!),
    enabled: Boolean(workspaceId),
  })
  const focusQuery = useQuery({
    queryKey: ['active-focus', workspaceId],
    queryFn: () => getActiveFocusSession(workspaceId!, user!.id),
    enabled: Boolean(workspaceId && user),
  })
  const profileQuery = useQuery({
    queryKey: ['profile-preferences', user?.id],
    queryFn: () => getProfilePreferences(user!.id),
    enabled: Boolean(user),
  })
  const reviewQuery = useQuery({
    queryKey: ['daily-review', workspaceId, user?.id],
    queryFn: () => getDailyReview(workspaceId!, user!.id),
    enabled: Boolean(workspaceId && user),
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['today-tasks', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['active-focus', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['personal-reminders', workspaceId] }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: () => createTask({ workspaceId: workspaceId!, title, priority, estimatedMinutes: minutes }),
    onSuccess: async () => {
      setTitle('')
      setShowForm(false)
      await refresh()
    },
  })
  const completeMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => setTaskCompleted(id, completed),
    onSuccess: refresh,
  })
  const startMutation = useMutation({
    mutationFn: (taskId: string) => startFocusSession(workspaceId!, taskId),
    onSuccess: refresh,
  })
  const stopMutation = useMutation({
    mutationFn: (sessionId: string) => stopFocusSession(sessionId),
    onSuccess: refresh,
  })

  useEffect(() => {
    if (!focusQuery.data) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [focusQuery.data])

  const tasks = tasksQuery.data ?? []
  const completed = tasks.filter((task) => task.status === 'completed').length
  const totalMinutes = tasks.reduce((sum, task) => sum + task.estimated_minutes, 0)
  const activeTask = tasks.find((task) => task.id === focusQuery.data?.task_id)
  const elapsed = focusQuery.data
    ? Math.max(0, Math.floor((now - new Date(focusQuery.data.started_at).getTime()) / 1000))
    : 0
  const longDate = useMemo(() => new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date()), [])
  const companion = profileQuery.data?.companion_type ?? 'fox'
  const mood = reviewQuery.data?.mood_score ?? 3
  const companionMessages = reviewQuery.data ? [
    mood <= 2 ? 'Hoje vamos proteger sua energia e cuidar apenas do essencial.' : mood === 3 ? 'Seu ritmo está estável. Vamos escolher um avanço possível.' : 'Sua energia está boa. Que tal usá-la na prioridade mais importante?',
    mood <= 2 ? 'Pausas também fazem parte de um dia bem planejado.' : mood === 3 ? 'Um passo consciente vale mais que vários no automático.' : 'Guarde um pouco desse ânimo para celebrar no fim do dia.',
  ] : [
    'Como você está hoje? Quero acompanhar seu ritmo de verdade.',
    'Registrar seu humor leva menos de um minuto e ajuda a planejar melhor.',
  ]

  function submitTask(event: FormEvent) {
    event.preventDefault()
    if (title.trim()) createMutation.mutate()
  }

  if (workspaceQuery.isLoading) return <div className="page-state">Preparando seu espaço…</div>
  if (!workspaceId) return <div className="page-state error">Seu workspace ainda não foi criado. Confirme se a migration foi aplicada após o cadastro.</div>

  return (
    <div className="today-page">
      <header className="page-header">
        <div><span className="date-label"><CalendarDays size={16} /> {longDate}</span><h1>O que merece sua atenção hoje?</h1><p>Escolha poucas prioridades e avance com presença.</p></div>
        <button className="primary-button compact" type="button" onClick={() => setShowForm(true)}><Plus size={18} /> Nova tarefa</button>
      </header>

      <section className="stats-grid">
        <article className="stat-card"><span className="stat-icon violet"><Check size={20} /></span><div><strong>{completed}/{tasks.length}</strong><small>tarefas concluídas</small></div></article>
        <article className="stat-card"><span className="stat-icon amber"><Clock3 size={20} /></span><div><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}min</strong><small>tempo planejado</small></div></article>
        <article className="stat-card"><span className="stat-icon coral"><Flame size={20} /></span><div><strong>{tasks.filter((task) => ['high', 'critical'].includes(task.priority)).length}</strong><small>prioridades principais</small></div></article>
      </section>

      <section className={`today-companion-card ${reviewQuery.data ? `mood-${mood}` : 'pending'}`}>
        <div className="today-companion-visual"><MoodCompanion type={companion} mood={mood} size="small" interactive onInteract={() => setCompanionMessage((current) => current + 1)} /></div>
        <div className="today-companion-copy"><span><Heart size={14} /> {reviewQuery.data ? `Humor registrado · energia ${reviewQuery.data.energy_score ?? '—'}/5` : 'Check-in do dia'}</span><h2>{reviewQuery.data ? `${companionNames[companion]} está com você` : `${companionNames[companion]} quer saber como você está`}</h2><p>{companionMessages[companionMessage % companionMessages.length]}</p></div>
        <Link className="secondary-button" to="/revisao">{reviewQuery.data ? 'Ver revisão' : 'Registrar humor'}</Link>
      </section>

      {focusQuery.data && (
        <section className="focus-card">
          <div className="focus-pulse"><Zap size={22} /></div>
          <div className="focus-copy"><span>Foco em andamento</span><strong>{activeTask?.title ?? 'Tarefa em foco'}</strong></div>
          <time>{formatDuration(elapsed)}</time>
          <button type="button" onClick={() => stopMutation.mutate(focusQuery.data!.id)} disabled={stopMutation.isPending}><Square size={17} /> Encerrar</button>
        </section>
      )}

      {showForm && (
        <form className="quick-task" onSubmit={submitTask}>
          <input autoFocus required placeholder="O que precisa ser feito?" value={title} onChange={(event) => setTitle(event.target.value)} />
          <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            {Object.entries(priorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label><input min="5" step="5" type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /> min</label>
          <button className="primary-button compact" disabled={createMutation.isPending} type="submit">Adicionar</button>
          <button className="text-button compact" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
        </form>
      )}

      <section className="task-section">
        <div className="section-heading"><div><span className="eyebrow">Seu plano</span><h2>Tarefas de hoje</h2></div><small>{tasks.length} itens</small></div>

        {tasksQuery.isLoading && <div className="page-state">Carregando tarefas…</div>}
        {tasksQuery.error && <div className="page-state error">Não foi possível carregar as tarefas.</div>}
        {!tasksQuery.isLoading && tasks.length === 0 && (
          <div className="empty-state"><span><Check size={28} /></span><h3>Seu dia está livre.</h3><p>Adicione a primeira tarefa e defina uma intenção clara.</p><button className="secondary-button" type="button" onClick={() => setShowForm(true)}><Plus size={17} /> Criar tarefa</button></div>
        )}

        <div className="task-list">
          {tasks.map((task) => {
            const done = task.status === 'completed'
            const inFocus = focusQuery.data?.task_id === task.id
            return (
              <article className={`task-row ${done ? 'done' : ''}`} key={task.id}>
                <button className="check-button" type="button" onClick={() => completeMutation.mutate({ id: task.id, completed: !done })} aria-label={done ? 'Reabrir tarefa' : 'Concluir tarefa'}>{done && <Check size={16} />}</button>
                <div className="task-copy"><strong>{task.title}</strong><span><em className={`priority ${task.priority}`}>{priorityLabel[task.priority]}</em>{task.recurrence_id && <small className="recurring-task-label"><Repeat2 size={14} /> Recorrente</small>}<small><Clock3 size={14} /> {task.estimated_minutes} min</small></span></div>
                {!done && !focusQuery.data && <button className="focus-button" type="button" onClick={() => startMutation.mutate(task.id)}><Timer size={17} /> Focar</button>}
                {inFocus && <span className="live-badge">Em foco</span>}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
