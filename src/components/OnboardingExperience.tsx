import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, Heart, Sparkles, Target, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { completeOnboarding, getProfilePreferences } from '../services/planning'
import { useTheme } from '../theme/useTheme'
import type { CompanionType } from '../types/domain'
import { companionNames } from './companionConfig'
import { MoodCompanion } from './MoodCompanion'

const companions: CompanionType[] = ['fox', 'cat', 'robot', 'sprout', 'owl', 'capybara']
const steps = ['Boas-vindas', 'Seu estilo', 'Companheiro', 'Tudo pronto']

export function OnboardingExperience() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { theme, options: themeOptions, saving: savingTheme, setTheme } = useTheme()
  const [step, setStep] = useState(0)
  const [companion, setCompanion] = useState<CompanionType>('fox')
  const [companionHydrated, setCompanionHydrated] = useState(false)
  const [themeError, setThemeError] = useState('')
  const profileQuery = useQuery({
    queryKey: ['profile-preferences', user?.id],
    queryFn: () => getProfilePreferences(user!.id),
    enabled: Boolean(user),
  })
  const completeMutation = useMutation({
    mutationFn: () => completeOnboarding(user!.id, companion),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile-preferences', user?.id] })
      navigate('/', { replace: true })
    },
  })

  useEffect(() => {
    if (!profileQuery.data || companionHydrated) return
    setCompanion(profileQuery.data.companion_type)
    setCompanionHydrated(true)
  }, [companionHydrated, profileQuery.data])

  const shouldOpen = Boolean(user && profileQuery.data && !profileQuery.data.onboarding_completed_at)

  useEffect(() => {
    if (!shouldOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [shouldOpen])

  async function chooseTheme(nextTheme: typeof theme) {
    if (nextTheme === theme || savingTheme) return
    setThemeError('')
    try {
      await setTheme(nextTheme)
    } catch {
      setThemeError('Não foi possível salvar este tema. Tente novamente.')
    }
  }

  if (!shouldOpen) return null

  const displayName = user?.user_metadata.full_name ?? user?.user_metadata.name ?? ''
  const firstName = displayName.trim().split(' ')[0] || 'você'
  const selectedTheme = themeOptions.find((option) => option.value === theme) ?? themeOptions[0]

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <section className="onboarding-shell">
        <header className="onboarding-header">
          <div className="onboarding-brand"><span className="brand-mark image-mark primary-brand-mark"><img src={`${import.meta.env.BASE_URL}app-icon-mr-192.png`} alt="" /></span><span><strong>Meu Ritmo</strong><small>Seu espaço pessoal de planejamento</small></span></div>
          <div className="onboarding-progress" aria-label={`Etapa ${step + 1} de ${steps.length}`}>
            <span>{step + 1} de {steps.length}</span>
            <div>{steps.map((label, index) => <i className={index <= step ? 'active' : ''} key={label} title={label} />)}</div>
          </div>
        </header>

        <div className="onboarding-content">
          {step === 0 && <div className="onboarding-welcome">
            <div className="onboarding-hero-copy">
              <span className="eyebrow"><Sparkles size={14} /> Bem-vindo, {firstName}</span>
              <h1 id="onboarding-title">Organize seu tempo sem transformar a vida em uma lista infinita.</h1>
              <p>O Meu Ritmo ajuda você a escolher prioridades, proteger momentos de foco e entender como sua energia influencia a rotina.</p>
            </div>
            <div className="onboarding-benefits">
              <article><span><CalendarDays size={22} /></span><div><strong>Planeje com clareza</strong><p>Defina quando cada tarefa acontece e enxergue o espaço livre do dia.</p></div></article>
              <article><span><Zap size={22} /></span><div><strong>Proteja seu foco</strong><p>Execute uma coisa por vez e registre o tempo realmente dedicado.</p></div></article>
              <article><span><Heart size={22} /></span><div><strong>Respeite seu ritmo</strong><p>Humor, revisões e progresso ajudam você a ajustar a rotina sem culpa.</p></div></article>
            </div>
          </div>}

          {step === 1 && <div className="onboarding-choice-step">
            <div className="onboarding-step-heading"><span className="eyebrow"><Target size={14} /> Faça do seu jeito</span><h1 id="onboarding-title">Qual ambiente combina com você?</h1><p>A cor muda todo o aplicativo agora e continuará salva na sua conta.</p></div>
            <div className="onboarding-theme-grid" role="radiogroup" aria-label="Escolher tema do aplicativo">
              {themeOptions.map((option) => <button aria-checked={theme === option.value} aria-label={`${option.label}: ${option.description}`} className={theme === option.value ? 'active' : ''} disabled={savingTheme} key={option.value} onClick={() => void chooseTheme(option.value)} role="radio" type="button">
                <span className="onboarding-theme-preview" aria-hidden="true">{option.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
                <span className="onboarding-choice-check">{theme === option.value && <Check size={17} />}</span>
              </button>)}
            </div>
            {themeError && <p className="form-error" role="alert">{themeError}</p>}
          </div>}

          {step === 2 && <div className="onboarding-choice-step companion-step">
            <div className="onboarding-step-heading"><span className="eyebrow"><Heart size={14} /> Sua jornada</span><h1 id="onboarding-title">Quem vai acompanhar seu ritmo?</h1><p>Seu mascote vai reagir ao humor, lembrar pendências, celebrar avanços e sugerir a próxima ação.</p></div>
            <div className="onboarding-companion-layout">
              <div className="onboarding-selected-companion"><div className="companion-speech"><strong>{companionNames[companion]}</strong><span>Vamos construir uma rotina que caiba na sua vida.</span></div><MoodCompanion type={companion} mood={5} /></div>
              <div className="onboarding-companion-grid" role="radiogroup" aria-label="Escolher mascote">
                {companions.map((item) => <button aria-checked={companion === item} aria-label={companionNames[item]} className={companion === item ? 'active' : ''} key={item} onClick={() => setCompanion(item)} role="radio" type="button"><MoodCompanion type={item} mood={4} size="small" /><span><strong>{companionNames[item].split(',')[0]}</strong><small>{companionNames[item].split(',')[1]?.trim()}</small></span>{companion === item && <i><Check size={14} /></i>}</button>)}
              </div>
            </div>
          </div>}

          {step === 3 && <div className="onboarding-finish">
            <div className="onboarding-finish-pet"><span><Check size={24} /></span><MoodCompanion type={companion} mood={5} /></div>
            <span className="eyebrow"><Sparkles size={14} /> Espaço preparado</span>
            <h1 id="onboarding-title">Tudo pronto para começar no seu ritmo.</h1>
            <p><strong>{companionNames[companion].split(',')[0]}</strong> acompanhará sua jornada no tema <strong>{selectedTheme.label}</strong>. Comece definindo poucas tarefas para hoje — você poderá alterar essas escolhas nas configurações quando quiser.</p>
            <div className="onboarding-first-actions"><span><Clock3 size={18} /><strong>1.</strong> Planeje o que cabe hoje</span><span><Zap size={18} /><strong>2.</strong> Inicie um momento de foco</span><span><Heart size={18} /><strong>3.</strong> Revise como foi seu dia</span></div>
            {completeMutation.error && <p className="form-error" role="alert">Não foi possível concluir a configuração. Tente novamente.</p>}
          </div>}
        </div>

        <footer className="onboarding-footer">
          <div><strong>{steps[step]}</strong><small>{step === 0 ? 'Conheça a proposta' : step === 1 ? 'Escolha sua paleta' : step === 2 ? 'Escolha seu mascote' : 'Comece sua jornada'}</small></div>
          <div>
            {step > 0 && <button className="secondary-button compact" disabled={completeMutation.isPending} type="button" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={17} /> Voltar</button>}
            {step < steps.length - 1
              ? <button className="primary-button compact" disabled={savingTheme} type="button" onClick={() => setStep((current) => current + 1)}>{step === 0 ? 'Conhecer meu espaço' : 'Continuar'} <ArrowRight size={17} /></button>
              : <button className="primary-button compact" disabled={completeMutation.isPending} type="button" onClick={() => completeMutation.mutate()}>{completeMutation.isPending ? 'Preparando…' : 'Começar meu planejamento'} <ArrowRight size={17} /></button>}
          </div>
        </footer>
      </section>
    </div>
  )
}
