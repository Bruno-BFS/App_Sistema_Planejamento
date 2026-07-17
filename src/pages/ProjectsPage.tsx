import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, FolderKanban, ListChecks, Pencil, Plus, Target, Trash2, X } from 'lucide-react'
import {
  createProject, deleteProject, getDefaultWorkspace, listGoals, listProjectMetrics, listProjects, updateProject,
  type ProjectInput,
} from '../services/planning'
import type { Priority, Project, ProjectStatus } from '../types/domain'

type ProjectFilter = 'open' | 'completed' | 'all'

interface ProjectFormState {
  title: string
  description: string
  area: string
  goalId: string
  status: ProjectStatus
  priority: Priority
  startDate: string
  targetDate: string
  expectedResult: string
  nextAction: string
  notes: string
}

const emptyForm: ProjectFormState = {
  title: '', description: '', area: '', goalId: '', status: 'active', priority: 'medium',
  startDate: '', targetDate: '', expectedResult: '', nextAction: '', notes: '',
}

const statusLabel: Record<ProjectStatus, string> = {
  idea: 'Ideia', planned: 'Planejado', active: 'Em andamento', blocked: 'Bloqueado',
  paused: 'Pausado', completed: 'Concluído', cancelled: 'Cancelado',
}
const priorityLabel: Record<Priority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' }

function formatDate(value: string | null) {
  if (!value) return 'Sem prazo'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function formatMinutes(value: number) {
  if (value < 60) return `${value} min`
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`
}

function isStagnant(value: string) {
  return Date.now() - new Date(value).getTime() > 7 * 86_400_000
}

function toForm(project: Project): ProjectFormState {
  return {
    title: project.title, description: project.description ?? '', area: project.area ?? '', goalId: project.goal_id ?? '',
    status: project.status, priority: project.priority, startDate: project.start_date ?? '', targetDate: project.target_date ?? '',
    expectedResult: project.expected_result ?? '', nextAction: project.next_action ?? '', notes: project.notes ?? '',
  }
}

export function ProjectsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [filter, setFilter] = useState<ProjectFilter>('open')
  const [form, setForm] = useState<ProjectFormState>(emptyForm)
  const [validationError, setValidationError] = useState('')

  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const projectsQuery = useQuery({ queryKey: ['projects', workspaceId], queryFn: () => listProjects(workspaceId!), enabled: Boolean(workspaceId) })
  const metricsQuery = useQuery({ queryKey: ['project-metrics', workspaceId], queryFn: () => listProjectMetrics(workspaceId!), enabled: Boolean(workspaceId) })
  const goalsQuery = useQuery({ queryKey: ['goals', workspaceId], queryFn: () => listGoals(workspaceId!), enabled: Boolean(workspaceId) })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['project-metrics', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['goal-metrics', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] }),
    ])
  }
  const saveMutation = useMutation({
    mutationFn: (input: ProjectInput) => editingProject ? updateProject(editingProject.id, input) : createProject(input),
    onSuccess: async () => { closeForm(); await refresh() },
  })
  const deleteMutation = useMutation({ mutationFn: deleteProject, onSuccess: refresh })

  const projects = projectsQuery.data ?? []
  const metricMap = useMemo(() => new Map((metricsQuery.data ?? []).map((metric) => [metric.project_id, metric])), [metricsQuery.data])
  const goalMap = useMemo(() => new Map((goalsQuery.data ?? []).map((goal) => [goal.id, goal.title])), [goalsQuery.data])
  const visibleProjects = projects.filter((project) => filter === 'all'
    || (filter === 'completed' ? project.status === 'completed' : project.status !== 'completed'))
  const activeProjects = projects.filter((project) => ['planned', 'active', 'blocked'].includes(project.status))
  const riskyProjects = activeProjects.filter((project) => {
    const metric = metricMap.get(project.id)
    return project.status === 'blocked' || !project.next_action || isStagnant(project.last_activity_at)
      || (metric && metric.planned_minutes > 0 && metric.actual_minutes > metric.planned_minutes * 1.25)
  })
  const averageProgress = activeProjects.length
    ? Math.round(activeProjects.reduce((sum, project) => sum + (metricMap.get(project.id)?.progress ?? 0), 0) / activeProjects.length)
    : 0

  function updateField<K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }
  function closeForm() {
    setShowForm(false); setEditingProject(null); setForm(emptyForm); setValidationError('')
  }
  function openCreateForm() {
    setEditingProject(null); setForm(emptyForm); setValidationError(''); setShowForm(true)
  }
  function openEditForm(project: Project) {
    setEditingProject(project); setForm(toForm(project)); setValidationError(''); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function submitProject(event: FormEvent) {
    event.preventDefault()
    if (form.startDate && form.targetDate && form.targetDate < form.startDate) {
      setValidationError('A data final não pode ser anterior à data inicial.')
      return
    }
    setValidationError('')
    saveMutation.mutate({
      workspaceId: workspaceId!, goalId: form.goalId || null, title: form.title, description: form.description,
      area: form.area, status: form.status, priority: form.priority, startDate: form.startDate || null,
      targetDate: form.targetDate || null, expectedResult: form.expectedResult, nextAction: form.nextAction, notes: form.notes,
    })
  }
  function confirmDelete(project: Project) {
    if (window.confirm(`Excluir o projeto “${project.title}”? As tarefas serão preservadas, mas perderão este vínculo.`)) deleteMutation.mutate(project.id)
  }

  if (workspaceQuery.isLoading) return <div className="page-state">Preparando seu espaço…</div>
  if (!workspaceId) return <div className="page-state error">Seu workspace ainda não está disponível.</div>

  return <div className="today-page projects-page">
    <header className="page-header">
      <div><span className="eyebrow">Execução</span><h1>Seus projetos</h1><p>Transforme objetivos em entregas com progresso, prazo e próxima ação claros.</p></div>
      <button className="primary-button compact" type="button" onClick={openCreateForm}><Plus size={18} /> Novo projeto</button>
    </header>

    <section className="stats-grid compact-stats">
      <article className="stat-card"><span className="stat-icon violet"><FolderKanban size={20} /></span><div><strong>{activeProjects.length}</strong><small>projetos ativos</small></div></article>
      <article className="stat-card"><span className="stat-icon coral"><AlertTriangle size={20} /></span><div><strong>{riskyProjects.length}</strong><small>pedem atenção</small></div></article>
      <article className="stat-card"><span className="stat-icon amber"><ListChecks size={20} /></span><div><strong>{averageProgress}%</strong><small>progresso médio</small></div></article>
    </section>

    {showForm && <form className="task-form-card project-form-card" onSubmit={submitProject}>
      <div className="form-card-heading"><div><span className="eyebrow">{editingProject ? 'Editar projeto' : 'Novo projeto'}</span><h2>Qual entrega você quer organizar?</h2></div><button className="icon-button light" type="button" onClick={closeForm} aria-label="Fechar formulário"><X size={20} /></button></div>
      <label>Título<input autoFocus required maxLength={180} value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Ex.: Publicar a primeira versão do aplicativo" /></label>
      <label>Descrição<textarea rows={3} value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Escopo e contexto do projeto" /></label>
      <div className="form-grid project-form-grid">
        <label>Área<input value={form.area} onChange={(event) => updateField('area', event.target.value)} placeholder="Ex.: Produto" /></label>
        <label>Objetivo<select value={form.goalId} onChange={(event) => updateField('goalId', event.target.value)}><option value="">Sem objetivo</option>{(goalsQuery.data ?? []).filter((goal) => goal.status !== 'completed').map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={(event) => updateField('status', event.target.value as ProjectStatus)}>{Object.entries(statusLabel).filter(([value]) => value !== 'cancelled').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Prioridade<select value={form.priority} onChange={(event) => updateField('priority', event.target.value as Priority)}>{Object.entries(priorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Data inicial<input type="date" value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} /></label>
        <label>Data final<input type="date" value={form.targetDate} onChange={(event) => updateField('targetDate', event.target.value)} /></label>
      </div>
      <div className="form-grid project-text-grid"><label>Resultado esperado<textarea rows={3} value={form.expectedResult} onChange={(event) => updateField('expectedResult', event.target.value)} /></label><label>Próxima ação<textarea rows={3} value={form.nextAction} onChange={(event) => updateField('nextAction', event.target.value)} placeholder="A menor ação concreta para avançar" /></label><label>Observações<textarea rows={3} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} /></label></div>
      {(validationError || saveMutation.error) && <p className="form-error">{validationError || 'Não foi possível salvar o projeto.'}</p>}
      <div className="form-actions"><button className="text-button" type="button" onClick={closeForm}>Cancelar</button><button className="primary-button compact" disabled={saveMutation.isPending} type="submit">{saveMutation.isPending ? 'Salvando…' : editingProject ? 'Salvar alterações' : 'Criar projeto'}</button></div>
    </form>}

    <section className="goal-board project-board">
      <div className="task-toolbar goal-toolbar"><div><span className="eyebrow">Portfólio de execução</span><h2>Entregas acompanhadas</h2></div><div className="filter-group" aria-label="Filtrar projetos">{([['open', 'Em aberto'], ['completed', 'Concluídos'], ['all', 'Todos']] as const).map(([value, label]) => <button className={filter === value ? 'active' : ''} key={value} type="button" onClick={() => setFilter(value)}>{label}</button>)}</div></div>
      {(projectsQuery.isLoading || metricsQuery.isLoading) && <div className="page-state">Carregando projetos…</div>}
      {(projectsQuery.error || metricsQuery.error) && <div className="page-state error">Não foi possível carregar os projetos.</div>}
      {!projectsQuery.isLoading && visibleProjects.length === 0 && <div className="empty-state"><span><FolderKanban size={28} /></span><h3>Nenhum projeto nesta visão.</h3><p>Crie uma entrega e conecte as tarefas necessárias para concluí-la.</p><button className="secondary-button" type="button" onClick={openCreateForm}><Plus size={17} /> Criar projeto</button></div>}
      <div className="goal-grid project-grid">{visibleProjects.map((project) => {
        const metric = metricMap.get(project.id)
        const progress = metric?.progress ?? 0
        const overdue = Boolean(project.target_date && new Date(`${project.target_date}T23:59:59`).getTime() < Date.now() && project.status !== 'completed')
        const stagnant = project.status !== 'completed' && isStagnant(project.last_activity_at)
        const overEstimate = Boolean(metric && metric.planned_minutes > 0 && metric.actual_minutes > metric.planned_minutes * 1.25)
        const noNextAction = !project.next_action && project.status !== 'completed'
        const needsAttention = project.status === 'blocked' || overdue || stagnant || overEstimate || noNextAction
        return <article className={`goal-card project-card ${needsAttention ? 'attention' : ''}`} key={project.id}>
          <div className="goal-card-top"><div className="goal-tags"><span className={`goal-status project-status ${project.status}`}>{statusLabel[project.status]}</span><span className={`priority ${project.priority}`}>{priorityLabel[project.priority]}</span></div><div className="goal-actions"><button type="button" className="icon-button light" onClick={() => openEditForm(project)} aria-label={`Editar ${project.title}`}><Pencil size={17} /></button><button type="button" className="icon-button danger" onClick={() => confirmDelete(project)} aria-label={`Excluir ${project.title}`}><Trash2 size={17} /></button></div></div>
          <div className="goal-copy"><small>{project.area || 'Projeto pessoal'}</small><h3>{project.title}</h3>{project.description && <p>{project.description}</p>}</div>
          <div className="goal-progress"><div><span>Progresso por tarefas</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><small>{metric?.completed_tasks ?? 0} de {metric?.total_tasks ?? 0} tarefas concluídas</small></div>
          <div className="project-time"><span><Clock3 size={15} /> Planejado <strong>{formatMinutes(metric?.planned_minutes ?? 0)}</strong></span><span>Realizado <strong>{formatMinutes(metric?.actual_minutes ?? 0)}</strong></span></div>
          <div className="goal-meta"><span className={overdue ? 'overdue' : ''}><CalendarDays size={15} /> {formatDate(project.target_date)}</span>{project.goal_id && goalMap.get(project.goal_id) && <span><Target size={15} /> {goalMap.get(project.goal_id)}</span>}{project.status === 'completed' && <span className="completed-note"><CheckCircle2 size={15} /> Entrega concluída</span>}</div>
          {project.next_action && project.status !== 'completed' && <div className="project-next-action"><strong>Próxima ação</strong><span>{project.next_action}</span></div>}
          {needsAttention && project.status !== 'completed' && <div className="goal-warning"><AlertTriangle size={16} /> {project.status === 'blocked' ? 'Projeto bloqueado: registre como destravar.' : overdue ? 'Prazo vencido: revise o plano.' : overEstimate ? 'Tempo realizado está mais de 25% acima do planejado.' : stagnant ? 'Sem atividade há mais de 7 dias.' : 'Defina uma próxima ação concreta.'}</div>}
        </article>
      })}</div>
    </section>
  </div>
}
