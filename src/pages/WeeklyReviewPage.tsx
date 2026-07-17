import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BatteryMedium, CalendarRange, CheckCircle2, Clock3, Gauge, Save, Sparkles, Target, Trash2, Trophy } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import {
  deleteWeeklyReview, getDefaultWorkspace, getPersonalAnalytics, getWeeklyReview, listRecentWeeklyReviews,
  saveWeeklyReview, type WeeklyReviewInput,
} from '../services/planning'
import type { WeeklyReview } from '../types/domain'

function dateString(date: Date) {
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

function currentWeek() {
  const today = new Date()
  const day = today.getDay() || 7
  const start = new Date(today)
  start.setDate(today.getDate() - day + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: dateString(start), end: dateString(end) }
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(`${value}T12:00:00`))
}

function formatWeek(start: string) {
  const date = new Date(`${start}T12:00:00`)
  const end = new Date(date)
  end.setDate(date.getDate() + 6)
  return `${formatDate(start, { day: '2-digit', month: 'short' })} a ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(end)}`
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  if (!hours) return `${minutes}min`
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

const confidenceLabels = ['Muito baixa', 'Baixa', 'Realista', 'Boa', 'Muito boa']

export function WeeklyReviewPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const week = useMemo(currentWeek, [])
  const [biggestWin, setBiggestWin] = useState('')
  const [mainChallenge, setMainChallenge] = useState('')
  const [keyLearning, setKeyLearning] = useState('')
  const [stopDoing, setStopDoing] = useState('')
  const [startDoing, setStartDoing] = useState('')
  const [continueDoing, setContinueDoing] = useState('')
  const [priorities, setPriorities] = useState(['', '', ''])
  const [weeklyIntention, setWeeklyIntention] = useState('')
  const [confidence, setConfidence] = useState(3)
  const [hydrated, setHydrated] = useState(false)
  const [saved, setSaved] = useState(false)

  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const analyticsQuery = useQuery({
    queryKey: ['personal-analytics', workspaceId, week.start, week.end],
    queryFn: () => getPersonalAnalytics(workspaceId!, week.start, week.end),
    enabled: Boolean(workspaceId),
  })
  const reviewQuery = useQuery({
    queryKey: ['weekly-review', workspaceId, user?.id, week.start],
    queryFn: () => getWeeklyReview(workspaceId!, user!.id, week.start),
    enabled: Boolean(workspaceId && user),
  })
  const historyQuery = useQuery({
    queryKey: ['weekly-reviews', workspaceId, user?.id],
    queryFn: () => listRecentWeeklyReviews(workspaceId!, user!.id),
    enabled: Boolean(workspaceId && user),
  })

  useEffect(() => {
    if (!reviewQuery.isFetched || hydrated) return
    const review = reviewQuery.data
    if (review) {
      setBiggestWin(review.biggest_win ?? '')
      setMainChallenge(review.main_challenge ?? '')
      setKeyLearning(review.key_learning ?? '')
      setStopDoing(review.stop_doing ?? '')
      setStartDoing(review.start_doing ?? '')
      setContinueDoing(review.continue_doing ?? '')
      setPriorities([...review.next_week_priorities, '', '', ''].slice(0, 3))
      setWeeklyIntention(review.weekly_intention ?? '')
      setConfidence(review.confidence_score)
    }
    setHydrated(true)
  }, [hydrated, reviewQuery.data, reviewQuery.isFetched])

  const saveMutation = useMutation({
    mutationFn: (input: WeeklyReviewInput) => saveWeeklyReview(input),
    onSuccess: async () => {
      setSaved(true)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['weekly-review', workspaceId, user?.id, week.start] }),
        queryClient.invalidateQueries({ queryKey: ['weekly-reviews', workspaceId, user?.id] }),
      ])
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteWeeklyReview,
    onSuccess: async () => {
      setBiggestWin(''); setMainChallenge(''); setKeyLearning(''); setStopDoing(''); setStartDoing('')
      setContinueDoing(''); setPriorities(['', '', '']); setWeeklyIntention(''); setConfidence(3); setSaved(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['weekly-review', workspaceId, user?.id, week.start] }),
        queryClient.invalidateQueries({ queryKey: ['weekly-reviews', workspaceId, user?.id] }),
      ])
    },
  })

  const analytics = useMemo(() => analyticsQuery.data ?? [], [analyticsQuery.data])
  const plannedTasks = analytics.reduce((sum, day) => sum + day.planned_tasks, 0)
  const completedTasks = analytics.reduce((sum, day) => sum + day.completed_tasks, 0)
  const focusMinutes = analytics.reduce((sum, day) => sum + day.focus_minutes, 0)
  const reviewedDays = analytics.filter((day) => day.mood_score !== null && day.energy_score !== null)
  const averageMood = average(reviewedDays.map((day) => day.mood_score!))
  const completionRate = plannedTasks ? Math.min(100, Math.round(completedTasks / plannedTasks * 100)) : 0
  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data])

  function updatePriority(index: number, value: string) {
    setPriorities((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))
    setSaved(false)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    saveMutation.mutate({
      workspaceId: workspaceId!, userId: user!.id, weekStart: week.start, biggestWin, mainChallenge, keyLearning,
      stopDoing, startDoing, continueDoing, priorities, weeklyIntention, confidenceScore: confidence,
    })
  }

  function confirmDelete() {
    if (reviewQuery.data && window.confirm('Excluir esta revisão semanal? Esta ação não pode ser desfeita.')) deleteMutation.mutate(reviewQuery.data.id)
  }

  if (workspaceQuery.isLoading || reviewQuery.isLoading) return <div className="page-state">Preparando sua revisão semanal…</div>
  if (!workspaceId || !user) return <div className="page-state error">Não foi possível preparar a revisão semanal.</div>

  return <div className="today-page weekly-review-page">
    <header className="page-header weekly-review-header">
      <div><span className="eyebrow">Fechamento e direção</span><h1>Revisão semanal</h1><p>Transforme os dados da semana em aprendizados e prioridades realistas.</p></div>
      <div className="week-period"><CalendarRange size={18} /><span><small>Semana atual</small><strong>{formatWeek(week.start)}</strong></span></div>
    </header>

    <section className="weekly-summary" aria-label="Resumo da semana">
      <article><span className="stat-icon violet"><CheckCircle2 size={20} /></span><div><small>Execução</small><strong>{completionRate}%</strong><em>{completedTasks} de {plannedTasks} tarefas</em></div></article>
      <article><span className="stat-icon amber"><Clock3 size={20} /></span><div><small>Foco</small><strong>{formatMinutes(focusMinutes)}</strong><em>sessões encerradas</em></div></article>
      <article><span className="stat-icon coral"><BatteryMedium size={20} /></span><div><small>Humor médio</small><strong>{reviewedDays.length ? averageMood.toFixed(1) : '—'}<b>/5</b></strong><em>{reviewedDays.length} check-ins</em></div></article>
      <article><span className="stat-icon violet"><Gauge size={20} /></span><div><small>Confiança</small><strong>{confidence}<b>/5</b></strong><em>{confidenceLabels[confidence - 1]}</em></div></article>
    </section>

    {analyticsQuery.error && <p className="form-error weekly-data-error">Não foi possível carregar todos os indicadores. Você ainda pode registrar sua reflexão.</p>}

    <form className="weekly-review-form" onSubmit={submit}>
      <section className="review-section">
        <div className="review-section-heading"><span className="review-step">1</span><div><h2>Olhe para trás</h2><p>Registre os fatos mais importantes, sem tentar explicar tudo.</p></div></div>
        <div className="weekly-reflection-grid">
          <label><Trophy size={17} /> Maior conquista<textarea rows={4} value={biggestWin} onChange={(event) => { setBiggestWin(event.target.value); setSaved(false) }} placeholder="O avanço que mais vale reconhecer…" /></label>
          <label><Target size={17} /> Principal obstáculo<textarea rows={4} value={mainChallenge} onChange={(event) => { setMainChallenge(event.target.value); setSaved(false) }} placeholder="O que mais dificultou seu ritmo…" /></label>
          <label><Sparkles size={17} /> Aprendizado-chave<textarea rows={4} value={keyLearning} onChange={(event) => { setKeyLearning(event.target.value); setSaved(false) }} placeholder="O que esta semana ensinou…" /></label>
        </div>
      </section>

      <section className="review-section">
        <div className="review-section-heading"><span className="review-step">2</span><div><h2>Ajuste o sistema</h2><p>Escolha mudanças pequenas que possam ser observadas na próxima semana.</p></div></div>
        <div className="weekly-adjust-grid">
          <label><span className="adjust-badge stop">Parar</span><textarea rows={3} value={stopDoing} onChange={(event) => { setStopDoing(event.target.value); setSaved(false) }} placeholder="Algo que consome energia sem retorno…" /></label>
          <label><span className="adjust-badge start">Começar</span><textarea rows={3} value={startDoing} onChange={(event) => { setStartDoing(event.target.value); setSaved(false) }} placeholder="Uma ação simples para experimentar…" /></label>
          <label><span className="adjust-badge continue">Continuar</span><textarea rows={3} value={continueDoing} onChange={(event) => { setContinueDoing(event.target.value); setSaved(false) }} placeholder="O hábito que já está funcionando…" /></label>
        </div>
      </section>

      <section className="review-section">
        <div className="review-section-heading"><span className="review-step">3</span><div><h2>Defina a próxima semana</h2><p>Limite-se a três resultados importantes para proteger seu foco.</p></div></div>
        <div className="weekly-priority-grid">{priorities.map((priority, index) => <label key={index}><span>{index + 1}</span><input value={priority} onChange={(event) => updatePriority(index, event.target.value)} placeholder={index === 0 ? 'Prioridade principal' : `Prioridade ${index + 1}`} /></label>)}</div>
        <label className="weekly-intention">Intenção da semana<textarea rows={3} value={weeklyIntention} onChange={(event) => { setWeeklyIntention(event.target.value); setSaved(false) }} placeholder="Como você quer conduzir seus dias, mesmo quando houver imprevistos?" /></label>
        <div className="confidence-field"><label htmlFor="weekly-confidence"><Gauge size={18} /> Confiança neste plano: <strong>{confidenceLabels[confidence - 1]}</strong></label><input id="weekly-confidence" type="range" min="1" max="5" value={confidence} onChange={(event) => { setConfidence(Number(event.target.value)); setSaved(false) }} /><div><span>Precisa simplificar</span><span>Plano sustentável</span></div></div>
        {saveMutation.error && <p className="form-error">Não foi possível salvar a revisão semanal. Tente novamente.</p>}
        {saved && <p className="form-success"><CheckCircle2 size={17} /> Revisão semanal salva. Suas prioridades ficaram registradas.</p>}
        <div className="form-actions">{reviewQuery.data && <button className="text-button danger-text" disabled={deleteMutation.isPending} type="button" onClick={confirmDelete}><Trash2 size={17} /> Excluir revisão</button>}<button className="primary-button compact review-save" disabled={saveMutation.isPending} type="submit"><Save size={18} /> {saveMutation.isPending ? 'Salvando…' : reviewQuery.data ? 'Atualizar semana' : 'Salvar revisão semanal'}</button></div>
      </section>
    </form>

    {history.length > 0 && <section className="weekly-history"><div><span className="eyebrow">Decisões anteriores</span><h2>Histórico semanal</h2></div><div className="weekly-history-list">{history.map((review: WeeklyReview) => <article key={review.id}><div><CalendarRange size={17} /><span><small>Semana</small><strong>{formatWeek(review.week_start)}</strong></span></div><p>{review.weekly_intention || review.key_learning || 'Revisão semanal registrada'}</p><span className="history-confidence">Confiança {review.confidence_score}/5 <ArrowRight size={14} /></span></article>)}</div></section>}
  </div>
}
