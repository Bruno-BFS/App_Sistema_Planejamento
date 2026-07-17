import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BatteryMedium, CalendarCheck2, CheckCircle2, Flame, Heart, Save, Sparkles, Trash2 } from 'lucide-react'
import { MoodCompanion } from '../components/MoodCompanion'
import { companionNames } from '../components/companionConfig'
import { useAuth } from '../context/useAuth'
import {
  deleteDailyReview, getDailyReview, getDefaultWorkspace, getProfilePreferences, listRecentReviews,
  saveDailyReview, updateCompanion, type DailyReviewInput,
} from '../services/planning'
import type { CompanionType, DailyReview } from '../types/domain'

const companions: CompanionType[] = ['fox', 'cat', 'robot', 'sprout']
const moodOptions = [
  { value: 1, label: 'Muito difícil', emoji: '😞' },
  { value: 2, label: 'Difícil', emoji: '😕' },
  { value: 3, label: 'Neutro', emoji: '😌' },
  { value: 4, label: 'Bem', emoji: '🙂' },
  { value: 5, label: 'Muito bem', emoji: '😁' },
]
const energyOptions = [
  { value: 1, label: 'Esgotado' }, { value: 2, label: 'Baixa' }, { value: 3, label: 'Estável' },
  { value: 4, label: 'Boa' }, { value: 5, label: 'Excelente' },
]
const supportMessages = [
  ['Hoje pode ser só sobre respirar e se acolher.', 'Você não precisa resolver tudo agora.', 'Um passo pequeno ainda é um passo.'],
  ['Vamos reduzir o peso e escolher só o essencial.', 'Seu esforço de hoje também conta.', 'Que tal uma pausa curta antes do próximo passo?'],
  ['Estou aqui. Vamos observar o dia sem julgamento.', 'Um dia comum também constrói uma boa rotina.', 'O que deixaria amanhã um pouco mais leve?'],
  ['Que bom ver essa energia! Guarde o que funcionou.', 'Você criou um ritmo bonito hoje.', 'Vamos transformar esse ânimo em uma intenção clara.'],
  ['Celebre! Seu entusiasmo merece espaço.', 'Que dia bom para reconhecer suas conquistas!', 'Leve essa energia com carinho para amanhã.'],
]

function localDate() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))
}

function calculateStreak(reviews: DailyReview[]) {
  if (!reviews.length) return 0
  const dates = new Set(reviews.map((review) => review.review_date))
  const cursor = new Date(`${localDate()}T12:00:00`)
  if (!dates.has(localDate())) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function ReviewPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [companion, setCompanion] = useState<CompanionType>('fox')
  const [mood, setMood] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [wins, setWins] = useState('')
  const [challenges, setChallenges] = useState('')
  const [learnings, setLearnings] = useState('')
  const [tomorrowIntention, setTomorrowIntention] = useState('')
  const [reviewHydrated, setReviewHydrated] = useState(false)
  const [companionHydrated, setCompanionHydrated] = useState(false)
  const [messageIndex, setMessageIndex] = useState(0)
  const [saved, setSaved] = useState(false)

  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const profileQuery = useQuery({ queryKey: ['profile-preferences', user?.id], queryFn: () => getProfilePreferences(user!.id), enabled: Boolean(user) })
  const reviewQuery = useQuery({ queryKey: ['daily-review', workspaceId, user?.id, localDate()], queryFn: () => getDailyReview(workspaceId!, user!.id), enabled: Boolean(workspaceId && user) })
  const recentQuery = useQuery({ queryKey: ['recent-reviews', workspaceId, user?.id], queryFn: () => listRecentReviews(workspaceId!, user!.id), enabled: Boolean(workspaceId && user) })

  useEffect(() => {
    if (profileQuery.data && !companionHydrated) {
      setCompanion(profileQuery.data.companion_type)
      setCompanionHydrated(true)
    }
  }, [companionHydrated, profileQuery.data])

  useEffect(() => {
    if (reviewQuery.isFetched && !reviewHydrated) {
      const review = reviewQuery.data
      if (review) {
        setMood(review.mood_score ?? 3)
        setEnergy(review.energy_score ?? 3)
        setWins(review.wins ?? '')
        setChallenges(review.challenges ?? '')
        setLearnings(review.learnings ?? '')
        setTomorrowIntention(review.tomorrow_intention ?? '')
      }
      setReviewHydrated(true)
    }
  }, [reviewHydrated, reviewQuery.data, reviewQuery.isFetched])

  const companionMutation = useMutation({
    mutationFn: (next: CompanionType) => updateCompanion(user!.id, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile-preferences', user?.id] }),
  })
  const saveMutation = useMutation({
    mutationFn: (input: DailyReviewInput) => saveDailyReview(input),
    onSuccess: async () => {
      setSaved(true)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['daily-review', workspaceId, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['recent-reviews', workspaceId, user?.id] }),
      ])
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteDailyReview,
    onSuccess: async () => {
      setMood(3); setEnergy(3); setWins(''); setChallenges(''); setLearnings(''); setTomorrowIntention(''); setSaved(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['daily-review', workspaceId, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['recent-reviews', workspaceId, user?.id] }),
      ])
    },
  })

  const reviews = useMemo(() => recentQuery.data ?? [], [recentQuery.data])
  const streak = calculateStreak(reviews)
  const averageMood = reviews.length
    ? (reviews.reduce((sum, review) => sum + (review.mood_score ?? 0), 0) / reviews.length).toFixed(1)
    : '—'
  const currentMessage = supportMessages[mood - 1][messageIndex % supportMessages[mood - 1].length]
  const recentVisible = useMemo(() => reviews.slice(0, 7), [reviews])

  function chooseCompanion(next: CompanionType) {
    setCompanion(next)
    setMessageIndex(0)
    companionMutation.mutate(next)
  }

  function chooseMood(next: number) {
    setMood(next)
    setMessageIndex(0)
    setSaved(false)
  }

  function submitReview(event: FormEvent) {
    event.preventDefault()
    saveMutation.mutate({
      workspaceId: workspaceId!, userId: user!.id, wins, challenges, learnings,
      tomorrowIntention, moodScore: mood, energyScore: energy,
    })
  }

  function confirmDeleteReview() {
    if (reviewQuery.data && window.confirm('Excluir a revisão de hoje? Esta ação não pode ser desfeita.')) deleteMutation.mutate(reviewQuery.data.id)
  }

  if (workspaceQuery.isLoading || profileQuery.isLoading || reviewQuery.isLoading) return <div className="page-state">Preparando sua revisão…</div>
  if (!workspaceId || !user) return <div className="page-state error">Não foi possível preparar sua revisão.</div>

  return <div className="today-page review-page">
    <header className="page-header">
      <div><span className="eyebrow">Autoconhecimento</span><h1>Revisão do dia</h1><p>Feche o ciclo com honestidade, reconheça o que funcionou e prepare um amanhã mais leve.</p></div>
      {reviewQuery.data && <span className="review-saved-badge"><CheckCircle2 size={17} /> Revisão registrada</span>}
    </header>

    <section className="stats-grid compact-stats">
      <article className="stat-card"><span className="stat-icon coral"><Flame size={20} /></span><div><strong>{streak}</strong><small>dias de sequência</small></div></article>
      <article className="stat-card"><span className="stat-icon violet"><Heart size={20} /></span><div><strong>{averageMood}</strong><small>humor médio recente</small></div></article>
      <article className="stat-card"><span className="stat-icon amber"><CalendarCheck2 size={20} /></span><div><strong>{reviews.length}</strong><small>revisões registradas</small></div></article>
    </section>

    <section className="companion-panel">
      <div className="companion-stage-wrap">
        <div className={`companion-speech mood-${mood}`}><strong>{companionNames[companion]}</strong><span>{currentMessage}</span></div>
        <MoodCompanion type={companion} mood={mood} interactive onInteract={() => setMessageIndex((current) => current + 1)} />
      </div>
      <div className="companion-settings">
        <span className="eyebrow"><Sparkles size={14} /> Seu companheiro</span>
        <h2>Quem vai acompanhar seu ritmo?</h2>
        <p>Escolha um personagem. Ele reage ao seu humor e fica salvo no seu perfil.</p>
        <div className="companion-picker" aria-label="Escolher personagem">{companions.map((item) => <button className={companion === item ? 'active' : ''} type="button" key={item} onClick={() => chooseCompanion(item)} aria-pressed={companion === item}><MoodCompanion type={item} mood={4} size="small" /><span>{companionNames[item].split(',')[0]}</span></button>)}</div>
        {companionMutation.error && <p className="form-error">Não foi possível salvar o personagem escolhido.</p>}
      </div>
    </section>

    <form className="review-form" onSubmit={submitReview}>
      <section className="review-section mood-section">
        <div className="review-section-heading"><span className="review-step">1</span><div><h2>Como você está agora?</h2><p>Não existe resposta certa. Seu companheiro vai reagir junto com você.</p></div></div>
        <div className="mood-picker" role="radiogroup" aria-label="Humor atual">{moodOptions.map((option) => <button className={mood === option.value ? 'active' : ''} type="button" role="radio" aria-checked={mood === option.value} key={option.value} onClick={() => chooseMood(option.value)}><span>{option.emoji}</span><strong>{option.label}</strong></button>)}</div>
        <div className="energy-field"><label htmlFor="energy"><BatteryMedium size={18} /> Energia: <strong>{energyOptions[energy - 1].label}</strong></label><input id="energy" type="range" min="1" max="5" step="1" value={energy} onChange={(event) => { setEnergy(Number(event.target.value)); setSaved(false) }} /><div><span>Sem energia</span><span>Cheio de energia</span></div></div>
      </section>

      <section className="review-section">
        <div className="review-section-heading"><span className="review-step">2</span><div><h2>Dê sentido ao seu dia</h2><p>Respostas curtas já são suficientes para construir consciência ao longo do tempo.</p></div></div>
        <div className="review-fields">
          <label>O que deu certo hoje?<textarea rows={4} value={wins} onChange={(event) => { setWins(event.target.value); setSaved(false) }} placeholder="Uma conquista, avanço ou momento bom…" /></label>
          <label>O que foi difícil?<textarea rows={4} value={challenges} onChange={(event) => { setChallenges(event.target.value); setSaved(false) }} placeholder="Um obstáculo, distração ou incômodo…" /></label>
          <label>O que você aprendeu?<textarea rows={4} value={learnings} onChange={(event) => { setLearnings(event.target.value); setSaved(false) }} placeholder="Sobre você, seu trabalho ou seu ritmo…" /></label>
          <label>Qual é a intenção para amanhã?<textarea rows={4} value={tomorrowIntention} onChange={(event) => { setTomorrowIntention(event.target.value); setSaved(false) }} placeholder="Ex.: terminar o essencial antes de abrir novas frentes" /></label>
        </div>
        {(saveMutation.error) && <p className="form-error">Não foi possível salvar sua revisão. Tente novamente.</p>}
        {saved && <p className="form-success"><CheckCircle2 size={17} /> Revisão salva. Você pode voltar e atualizá-la até o fim do dia.</p>}
        <div className="form-actions">{reviewQuery.data && <button className="text-button danger-text" disabled={deleteMutation.isPending} type="button" onClick={confirmDeleteReview}><Trash2 size={17} /> Excluir revisão</button>}<button className="primary-button compact review-save" disabled={saveMutation.isPending} type="submit"><Save size={18} /> {saveMutation.isPending ? 'Salvando…' : reviewQuery.data ? 'Atualizar revisão' : 'Salvar revisão'}</button></div>
      </section>
    </form>

    {recentVisible.length > 0 && <section className="review-history"><div><span className="eyebrow">Seu ritmo recente</span><h2>Últimos registros</h2></div><div className="review-history-list">{recentVisible.map((review) => <article key={review.id}><time>{formatReviewDate(review.review_date)}</time><span title={`Humor ${review.mood_score} de 5`}>{moodOptions[(review.mood_score ?? 3) - 1].emoji}</span><div><strong>{review.tomorrow_intention || review.wins || 'Revisão registrada'}</strong><small>Energia {review.energy_score ?? '—'}/5</small></div></article>)}</div></section>}
  </div>
}
