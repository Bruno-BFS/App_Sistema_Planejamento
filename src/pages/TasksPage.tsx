import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Check, Clock3, FolderKanban, Inbox, Pencil, Plus, Repeat2, Search, Target, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { createTask, createTaskRecurrence, deleteTask, getDefaultWorkspace, listGoals, listProjects, listTasks, setTaskCompleted, updateTask } from '../services/planning'
import { formatMinutes } from '../lib/schedule'
import type { Priority, RecurrenceFrequency, Task } from '../types/domain'

type StatusFilter = 'all' | 'open' | 'completed'
const EMPTY_TASKS: Task[] = []
const weekdayOptions = [
  { value: 1, label: 'S' }, { value: 2, label: 'T' }, { value: 3, label: 'Q' },
  { value: 4, label: 'Q' }, { value: 5, label: 'S' }, { value: 6, label: 'S' }, { value: 0, label: 'D' },
]

const priorityLabel: Record<Priority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
}

function localDate() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(`${value}T12:00:00`))
}

export function TasksPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [minutes, setMinutes] = useState(30)
  const [plannedDate, setPlannedDate] = useState(localDate())
  const [plannedStartTime, setPlannedStartTime] = useState('')
  const [repeat, setRepeat] = useState<'none' | RecurrenceFrequency>('none')
  const [intervalCount, setIntervalCount] = useState(1)
  const [repeatEndDate, setRepeatEndDate] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([new Date().getDay()])
  const [goalId, setGoalId] = useState('')
  const [projectId, setProjectId] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const tasksQuery = useQuery({
    queryKey: ['tasks', workspaceId],
    queryFn: () => listTasks(workspaceId!),
    enabled: Boolean(workspaceId),
  })
  const goalsQuery = useQuery({
    queryKey: ['goals', workspaceId],
    queryFn: () => listGoals(workspaceId!),
    enabled: Boolean(workspaceId),
  })
  const projectsQuery = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: () => listProjects(workspaceId!),
    enabled: Boolean(workspaceId),
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['today-tasks', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['personal-reminders', workspaceId] }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingTask) {
        await updateTask(editingTask.id, {
          title: title.trim(), description: description.trim() || null, priority,
          estimated_minutes: minutes, planned_date: plannedDate || null,
          planned_start_time: plannedDate && plannedStartTime ? plannedStartTime : null,
          goal_id: goalId || null, project_id: projectId || null,
        })
        return
      }
      if (repeat !== 'none') {
        await createTaskRecurrence({
          workspaceId: workspaceId!, title, description, priority, estimatedMinutes: minutes,
          frequency: repeat, intervalCount, startDate: plannedDate, endDate: repeatEndDate || null,
          plannedStartTime: plannedStartTime || null, weekdays: repeat === 'weekly' ? weekdays : [],
          goalId: goalId || null, projectId: projectId || null,
        })
      } else {
        await createTask({
          workspaceId: workspaceId!, title, description, priority,
          estimatedMinutes: minutes, plannedDate: plannedDate || null, plannedStartTime: plannedStartTime || null,
          goalId: goalId || null, projectId: projectId || null,
        })
      }
    },
    onSuccess: async () => {
      closeForm()
      await refresh()
    },
  })
  const completeMutation = useMutation({
    mutationFn: ({ task, completed }: { task: Task; completed: boolean }) => setTaskCompleted(task.id, completed),
    onSuccess: refresh,
  })
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: refresh,
  })

  const tasks = tasksQuery.data ?? EMPTY_TASKS
  const filteredTasks = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return tasks.filter((task) => {
      const matchesText = !term || task.title.toLocaleLowerCase('pt-BR').includes(term)
        || task.description?.toLocaleLowerCase('pt-BR').includes(term)
      const matchesStatus = status === 'all'
        || (status === 'completed' ? task.status === 'completed' : task.status !== 'completed')
      return matchesText && matchesStatus
    })
  }, [search, status, tasks])

  const openCount = tasks.filter((task) => task.status !== 'completed').length
  const completedCount = tasks.length - openCount
  const goalMap = useMemo(() => new Map((goalsQuery.data ?? []).map((goal) => [goal.id, goal.title])), [goalsQuery.data])
  const projectMap = useMemo(() => new Map((projectsQuery.data ?? []).map((project) => [project.id, project.title])), [projectsQuery.data])

  useEffect(() => {
    if (!showForm) return
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    titleInputRef.current?.focus({ preventScroll: true })
  }, [showForm, editingTask])

  function resetFields() {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setMinutes(30)
    setPlannedDate(localDate())
    setPlannedStartTime('')
    setRepeat('none')
    setIntervalCount(1)
    setRepeatEndDate('')
    setWeekdays([new Date().getDay()])
    setGoalId('')
    setProjectId('')
  }

  function closeForm() {
    setShowForm(false)
    setEditingTask(null)
    resetFields()
  }

  function openCreateForm() {
    setEditingTask(null)
    resetFields()
    setShowForm(true)
  }

  function openEditForm(task: Task) {
    setEditingTask(task)
    setTitle(task.title)
    setDescription(task.description ?? '')
    setPriority(task.priority)
    setMinutes(task.estimated_minutes)
    setPlannedDate(task.planned_date ?? '')
    setPlannedStartTime(task.planned_start_time?.slice(0, 5) ?? '')
    setGoalId(task.goal_id ?? '')
    setProjectId(task.project_id ?? '')
    setShowForm(true)
  }

  function chooseProject(value: string) {
    setProjectId(value)
    const project = (projectsQuery.data ?? []).find((item) => item.id === value)
    if (project?.goal_id) setGoalId(project.goal_id)
  }

  function submitTask(event: FormEvent) {
    event.preventDefault()
    if (title.trim() && (repeat === 'none' || plannedDate) && (repeat !== 'weekly' || weekdays.length)) saveMutation.mutate()
  }

  function toggleWeekday(day: number) {
    setWeekdays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])
  }

  function confirmDelete(task: Task) {
    if (window.confirm(`Excluir a tarefa “${task.title}”? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate(task.id)
    }
  }

  if (workspaceQuery.isLoading) return <div className="page-state">Preparando seu espaço…</div>
  if (!workspaceId) return <div className="page-state error">Seu workspace ainda não está disponível.</div>

  return (
    <div className="today-page tasks-page">
      <header className="page-header">
        <div><span className="eyebrow">Organização</span><h1>Suas tarefas</h1><p>Capture, priorize e acompanhe tudo que precisa avançar.</p></div>
        <div className="page-header-actions"><Link className="secondary-button compact" to="/rotinas"><Repeat2 size={17} /> Rotinas</Link><button className="primary-button compact" type="button" onClick={openCreateForm}><Plus size={18} /> Nova tarefa</button></div>
      </header>

      <section className="stats-grid compact-stats">
        <article className="stat-card"><span className="stat-icon amber"><Inbox size={20} /></span><div><strong>{openCount}</strong><small>tarefas abertas</small></div></article>
        <article className="stat-card"><span className="stat-icon violet"><Check size={20} /></span><div><strong>{completedCount}</strong><small>concluídas</small></div></article>
        <article className="stat-card"><span className="stat-icon coral"><Clock3 size={20} /></span><div><strong>{tasks.reduce((sum, task) => sum + task.estimated_minutes, 0)} min</strong><small>tempo planejado</small></div></article>
      </section>

      {showForm && (
        <form className="task-form-card" onSubmit={submitTask} ref={formRef}>
          <div className="form-card-heading"><div><span className="eyebrow">{editingTask ? 'Editar tarefa' : 'Nova tarefa'}</span><h2>{editingTask ? 'Atualize os detalhes da tarefa' : 'O que precisa avançar?'}</h2></div><button className="icon-button light" type="button" onClick={closeForm} aria-label="Fechar formulário"><X size={20} /></button></div>
          {editingTask?.recurrence_id && <p className="task-form-note"><Repeat2 size={16} /> Esta edição altera somente esta ocorrência. Para mudar as próximas, edite a rotina.</p>}
          <label className="wide-field">Título<input autoFocus ref={titleInputRef} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Preparar apresentação" /></label>
          <label className="wide-field">Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contexto ou próximo passo (opcional)" rows={3} /></label>
          <div className="form-grid">
            <label>Prioridade<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{Object.entries(priorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Data planejada<input required={repeat !== 'none'} type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} /></label>
            <label>Horário de início<input disabled={!plannedDate} type="time" value={plannedStartTime} onChange={(event) => setPlannedStartTime(event.target.value)} /></label>
            <label>Estimativa (min)<input min="5" step="5" type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label>
            <label>Objetivo<select value={goalId} onChange={(event) => setGoalId(event.target.value)}><option value="">Sem objetivo</option>{(goalsQuery.data ?? []).filter((goal) => goal.status !== 'completed' || goal.id === goalId).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
            <label>Projeto<select value={projectId} onChange={(event) => chooseProject(event.target.value)}><option value="">Sem projeto</option>{(projectsQuery.data ?? []).filter((project) => project.status !== 'completed' || project.id === projectId).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
          </div>
          {!editingTask && <fieldset className="recurrence-fieldset">
            <legend>Repetição</legend>
            <div className="recurrence-choice-grid">
              {([['none', 'Não repetir'], ['daily', 'Diária'], ['weekly', 'Semanal'], ['monthly', 'Mensal']] as const).map(([value, label]) => (
                <button className={repeat === value ? 'active' : ''} key={value} type="button" onClick={() => setRepeat(value)}>{label}</button>
              ))}
            </div>
            {repeat !== 'none' && <div className="recurrence-options">
              <label>Repetir a cada<input min="1" max="12" type="number" value={intervalCount} onChange={(event) => setIntervalCount(Number(event.target.value))} /><small>{repeat === 'daily' ? 'dia(s)' : repeat === 'weekly' ? 'semana(s)' : 'mês(es)'}</small></label>
              <label>Repetir até <input min={plannedDate} type="date" value={repeatEndDate} onChange={(event) => setRepeatEndDate(event.target.value)} /><small>Opcional</small></label>
              {repeat === 'weekly' && <div className="weekday-picker"><span>Dias da semana</span><div>{weekdayOptions.map((day) => <button aria-label={`Dia ${day.value}`} aria-pressed={weekdays.includes(day.value)} className={weekdays.includes(day.value) ? 'active' : ''} key={day.value} type="button" onClick={() => toggleWeekday(day.value)}>{day.label}</button>)}</div>{!weekdays.length && <small>Escolha pelo menos um dia.</small>}</div>}
            </div>}
          </fieldset>}
          {saveMutation.error && <p className="form-error">Não foi possível {editingTask ? 'atualizar' : 'criar'} a tarefa.</p>}
          <div className="form-actions"><button className="text-button" type="button" onClick={closeForm}>Cancelar</button><button className="primary-button compact" disabled={saveMutation.isPending} type="submit">{saveMutation.isPending ? 'Salvando…' : editingTask ? 'Salvar alterações' : 'Adicionar tarefa'}</button></div>
        </form>
      )}

      <section className="task-section">
        <div className="task-toolbar">
          <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefas" aria-label="Buscar tarefas" /></label>
          <div className="filter-group" aria-label="Filtrar tarefas">
            {([['all', 'Todas'], ['open', 'Abertas'], ['completed', 'Concluídas']] as const).map(([value, label]) => (
              <button className={status === value ? 'active' : ''} key={value} type="button" onClick={() => setStatus(value)}>{label}</button>
            ))}
          </div>
        </div>

        {tasksQuery.isLoading && <div className="page-state">Carregando tarefas…</div>}
        {tasksQuery.error && <div className="page-state error">Não foi possível carregar as tarefas.</div>}
        {!tasksQuery.isLoading && filteredTasks.length === 0 && (
          <div className="empty-state"><span><Inbox size={28} /></span><h3>Nenhuma tarefa encontrada.</h3><p>{tasks.length ? 'Tente alterar a busca ou os filtros.' : 'Crie a primeira tarefa para começar.'}</p></div>
        )}

        <div className="task-list">
          {filteredTasks.map((task) => {
            const done = task.status === 'completed'
            return (
              <article className={`task-row detailed ${done ? 'done' : ''}`} key={task.id}>
                <button className="check-button" type="button" onClick={() => completeMutation.mutate({ task, completed: !done })} aria-label={done ? 'Reabrir tarefa' : 'Concluir tarefa'}>{done && <Check size={16} />}</button>
                <div className="task-copy"><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<span><em className={`priority ${task.priority}`}>{priorityLabel[task.priority]}</em>{task.recurrence_id && <small className="recurring-task-label"><Repeat2 size={14} /> Recorrente</small>}<small><CalendarDays size={14} /> {formatDate(task.planned_date)}</small>{task.planned_start_time && <small><Clock3 size={14} /> {task.planned_start_time.slice(0, 5)}–{(() => { const [h, m] = task.planned_start_time!.slice(0, 5).split(':').map(Number); const total = h * 60 + m + task.estimated_minutes; return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` })()}</small>}<small>{formatMinutes(task.estimated_minutes)} planejados</small>{task.project_id && projectMap.get(task.project_id) && <small><FolderKanban size={14} /> {projectMap.get(task.project_id)}</small>}{task.goal_id && goalMap.get(task.goal_id) && <small><Target size={14} /> {goalMap.get(task.goal_id)}</small>}</span></div>
                <div className="task-row-actions">
                  <button className="icon-button light" type="button" onClick={() => openEditForm(task)} aria-label={`Editar ${task.title}`}><Pencil size={18} /></button>
                  <button className="icon-button danger" type="button" onClick={() => confirmDelete(task)} aria-label={`Excluir ${task.title}`} disabled={deleteMutation.isPending}><Trash2 size={18} /></button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
