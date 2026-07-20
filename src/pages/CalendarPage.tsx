import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Inbox, Plus, RotateCcw, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  createTask, getDefaultWorkspace, listCalendarTasks, listUnscheduledTasks, setTaskCompleted, updateTask,
} from '../services/planning'
import type { Priority, Task } from '../types/domain'
import { calculateOccupiedMinutes, DEFAULT_DAY_END_MINUTES, DEFAULT_DAY_START_MINUTES, formatMinutes, hasScheduleConflict, taskTimeRange } from '../lib/schedule'

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const priorityLabel: Record<Priority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00`)
}

function buildMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  first.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first)
    day.setDate(first.getDate() + index)
    return day
  })
}

function formatSelectedDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(dateFromKey(value))
}

export function CalendarPage() {
  const queryClient = useQueryClient()
  const dayPanelRef = useRef<HTMLElement>(null)
  const today = dateKey(new Date())
  const [viewMonth, setViewMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [showCompleted, setShowCompleted] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [minutes, setMinutes] = useState(30)
  const [plannedStartTime, setPlannedStartTime] = useState('')

  const days = useMemo(() => buildMonthDays(viewMonth), [viewMonth])
  const startDate = dateKey(days[0])
  const endDate = dateKey(days[days.length - 1])
  const monthKey = dateKey(viewMonth).slice(0, 7)

  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const tasksQuery = useQuery({
    queryKey: ['calendar-tasks', workspaceId, startDate, endDate],
    queryFn: () => listCalendarTasks(workspaceId!, startDate, endDate),
    enabled: Boolean(workspaceId),
  })
  const unscheduledQuery = useQuery({
    queryKey: ['unscheduled-tasks', workspaceId],
    queryFn: () => listUnscheduledTasks(workspaceId!),
    enabled: Boolean(workspaceId),
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['unscheduled-tasks', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['today-tasks', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['personal-reminders', workspaceId] }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: () => createTask({
      workspaceId: workspaceId!, title, priority, estimatedMinutes: minutes, plannedDate: selectedDate,
      plannedStartTime: plannedStartTime || null,
    }),
    onSuccess: async () => {
      setTitle('')
      setPriority('medium')
      setMinutes(30)
      setPlannedStartTime('')
      setShowForm(false)
      await refresh()
    },
  })
  const completeMutation = useMutation({
    mutationFn: ({ task, completed }: { task: Task; completed: boolean }) => setTaskCompleted(task.id, completed),
    onSuccess: refresh,
  })
  const scheduleMutation = useMutation({
    mutationFn: (task: Task) => updateTask(task.id, { planned_date: selectedDate, status: 'planned' }),
    onSuccess: refresh,
  })

  const tasks = tasksQuery.data ?? []
  const visibleTasks = showCompleted ? tasks : tasks.filter((task) => task.status !== 'completed')
  const tasksByDay = useMemo(() => {
    const grouped = new Map<string, Task[]>()
    visibleTasks.forEach((task) => {
      if (!task.planned_date) return
      const current = grouped.get(task.planned_date) ?? []
      current.push(task)
      grouped.set(task.planned_date, current)
    })
    return grouped
  }, [visibleTasks])
  const selectedTasks = (tasksByDay.get(selectedDate) ?? []).slice().sort((a, b) => {
    if (a.planned_start_time !== b.planned_start_time) return (a.planned_start_time ?? '99:99').localeCompare(b.planned_start_time ?? '99:99')
    if ((a.status === 'completed') !== (b.status === 'completed')) return a.status === 'completed' ? 1 : -1
    return b.priority.localeCompare(a.priority)
  })
  const monthTasks = tasks.filter((task) => task.planned_date?.startsWith(monthKey))
  const completedMonth = monthTasks.filter((task) => task.status === 'completed').length
  const openMinutes = monthTasks
    .filter((task) => task.status !== 'completed')
    .reduce((total, task) => total + task.estimated_minutes, 0)
  const overdue = tasks.filter((task) => task.planned_date && task.planned_date < today && task.status !== 'completed').length
  const scheduledTasks = selectedTasks.filter((task) => task.planned_start_time)
  const flexibleTasks = selectedTasks.filter((task) => !task.planned_start_time)
  const occupiedMinutes = calculateOccupiedMinutes(scheduledTasks)
  const availableMinutes = DEFAULT_DAY_END_MINUTES - DEFAULT_DAY_START_MINUTES
  const freeMinutes = Math.max(0, availableMinutes - occupiedMinutes)
  const occupancyPercent = Math.min(100, Math.round((occupiedMinutes / availableMinutes) * 100))
  const hasConflicts = scheduledTasks.some((task) => hasScheduleConflict(task, scheduledTasks))
  const timelineHours = Array.from({ length: 16 }, (_, index) => index + 7)

  function changeMonth(offset: number) {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1)
    setViewMonth(next)
    setSelectedDate(dateKey(next))
    setShowForm(false)
  }

  function returnToday() {
    const now = new Date()
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(today)
  }

  function submitTask(event: FormEvent) {
    event.preventDefault()
    if (title.trim()) createMutation.mutate()
  }

  function openQuickForm() {
    setShowForm(true)
    window.requestAnimationFrame(() => dayPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  if (workspaceQuery.isLoading) return <div className="page-state">Preparando sua agenda…</div>
  if (!workspaceId) return <div className="page-state error">Seu workspace ainda não está disponível.</div>

  return (
    <div className="today-page calendar-page">
      <header className="page-header calendar-header">
        <div><span className="eyebrow">Visão do tempo</span><h1>Agenda</h1><p>Distribua suas prioridades sem sobrecarregar os seus dias.</p></div>
        <div className="page-header-actions"><Link className="secondary-button compact" to="/tarefas"><Inbox size={17} /> Todas as tarefas</Link><button className="primary-button compact" type="button" onClick={openQuickForm}><Plus size={18} /> Nova tarefa</button></div>
      </header>

      <section className="calendar-stats" aria-label="Resumo do mês">
        <article><span className="stat-icon violet"><CalendarDays size={19} /></span><div><strong>{monthTasks.length}</strong><small>tarefas no mês</small></div></article>
        <article><span className="stat-icon amber"><Check size={19} /></span><div><strong>{completedMonth}</strong><small>concluídas</small></div></article>
        <article><span className="stat-icon coral"><Clock3 size={19} /></span><div><strong>{Math.floor(openMinutes / 60)}h {openMinutes % 60}min</strong><small>carga em aberto</small></div></article>
        <article className={overdue ? 'attention' : ''}><span className="stat-icon"><RotateCcw size={19} /></span><div><strong>{overdue}</strong><small>tarefas vencidas</small></div></article>
      </section>

      <section className="calendar-shell">
        <div className="calendar-board">
          <div className="calendar-toolbar">
            <div className="calendar-month-controls">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={19} /></button>
              <h2>{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(viewMonth)}</h2>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={19} /></button>
            </div>
            <div className="calendar-toolbar-actions">
              <button className="text-button" type="button" onClick={returnToday}>Hoje</button>
              <label className="calendar-completed-toggle"><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /> Concluídas</label>
            </div>
          </div>

          {tasksQuery.isLoading && <div className="page-state calendar-loading">Montando seu mês…</div>}
          {tasksQuery.error && <div className="page-state error calendar-loading">Não foi possível carregar a agenda.</div>}
          {!tasksQuery.isLoading && !tasksQuery.error && (
            <div className="month-grid">
              {weekdays.map((weekday) => <div className="weekday" key={weekday}>{weekday}</div>)}
              {days.map((day) => {
                const key = dateKey(day)
                const dayTasks = tasksByDay.get(key) ?? []
                const outside = day.getMonth() !== viewMonth.getMonth()
                return (
                  <div className={`calendar-day ${outside ? 'outside' : ''} ${key === today ? 'today' : ''} ${key === selectedDate ? 'selected' : ''}`} key={key}>
                    <button className="calendar-day-number" type="button" onClick={() => setSelectedDate(key)} aria-label={`${formatSelectedDate(key)}, ${dayTasks.length} tarefas`}><span>{day.getDate()}</span><small>{dayTasks.length || ''}</small></button>
                    <div className="calendar-day-tasks">
                      {dayTasks.slice(0, 3).map((task) => <button className={`calendar-task-chip ${task.priority} ${task.status === 'completed' ? 'done' : ''}`} key={task.id} type="button" onClick={() => setSelectedDate(key)} title={task.title}><span />{task.title}</button>)}
                      {dayTasks.length > 3 && <button className="calendar-more" type="button" onClick={() => setSelectedDate(key)}>+{dayTasks.length - 3} tarefas</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <aside className="calendar-day-panel" ref={dayPanelRef}>
          <div className="selected-day-heading"><div><span className="eyebrow">Dia selecionado</span><h2>{formatSelectedDate(selectedDate)}</h2></div><button className="icon-button light" type="button" onClick={() => setShowForm((current) => !current)} aria-label={showForm ? 'Fechar nova tarefa' : 'Adicionar tarefa neste dia'}>{showForm ? <X size={19} /> : <Plus size={19} />}</button></div>

          {showForm && (
            <form className="calendar-quick-form" onSubmit={submitTask}>
              <label>Tarefa<input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="O que precisa avançar?" /></label>
              <div><label>Prioridade<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{Object.entries(priorityLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Horário<input type="time" value={plannedStartTime} onChange={(event) => setPlannedStartTime(event.target.value)} /></label><label>Minutos<input type="number" min="5" step="5" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label></div>
              {createMutation.error && <p className="form-error">Não foi possível criar a tarefa.</p>}
              <button className="primary-button compact" disabled={createMutation.isPending} type="submit">{createMutation.isPending ? 'Salvando…' : 'Adicionar ao dia'}</button>
            </form>
          )}

          <div className="selected-day-list">
            {!selectedTasks.length && <div className="calendar-empty"><Check size={23} /><strong>Dia disponível</strong><span>Adicione uma tarefa ou traga um item da fila.</span></div>}
            {selectedTasks.map((task) => {
              const done = task.status === 'completed'
              return <article className={done ? 'done' : ''} key={task.id}><button className="check-button" type="button" onClick={() => completeMutation.mutate({ task, completed: !done })} aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}>{done && <Check size={14} />}</button><div><strong>{task.title}</strong><span><em className={`priority ${task.priority}`}>{priorityLabel[task.priority]}</em>{task.planned_start_time && <small><Clock3 size={12} /> {task.planned_start_time.slice(0, 5)}</small>}<small>{task.estimated_minutes} min</small></span></div></article>
            })}
          </div>

          <div className="unscheduled-section">
            <div><span className="eyebrow">Fila sem data</span><small>{unscheduledQuery.data?.length ?? 0}</small></div>
            {unscheduledQuery.isLoading && <p>Carregando fila…</p>}
            {!unscheduledQuery.isLoading && !(unscheduledQuery.data?.length) && <p>Nenhuma tarefa aguardando planejamento.</p>}
            {(unscheduledQuery.data ?? []).slice(0, 5).map((task) => <article key={task.id}><div><strong>{task.title}</strong><small>{priorityLabel[task.priority]} · {task.estimated_minutes} min</small></div><button type="button" onClick={() => scheduleMutation.mutate(task)} disabled={scheduleMutation.isPending} aria-label={`Planejar ${task.title} para ${formatSelectedDate(selectedDate)}`}><Plus size={15} /> Planejar</button></article>)}
          </div>
        </aside>
      </section>

      <section className="day-planner" aria-label={`Planejamento de ${formatSelectedDate(selectedDate)}`}>
        <div className="day-planner-heading">
          <div><span className="eyebrow">Cronograma do dia</span><h2>{formatSelectedDate(selectedDate)}</h2><p>Janela ativa considerada: 07:00–22:00.</p></div>
          <div className="day-capacity-numbers"><span><strong>{formatMinutes(occupiedMinutes)}</strong><small>ocupado</small></span><span><strong>{formatMinutes(freeMinutes)}</strong><small>livre</small></span><span><strong>{occupancyPercent}%</strong><small>da capacidade</small></span></div>
        </div>
        <div className="capacity-track" aria-label={`${occupancyPercent}% do dia ocupado`}><span style={{ width: `${occupancyPercent}%` }} /></div>
        {hasConflicts && <div className="schedule-warning"><AlertTriangle size={17} /><span>Há tarefas sobrepostas. Ajuste os horários para evitar conflito.</span></div>}
        <div className="day-planner-grid">
          <div className="day-timeline" style={{ height: `${(timelineHours.length - 1) * 58}px` }}>
            {timelineHours.map((hour) => <div className="timeline-hour" key={hour} style={{ top: `${(hour - 7) * 58}px` }}><time>{String(hour).padStart(2, '0')}:00</time><span /></div>)}
            {scheduledTasks.map((task, index) => {
              const range = taskTimeRange(task)!
              const clippedStart = Math.max(DEFAULT_DAY_START_MINUTES, range.start)
              const clippedEnd = Math.min(DEFAULT_DAY_END_MINUTES, range.end)
              if (clippedEnd <= clippedStart) return null
              const conflict = hasScheduleConflict(task, scheduledTasks)
              return <article className={`timeline-task ${task.priority} ${task.status === 'completed' ? 'done' : ''} ${conflict ? 'conflict' : ''}`} key={task.id} style={{ top: `${((clippedStart - DEFAULT_DAY_START_MINUTES) / 60) * 58}px`, height: `${Math.max(34, ((clippedEnd - clippedStart) / 60) * 58)}px`, left: conflict ? `${56 + (index % 2) * 8}px` : '56px' }}><strong>{task.title}</strong><small>{task.planned_start_time!.slice(0, 5)} · {formatMinutes(task.estimated_minutes)}</small></article>
            })}
            {!scheduledTasks.length && <div className="timeline-empty"><Clock3 size={22} /><strong>Nenhum horário reservado</strong><span>Defina o início das tarefas para visualizar a ocupação do dia.</span></div>}
          </div>
          <aside className="day-breakdown">
            <div><span className="eyebrow">Segmentação</span><strong>{selectedTasks.length} tarefas</strong></div>
            <div className="task-segment-list">{scheduledTasks.map((task) => <article key={task.id}><span className={`segment-dot ${task.priority}`} /><div><strong>{task.title}</strong><small>{task.planned_start_time!.slice(0, 5)} · {formatMinutes(task.estimated_minutes)}</small></div></article>)}</div>
            {flexibleTasks.length > 0 && <div className="flexible-task-note"><Inbox size={17} /><span><strong>{flexibleTasks.length} sem horário</strong><small>Estão no dia, mas ainda não ocupam um bloco.</small></span></div>}
          </aside>
        </div>
      </section>
    </div>
  )
}
