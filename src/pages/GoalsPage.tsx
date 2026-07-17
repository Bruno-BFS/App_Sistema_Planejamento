import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Gauge, Pencil, Plus, Target, Trash2, X } from 'lucide-react'
import {
  createGoal, deleteGoal, getDefaultWorkspace, listGoalMetrics, listGoals, updateGoal,
  type GoalInput,
} from '../services/planning'
import type { Goal, GoalHorizon, GoalProgressMode, GoalStatus, Priority } from '../types/domain'

type GoalFilter = 'open' | 'completed' | 'all'

interface GoalFormState {
  title: string
  description: string
  status: GoalStatus
  startDate: string
  targetDate: string
  horizon: GoalHorizon
  indicatorName: string
  targetValue: string
  currentValue: string
  unit: string
  progress: string
  progressMode: GoalProgressMode
  priority: Priority
  motivation: string
  expectedResult: string
  nextReviewDate: string
  notes: string
}

const emptyForm: GoalFormState = {
  title: '', description: '', status: 'active', startDate: '', targetDate: '', horizon: 'short',
  indicatorName: '', targetValue: '', currentValue: '0', unit: '', progress: '0',
  progressMode: 'manual', priority: 'medium', motivation: '', expectedResult: '', nextReviewDate: '', notes: '',
}

const statusLabel: Record<GoalStatus, string> = {
  planned: 'Não iniciado', active: 'Em andamento', at_risk: 'Em risco', paused: 'Pausado', completed: 'Concluído', cancelled: 'Cancelado',
}
const horizonLabel: Record<GoalHorizon, string> = { short: 'Curto prazo', medium: 'Médio prazo', long: 'Longo prazo' }
const priorityLabel: Record<Priority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' }

function formatDate(value: string | null) {
  if (!value) return 'Sem prazo'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function daysUntil(value: string | null) {
  if (!value) return null
  const target = new Date(`${value}T23:59:59`).getTime()
  return Math.ceil((target - Date.now()) / 86_400_000)
}

function toForm(goal: Goal): GoalFormState {
  return {
    title: goal.title,
    description: goal.description ?? '',
    status: goal.status,
    startDate: goal.start_date ?? '',
    targetDate: goal.target_date ?? '',
    horizon: goal.horizon,
    indicatorName: goal.indicator_name ?? '',
    targetValue: goal.target_value?.toString() ?? '',
    currentValue: goal.current_value.toString(),
    unit: goal.unit ?? '',
    progress: goal.progress.toString(),
    progressMode: goal.progress_mode,
    priority: goal.priority,
    motivation: goal.motivation ?? '',
    expectedResult: goal.expected_result ?? '',
    nextReviewDate: goal.next_review_date ?? '',
    notes: goal.notes ?? '',
  }
}

export function GoalsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [filter, setFilter] = useState<GoalFilter>('open')
  const [form, setForm] = useState<GoalFormState>(emptyForm)
  const [validationError, setValidationError] = useState('')

  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const goalsQuery = useQuery({ queryKey: ['goals', workspaceId], queryFn: () => listGoals(workspaceId!), enabled: Boolean(workspaceId) })
  const metricsQuery = useQuery({ queryKey: ['goal-metrics', workspaceId], queryFn: () => listGoalMetrics(workspaceId!), enabled: Boolean(workspaceId) })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['goals', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['goal-metrics', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: (input: GoalInput) => editingGoal ? updateGoal(editingGoal.id, input) : createGoal(input),
    onSuccess: async () => { closeForm(); await refresh() },
  })
  const deleteMutation = useMutation({ mutationFn: deleteGoal, onSuccess: refresh })

  const goals = goalsQuery.data ?? []
  const metricMap = useMemo(() => new Map((metricsQuery.data ?? []).map((metric) => [metric.goal_id, metric])), [metricsQuery.data])
  const visibleGoals = goals.filter((goal) => filter === 'all'
    || (filter === 'completed' ? goal.status === 'completed' : goal.status !== 'completed'))
  const activeGoals = goals.filter((goal) => ['planned', 'active', 'at_risk'].includes(goal.status))
  const atRiskCount = goals.filter((goal) => goal.status === 'at_risk'
    || (goal.status !== 'completed' && (daysUntil(goal.target_date) ?? 99) <= 14 && goal.progress < 70)).length
  const averageProgress = activeGoals.length
    ? Math.round(activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / activeGoals.length)
    : 0

  function updateField<K extends keyof GoalFormState>(key: K, value: GoalFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function closeForm() {
    setShowForm(false)
    setEditingGoal(null)
    setForm(emptyForm)
    setValidationError('')
  }

  function openCreateForm() {
    setEditingGoal(null)
    setForm(emptyForm)
    setValidationError('')
    setShowForm(true)
  }

  function openEditForm(goal: Goal) {
    setEditingGoal(goal)
    setForm(toForm(goal))
    setValidationError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function submitGoal(event: FormEvent) {
    event.preventDefault()
    const targetValue = form.targetValue ? Number(form.targetValue) : null
    const currentValue = Number(form.currentValue || 0)
    if (form.progressMode === 'calculated' && (!targetValue || targetValue <= 0)) {
      setValidationError('Informe uma meta maior que zero para calcular o progresso automaticamente.')
      return
    }
    if (form.startDate && form.targetDate && form.targetDate < form.startDate) {
      setValidationError('A data final não pode ser anterior à data inicial.')
      return
    }
    setValidationError('')
    saveMutation.mutate({
      workspaceId: workspaceId!, title: form.title, description: form.description, status: form.status,
      startDate: form.startDate || null, targetDate: form.targetDate || null, horizon: form.horizon,
      indicatorName: form.indicatorName, targetValue, currentValue, unit: form.unit,
      progress: Math.min(100, Math.max(0, Number(form.progress || 0))), progressMode: form.progressMode,
      priority: form.priority, motivation: form.motivation, expectedResult: form.expectedResult,
      nextReviewDate: form.nextReviewDate || null, notes: form.notes,
    })
  }

  function confirmDelete(goal: Goal) {
    if (window.confirm(`Excluir o objetivo “${goal.title}”? Tarefas e projetos vinculados serão preservados, mas perderão este vínculo.`)) {
      deleteMutation.mutate(goal.id)
    }
  }

  if (workspaceQuery.isLoading) return <div className="page-state">Preparando seu espaço…</div>
  if (!workspaceId) return <div className="page-state error">Seu workspace ainda não está disponível.</div>

  return (
    <div className="today-page goals-page">
      <header className="page-header">
        <div><span className="eyebrow">Direção</span><h1>Seus objetivos</h1><p>Conecte o trabalho de hoje aos resultados que realmente importam.</p></div>
        <button className="primary-button compact" type="button" onClick={openCreateForm}><Plus size={18} /> Novo objetivo</button>
      </header>

      <section className="stats-grid compact-stats">
        <article className="stat-card"><span className="stat-icon violet"><Target size={20} /></span><div><strong>{activeGoals.length}</strong><small>objetivos ativos</small></div></article>
        <article className="stat-card"><span className="stat-icon coral"><AlertTriangle size={20} /></span><div><strong>{atRiskCount}</strong><small>pedem atenção</small></div></article>
        <article className="stat-card"><span className="stat-icon amber"><Gauge size={20} /></span><div><strong>{averageProgress}%</strong><small>progresso médio</small></div></article>
      </section>

      {showForm && (
        <form className="task-form-card goal-form-card" onSubmit={submitGoal}>
          <div className="form-card-heading"><div><span className="eyebrow">{editingGoal ? 'Editar objetivo' : 'Novo objetivo'}</span><h2>Qual resultado você quer alcançar?</h2></div><button className="icon-button light" type="button" onClick={closeForm} aria-label="Fechar formulário"><X size={20} /></button></div>
          <label>Título<input autoFocus required maxLength={180} value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Ex.: Lançar a primeira versão do produto" /></label>
          <label>Descrição<textarea rows={3} value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Contexto e escopo do objetivo" /></label>
          <div className="form-grid goal-form-grid">
            <label>Status<select value={form.status} onChange={(event) => updateField('status', event.target.value as GoalStatus)}>{Object.entries(statusLabel).filter(([value]) => value !== 'cancelled').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Horizonte<select value={form.horizon} onChange={(event) => updateField('horizon', event.target.value as GoalHorizon)}>{Object.entries(horizonLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Prioridade<select value={form.priority} onChange={(event) => updateField('priority', event.target.value as Priority)}>{Object.entries(priorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Data inicial<input type="date" value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} /></label>
            <label>Data final<input type="date" value={form.targetDate} onChange={(event) => updateField('targetDate', event.target.value)} /></label>
            <label>Próxima revisão<input type="date" value={form.nextReviewDate} onChange={(event) => updateField('nextReviewDate', event.target.value)} /></label>
          </div>
          <fieldset className="progress-fieldset"><legend>Como medir o progresso?</legend><div className="progress-mode-toggle"><label><input type="radio" checked={form.progressMode === 'manual'} onChange={() => updateField('progressMode', 'manual')} /> Manual</label><label><input type="radio" checked={form.progressMode === 'calculated'} onChange={() => updateField('progressMode', 'calculated')} /> Por indicador</label></div>
            {form.progressMode === 'manual' ? <label>Progresso atual ({form.progress}%)<input type="range" min="0" max="100" step="5" value={form.progress} onChange={(event) => updateField('progress', event.target.value)} /></label>
              : <div className="form-grid goal-indicator-grid"><label>Indicador<input required value={form.indicatorName} onChange={(event) => updateField('indicatorName', event.target.value)} placeholder="Ex.: usuários ativos" /></label><label>Valor atual<input min="0" step="any" type="number" value={form.currentValue} onChange={(event) => updateField('currentValue', event.target.value)} /></label><label>Meta<input required min="0.01" step="any" type="number" value={form.targetValue} onChange={(event) => updateField('targetValue', event.target.value)} /></label><label>Unidade<input value={form.unit} onChange={(event) => updateField('unit', event.target.value)} placeholder="Ex.: usuários" /></label></div>}
          </fieldset>
          <div className="form-grid goal-text-grid"><label>Por que isso importa?<textarea rows={3} value={form.motivation} onChange={(event) => updateField('motivation', event.target.value)} /></label><label>Resultado esperado<textarea rows={3} value={form.expectedResult} onChange={(event) => updateField('expectedResult', event.target.value)} /></label><label>Observações<textarea rows={3} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} /></label></div>
          {(validationError || saveMutation.error) && <p className="form-error">{validationError || 'Não foi possível salvar o objetivo.'}</p>}
          <div className="form-actions"><button className="text-button" type="button" onClick={closeForm}>Cancelar</button><button className="primary-button compact" disabled={saveMutation.isPending} type="submit">{saveMutation.isPending ? 'Salvando…' : editingGoal ? 'Salvar alterações' : 'Criar objetivo'}</button></div>
        </form>
      )}

      <section className="goal-board">
        <div className="task-toolbar goal-toolbar"><div><span className="eyebrow">Portfólio pessoal</span><h2>Resultados acompanhados</h2></div><div className="filter-group" aria-label="Filtrar objetivos">{([['open', 'Em aberto'], ['completed', 'Concluídos'], ['all', 'Todos']] as const).map(([value, label]) => <button className={filter === value ? 'active' : ''} key={value} type="button" onClick={() => setFilter(value)}>{label}</button>)}</div></div>
        {(goalsQuery.isLoading || metricsQuery.isLoading) && <div className="page-state">Carregando objetivos…</div>}
        {(goalsQuery.error || metricsQuery.error) && <div className="page-state error">Não foi possível carregar os objetivos.</div>}
        {!goalsQuery.isLoading && visibleGoals.length === 0 && <div className="empty-state"><span><Target size={28} /></span><h3>Nenhum objetivo nesta visão.</h3><p>Crie um resultado claro e conecte suas próximas tarefas a ele.</p><button className="secondary-button" type="button" onClick={openCreateForm}><Plus size={17} /> Criar objetivo</button></div>}
        <div className="goal-grid">{visibleGoals.map((goal) => {
          const metric = metricMap.get(goal.id)
          const remainingDays = daysUntil(goal.target_date)
          const overdue = remainingDays !== null && remainingDays < 0 && goal.status !== 'completed'
          const needsAttention = goal.status === 'at_risk' || overdue || (remainingDays !== null && remainingDays <= 14 && goal.progress < 70)
          return <article className={`goal-card ${needsAttention ? 'attention' : ''}`} key={goal.id}>
            <div className="goal-card-top"><div className="goal-tags"><span className={`goal-status ${goal.status}`}>{statusLabel[goal.status]}</span><span className={`priority ${goal.priority}`}>{priorityLabel[goal.priority]}</span></div><div className="goal-actions"><button type="button" className="icon-button light" onClick={() => openEditForm(goal)} aria-label={`Editar ${goal.title}`}><Pencil size={17} /></button><button type="button" className="icon-button danger" onClick={() => confirmDelete(goal)} aria-label={`Excluir ${goal.title}`}><Trash2 size={17} /></button></div></div>
            <div className="goal-copy"><small>{horizonLabel[goal.horizon]}</small><h3>{goal.title}</h3>{goal.description && <p>{goal.description}</p>}</div>
            <div className="goal-progress"><div><span>Progresso</span><strong>{goal.progress}%</strong></div><div className="progress-track"><span style={{ width: `${goal.progress}%` }} /></div>{goal.progress_mode === 'calculated' && <small>{goal.current_value} de {goal.target_value} {goal.unit}</small>}</div>
            <div className="goal-meta"><span className={overdue ? 'overdue' : ''}><CalendarDays size={15} /> {formatDate(goal.target_date)}</span><span><ClipboardList size={15} /> {metric?.open_tasks ?? 0} abertas · {metric?.completed_tasks ?? 0} concluídas</span>{goal.status === 'completed' && <span className="completed-note"><CheckCircle2 size={15} /> Resultado alcançado</span>}</div>
            {needsAttention && goal.status !== 'completed' && <div className="goal-warning"><AlertTriangle size={16} /> {overdue ? 'Prazo vencido: revise o plano.' : 'Prazo próximo com progresso abaixo do esperado.'}</div>}
            {!metric?.open_tasks && goal.status !== 'completed' && <div className="goal-context-warning">Nenhuma tarefa aberta vinculada a este objetivo.</div>}
          </article>
        })}</div>
      </section>
    </div>
  )
}
