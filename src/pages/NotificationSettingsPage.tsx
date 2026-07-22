import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellRing, CheckCircle2, Clock3, Info, Save, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { getDefaultWorkspace, getNotificationPreferences, saveNotificationPreferences } from '../services/planning'
import { disableWebPush, enableWebPush, getWebPushAvailability } from '../services/webPush'
import type { NotificationPreferences } from '../types/domain'

const weekDays = [
  [1, 'Segunda-feira'], [2, 'Terça-feira'], [3, 'Quarta-feira'], [4, 'Quinta-feira'],
  [5, 'Sexta-feira'], [6, 'Sábado'], [7, 'Domingo'],
] as const

function browserPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export function NotificationSettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [permission, setPermission] = useState(browserPermission)
  const [saved, setSaved] = useState(false)
  const pushAvailability = getWebPushAvailability()
  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const preferencesQuery = useQuery({
    queryKey: ['notification-preferences', workspaceId, user?.id],
    queryFn: () => getNotificationPreferences(workspaceId!, user!.id),
    enabled: Boolean(workspaceId && user),
  })

  useEffect(() => {
    if (preferencesQuery.data && !preferences) setPreferences(preferencesQuery.data)
  }, [preferences, preferencesQuery.data])

  const saveMutation = useMutation({
    mutationFn: saveNotificationPreferences,
    onSuccess: async (data) => {
      setPreferences(data)
      setSaved(true)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notification-preferences', workspaceId, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['personal-reminders', workspaceId] }),
      ])
    },
  })

  const pushMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!preferences || !workspaceId) throw new Error('Preferências indisponíveis.')
      const next = {
        ...preferences,
        browser_enabled: enabled ? false : preferences.browser_enabled,
        push_enabled: enabled,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || preferences.timezone,
      }
      if (enabled) await enableWebPush(workspaceId)
      if (!enabled) await disableWebPush()
      const savedPreferences = await saveNotificationPreferences(next)
      return savedPreferences
    },
    onSuccess: async (data) => {
      setPreferences(data)
      setPermission(browserPermission())
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['notification-preferences', workspaceId, user?.id] })
    },
  })

  function change<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    setPreferences((current) => current ? { ...current, [key]: value } : current)
    setSaved(false)
  }

  async function requestBrowserPermission() {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') change('browser_enabled', true)
  }

  function testBrowserNotification() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    new Notification('Meu Ritmo está pronto', { body: 'Os avisos do navegador estão funcionando.', tag: 'meu-ritmo:test' })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (preferences) saveMutation.mutate({
      ...preferences,
      browser_enabled: permission === 'granted' && preferences.browser_enabled,
      push_enabled: permission === 'granted' && preferences.push_enabled,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || preferences.timezone,
    })
  }

  if (workspaceQuery.isLoading || preferencesQuery.isLoading || !preferences) return <div className="page-state">Preparando suas notificações…</div>
  if (!workspaceId || !user) return <div className="page-state error">Não foi possível carregar suas preferências.</div>

  return <div className="today-page notification-settings-page">
    <header className="page-header"><div><span className="eyebrow">Atenção no momento certo</span><h1>Lembretes e notificações</h1><p>Escolha o que merece um aviso e quando sua rotina deve ser lembrada.</p></div></header>

    <section className="browser-notification-card">
      <div className="browser-notification-icon"><BellRing size={25} /></div>
      <div><span className="eyebrow">Avisos do navegador</span><h2>{preferences.push_enabled ? 'Segundo plano ativo' : permission === 'granted' ? 'Permissão ativa' : permission === 'denied' ? 'Permissão bloqueada' : permission === 'unsupported' ? 'Navegador incompatível' : 'Ative quando quiser'}</h2><p>{preferences.push_enabled ? 'Este dispositivo pode receber lembretes mesmo com o Meu Ritmo fechado.' : permission === 'granted' ? 'Ative o segundo plano para receber lembretes sem manter uma aba aberta.' : permission === 'denied' ? 'Reative as notificações nas configurações do navegador para usar este recurso.' : permission === 'unsupported' ? 'A central interna continuará funcionando normalmente.' : 'A permissão só será solicitada depois do seu clique.'}</p></div>
      <div className="browser-notification-actions">
        {permission === 'default' && <button className="primary-button compact" type="button" onClick={() => void requestBrowserPermission()}><Bell size={17} /> Permitir avisos</button>}
        {permission === 'granted' && <>
          <button className={preferences.push_enabled ? 'secondary-button compact' : 'primary-button compact'} type="button" disabled={pushMutation.isPending || pushAvailability !== 'available'} onClick={() => pushMutation.mutate(!preferences.push_enabled)}><BellRing size={17} /> {pushMutation.isPending ? 'Atualizando…' : preferences.push_enabled ? 'Desativar segundo plano' : 'Ativar segundo plano'}</button>
          <label className="toggle-row compact-toggle"><input type="checkbox" checked={preferences.browser_enabled} disabled={preferences.push_enabled} onChange={(event) => change('browser_enabled', event.target.checked)} /><span>Fallback com app aberto</span></label>
          <button className="secondary-button compact" type="button" onClick={testBrowserNotification}>Testar aviso</button>
        </>}
      </div>
    </section>

    <form className="notification-preferences-form" onSubmit={submit}>
      <section className="notification-preference-section">
        <div className="notification-section-heading"><span><Bell size={20} /></span><div><h2>O que lembrar</h2><p>Os lembretes também aparecem na central do sino, independentemente da permissão do navegador.</p></div></div>
        <div className="notification-toggle-list">
          <label className="toggle-row"><span><strong>Tarefas do dia e vencidas</strong><small>Avisa sobre tarefas abertas planejadas até hoje.</small></span><input type="checkbox" checked={preferences.task_reminders} onChange={(event) => change('task_reminders', event.target.checked)} /></label>
          <label className="toggle-row"><span><strong>Revisão diária</strong><small>Lembra de registrar humor, energia e intenção.</small></span><input type="checkbox" checked={preferences.daily_review_reminders} onChange={(event) => change('daily_review_reminders', event.target.checked)} /></label>
          <label className="toggle-row"><span><strong>Revisão semanal</strong><small>Lembra de fechar a semana e definir prioridades.</small></span><input type="checkbox" checked={preferences.weekly_review_reminders} onChange={(event) => change('weekly_review_reminders', event.target.checked)} /></label>
        </div>
      </section>

      <section className="notification-preference-section">
        <div className="notification-section-heading"><span><Clock3 size={20} /></span><div><h2>Quando lembrar</h2><p>Os horários usam o fuso local deste dispositivo.</p></div></div>
        <div className="notification-time-grid">
          <label>Resumo de tarefas<input type="time" value={preferences.daily_digest_time.slice(0, 5)} onChange={(event) => change('daily_digest_time', `${event.target.value}:00`)} /></label>
          <label>Revisão diária<input type="time" value={preferences.review_reminder_time.slice(0, 5)} onChange={(event) => change('review_reminder_time', `${event.target.value}:00`)} /></label>
          <label>Revisão semanal<select value={preferences.weekly_review_day} onChange={(event) => change('weekly_review_day', Number(event.target.value))}>{weekDays.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Lembrete antes da tarefa<select value={preferences.task_reminder_minutes} onChange={(event) => change('task_reminder_minutes', Number(event.target.value))}><option value={0}>No horário</option><option value={5}>5 minutos antes</option><option value={15}>15 minutos antes</option><option value={30}>30 minutos antes</option><option value={60}>1 hora antes</option></select></label>
          <label>Silêncio a partir de<input type="time" value={preferences.quiet_hours_start.slice(0, 5)} onChange={(event) => change('quiet_hours_start', `${event.target.value}:00`)} /></label>
          <label>Silêncio até<input type="time" value={preferences.quiet_hours_end.slice(0, 5)} onChange={(event) => change('quiet_hours_end', `${event.target.value}:00`)} /></label>
        </div>
      </section>

      <div className="notification-limit-note"><Info size={18} /><div><strong>Entrega resiliente</strong><p>O segundo plano respeita o fuso {preferences.timezone}, adia avisos durante o período silencioso e tenta novamente falhas temporárias.</p></div></div>
      {pushAvailability === 'missing-key' && <p className="form-error">Web Push aguarda a chave pública VAPID deste ambiente.</p>}
      {pushMutation.error && <p className="form-error">Não foi possível atualizar o Web Push. {pushMutation.error.message}</p>}
      {saveMutation.error && <p className="form-error">Não foi possível salvar suas preferências.</p>}
      {saved && <p className="form-success notification-success"><CheckCircle2 size={17} /> Preferências salvas e central atualizada.</p>}
      <div className="form-actions"><span className="notification-privacy"><ShieldCheck size={15} /> Preferências privadas por usuário</span><button className="primary-button compact" disabled={saveMutation.isPending} type="submit"><Save size={17} /> {saveMutation.isPending ? 'Salvando…' : 'Salvar preferências'}</button></div>
    </form>
  </div>
}
