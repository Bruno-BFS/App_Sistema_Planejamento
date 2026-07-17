import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellRing, CheckCircle2, Clock3, Info, Save, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { getDefaultWorkspace, getNotificationPreferences, saveNotificationPreferences } from '../services/planning'
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
    new Notification('Meu Ritmo está pronto', { body: 'Os avisos do navegador estão funcionando enquanto o app estiver aberto.', tag: 'meu-ritmo:test' })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (preferences) saveMutation.mutate({ ...preferences, browser_enabled: permission === 'granted' && preferences.browser_enabled })
  }

  if (workspaceQuery.isLoading || preferencesQuery.isLoading || !preferences) return <div className="page-state">Preparando suas notificações…</div>
  if (!workspaceId || !user) return <div className="page-state error">Não foi possível carregar suas preferências.</div>

  return <div className="today-page notification-settings-page">
    <header className="page-header"><div><span className="eyebrow">Atenção no momento certo</span><h1>Lembretes e notificações</h1><p>Escolha o que merece um aviso e quando sua rotina deve ser lembrada.</p></div></header>

    <section className="browser-notification-card">
      <div className="browser-notification-icon"><BellRing size={25} /></div>
      <div><span className="eyebrow">Avisos do navegador</span><h2>{permission === 'granted' ? 'Permissão ativa' : permission === 'denied' ? 'Permissão bloqueada' : permission === 'unsupported' ? 'Navegador incompatível' : 'Ative quando quiser'}</h2><p>{permission === 'granted' ? 'O app pode mostrar avisos enquanto estiver aberto em alguma aba.' : permission === 'denied' ? 'Reative as notificações nas configurações do navegador para usar este recurso.' : permission === 'unsupported' ? 'A central interna continuará funcionando normalmente.' : 'A permissão só será solicitada depois do seu clique.'}</p></div>
      <div className="browser-notification-actions">{permission === 'default' && <button className="primary-button compact" type="button" onClick={() => void requestBrowserPermission()}><Bell size={17} /> Permitir avisos</button>}{permission === 'granted' && <><label className="toggle-row compact-toggle"><input type="checkbox" checked={preferences.browser_enabled} onChange={(event) => change('browser_enabled', event.target.checked)} /><span>Usar avisos</span></label><button className="secondary-button compact" type="button" onClick={testBrowserNotification}>Testar aviso</button></>}</div>
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
        <div className="notification-section-heading"><span><Clock3 size={20} /></span><div><h2>Quando lembrar</h2><p>Os horários usam o fuso local do seu dispositivo.</p></div></div>
        <div className="notification-time-grid">
          <label>Resumo de tarefas<input type="time" value={preferences.daily_digest_time.slice(0, 5)} onChange={(event) => change('daily_digest_time', `${event.target.value}:00`)} /></label>
          <label>Revisão diária<input type="time" value={preferences.review_reminder_time.slice(0, 5)} onChange={(event) => change('review_reminder_time', `${event.target.value}:00`)} /></label>
          <label>Revisão semanal<select value={preferences.weekly_review_day} onChange={(event) => change('weekly_review_day', Number(event.target.value))}>{weekDays.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </section>

      <div className="notification-limit-note"><Info size={18} /><div><strong>Limite atual do MVP</strong><p>Os avisos do navegador funcionam com o app aberto. Para receber com o app fechado, a próxima evolução é Web Push com chaves VAPID e execução agendada.</p></div></div>
      {saveMutation.error && <p className="form-error">Não foi possível salvar suas preferências.</p>}
      {saved && <p className="form-success notification-success"><CheckCircle2 size={17} /> Preferências salvas e central atualizada.</p>}
      <div className="form-actions"><span className="notification-privacy"><ShieldCheck size={15} /> Preferências privadas por usuário</span><button className="primary-button compact" disabled={saveMutation.isPending} type="submit"><Save size={17} /> {saveMutation.isPending ? 'Salvando…' : 'Salvar preferências'}</button></div>
    </form>
  </div>
}
