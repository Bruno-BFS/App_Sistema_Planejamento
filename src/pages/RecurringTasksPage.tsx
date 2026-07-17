import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Clock3, FolderKanban, Pause, Play, Plus, Repeat2, Target, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  createTaskRecurrence, deleteTaskRecurrence, getDefaultWorkspace, listGoals, listProjects, listTaskRecurrences,
  setTaskRecurrenceActive, type TaskRecurrenceInput,
} from '../services/planning'
import type { Priority, RecurrenceFrequency, TaskRecurrence } from '../types/domain'

const priorityLabel: Record<Priority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
}
const frequencyLabel: Record<RecurrenceFrequency, string> = {
  daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal',
}

function localDate() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) return 'Sem término'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`))
}

function cadence(recurrence: TaskRecurrence) {
  const unit = recurrence.frequency === 'daily' ? 'dia' : recurrence.frequency === 'weekly' ? 'semana' : 'mês'
  if (recurrence.interval_count === 1) return frequencyLabel[recurrence.frequency]
  return `A cada ${recurrence.interval_count} ${unit}${recurrence.frequency === 'monthly' ? 'es' : 's'}`
}

export function RecurringTasksPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [minutes, setMinutes] = useState(30)
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly')
  const [intervalCount, setIntervalCount] = useState(1)
  const [startDate, setStartDate] = useState(localDate())
  const [endDate, setEndDate] = useState('')
  const [goalId, setGoalId] = useState('')
  const [projectId, setProjectId] = useState('')

  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const recurrencesQuery = useQuery({
    queryKey: ['task-recurrences', workspaceId],
    queryFn: () => listTaskRecurrences(workspaceId!),
    enabled: Boolean(workspaceId),
  })
  const goalsQuery = useQuery({ queryKey: ['goals', workspaceId], queryFn: () => listGoals(workspaceId!), enabled: Boolean(workspaceId) })
  const projectsQuery = useQuery({ queryKey: ['projects', workspaceId], queryFn: () => listProjects(workspaceId!), enabled: Boolean(workspaceId) })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task-recurrences', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['today-tasks', workspaceId] }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: (input: TaskRecurrenceInput) => createTaskRecurrence(input),
    onSuccess: async () => {
      setTitle(''); setDescription(''); setPriority('medium'); setMinutes(30); setFrequency('weekly')
      setIntervalCount(1); setStartDate(localDate()); setEndDate(''); setGoalId(''); setProjectId(''); setShowForm(false)
      await refresh()
    },
  })
  const activeMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setTaskRecurrenceActive(id, active),
    onSuccess: refresh,
  })
  const deleteMutation = useMutation({ mutationFn: deleteTaskRecurrence, onSuccess: refresh })

  const recurrences = useMemo(() => recurrencesQuery.data ?? [], [recurrencesQuery.data])
  const activeCount = recurrences.filter((item) => item.is_active).length
  const goalMap = useMemo(() => new Map((goalsQuery.data ?? []).map((goal) => [goal.id, goal.title])), [goalsQuery.data])
  const projectMap = useMemo(() => new Map((projectsQuery.data ?? []).map((project) => [project.id, project.title])), [projectsQuery.data])

  function chooseProject(value: string) {
    setProjectId(value)
    const project = (projectsQuery.data ?? []).find((item) => item.id === value)
    if (project?.goal_id) setGoalId(project.goal_id)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    createMutation.mutate({
      workspaceId: workspaceId!, title, description, priority, estimatedMinutes: minutes, frequency,
      intervalCount, startDate, endDate: endDate || null, goalId: goalId || null, projectId: projectId || null,
    })
  }

  function confirmDelete(recurrence: TaskRecurrence) {
    if (window.confirm(`Encerrar e excluir a rotina “${recurrence.title}”? As tarefas já geradas serão mantidas.`)) {
      deleteMutation.mutate(recurrence.id)
    }
  }

  if (workspaceQuery.isLoading) return <div className="page-state">Preparando suas rotinas…</div>
  if (!workspaceId) return <div className="page-state error">Seu workspace ainda não está disponível.</div>

  return <div className="today-page recurrences-page">
    <header className="page-header">
      <div><Link className="back-link" to="/tarefas"><ArrowLeft size={15} /> Voltar para tarefas</Link><span className="eyebrow">Consistência sem esforço</span><h1>Rotinas recorrentes</h1><p>Configure uma vez e receba as tarefas certas nas datas planejadas.</p></div>
      <button className="primary-button compact" type="button" onClick={() => setShowForm(true)}><Plus size={18} /> Nova rotina</button>
    </header>

    <section className="stats-grid compact-stats recurrence-stats">
      <article className="stat-card"><span className="stat-icon violet"><Repeat2 size={20} /></span><div><strong>{activeCount}</strong><small>rotinas ativas</small></div></article>
      <article className="stat-card"><span className="stat-icon amber"><Pause size={20} /></span><div><strong>{recurrences.length - activeCount}</strong><small>rotinas pausadas</small></div></article>
      <article className="stat-card"><span className="stat-icon coral"><CalendarDays size={20} /></span><div><strong>{recurrences.length}</strong><small>rotinas configuradas</small></div></article>
    </section>

    {showForm && <form className="task-form-card recurrence-form" onSubmit={submit}>
      <div className="form-card-heading"><div><span className="eyebrow">Nova rotina</span><h2>O que deve se repetir?</h2></div><button className="icon-button light" type="button" onClick={() => setShowForm(false)} aria-label="Fechar formulário"><X size={20} /></button></div>
      <label className="wide-field">Título<input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Revisar finanças da semana" /></label>
      <label className="wide-field">Descrição<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contexto ou critério de conclusão (opcional)" /></label>
      <div className="form-grid recurrence-main-grid">
        <label>Frequência<select value={frequency} onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)}><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></label>
        <label>Repetir a cada<input min="1" max="12" type="number" value={intervalCount} onChange={(event) => setIntervalCount(Number(event.target.value))} /><small>{frequency === 'daily' ? 'dia(s)' : frequency === 'weekly' ? 'semana(s)' : 'mês(es)'}</small></label>
        <label>Data inicial<input required type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (endDate && endDate < event.target.value) setEndDate('') }} /></label>
        <label>Data final (opcional)<input min={startDate} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <label>Prioridade<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{Object.entries(priorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Estimativa (min)<input min="5" step="5" type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label>
        <label>Objetivo<select value={goalId} onChange={(event) => setGoalId(event.target.value)}><option value="">Sem objetivo</option>{(goalsQuery.data ?? []).filter((goal) => goal.status !== 'completed').map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
        <label>Projeto<select value={projectId} onChange={(event) => chooseProject(event.target.value)}><option value="">Sem projeto</option>{(projectsQuery.data ?? []).filter((project) => project.status !== 'completed').map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      </div>
      <p className="recurrence-hint"><Repeat2 size={15} /> A data inicial também define o dia da semana ou do mês. Meses mais curtos usam o último dia disponível.</p>
      {createMutation.error && <p className="form-error">Não foi possível criar a rotina. Confira as datas e tente novamente.</p>}
      <div className="form-actions"><button className="text-button" type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button compact" disabled={createMutation.isPending} type="submit">{createMutation.isPending ? 'Criando…' : 'Criar rotina'}</button></div>
    </form>}

    <section className="recurrence-board">
      <div className="recurrence-board-heading"><div><span className="eyebrow">Automação pessoal</span><h2>Suas rotinas</h2></div><p>Pause sem perder a configuração ou exclua quando a rotina não fizer mais sentido.</p></div>
      {recurrencesQuery.isLoading && <div className="page-state">Carregando rotinas…</div>}
      {recurrencesQuery.error && <div className="page-state error">Não foi possível carregar as rotinas.</div>}
      {!recurrencesQuery.isLoading && recurrences.length === 0 && <div className="empty-state"><span><Repeat2 size={28} /></span><h3>Nenhuma rotina configurada.</h3><p>Comece por algo simples que acontece toda semana.</p><button className="secondary-button" type="button" onClick={() => setShowForm(true)}>Criar primeira rotina</button></div>}
      <div className="recurrence-grid">{recurrences.map((recurrence) => <article className={`recurrence-card ${recurrence.is_active ? '' : 'paused'}`} key={recurrence.id}>
        <div className="recurrence-card-top"><span className={`recurrence-status ${recurrence.is_active ? 'active' : 'paused'}`}>{recurrence.is_active ? 'Ativa' : 'Pausada'}</span><div><button className="icon-button light" type="button" disabled={activeMutation.isPending} onClick={() => activeMutation.mutate({ id: recurrence.id, active: !recurrence.is_active })} aria-label={recurrence.is_active ? `Pausar ${recurrence.title}` : `Retomar ${recurrence.title}`}>{recurrence.is_active ? <Pause size={17} /> : <Play size={17} />}</button><button className="icon-button danger" type="button" disabled={deleteMutation.isPending} onClick={() => confirmDelete(recurrence)} aria-label={`Excluir rotina ${recurrence.title}`}><Trash2 size={17} /></button></div></div>
        <div className="recurrence-copy"><small>{cadence(recurrence)}</small><h3>{recurrence.title}</h3>{recurrence.description && <p>{recurrence.description}</p>}</div>
        <div className="recurrence-meta"><span><CalendarDays size={15} /> Próxima: <strong>{formatDate(recurrence.next_occurrence)}</strong></span><span><Clock3 size={15} /> {recurrence.estimated_minutes} min</span>{recurrence.project_id && projectMap.get(recurrence.project_id) && <span><FolderKanban size={15} /> {projectMap.get(recurrence.project_id)}</span>}{recurrence.goal_id && goalMap.get(recurrence.goal_id) && <span><Target size={15} /> {goalMap.get(recurrence.goal_id)}</span>}</div>
        <div className="recurrence-footer"><span className={`priority ${recurrence.priority}`}>{priorityLabel[recurrence.priority]}</span><small>{recurrence.end_date ? `Termina em ${formatDate(recurrence.end_date)}` : 'Sem data final'}</small></div>
      </article>)}</div>
    </section>
  </div>
}
