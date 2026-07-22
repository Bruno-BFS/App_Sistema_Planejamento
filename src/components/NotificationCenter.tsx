import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellRing, CalendarCheck2, CheckSquare2, Clock3, Settings, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { dismissReminder, getDefaultWorkspace, getNotificationPreferences, getPersonalReminders } from '../services/planning'
import type { Reminder, ReminderKind } from '../types/domain'
import { refreshWebPushRegistration } from '../services/webPush'

const reminderIcon: Record<ReminderKind, typeof Bell> = {
  overdue_task: Clock3,
  today_task: CheckSquare2,
  daily_review: CalendarCheck2,
  weekly_review: BellRing,
}

export function NotificationCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [hiddenReminderKeys, setHiddenReminderKeys] = useState<string[]>([])
  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const preferencesQuery = useQuery({
    queryKey: ['notification-preferences', workspaceId, user?.id],
    queryFn: () => getNotificationPreferences(workspaceId!, user!.id),
    enabled: Boolean(workspaceId && user),
  })
  const remindersQuery = useQuery({
    queryKey: ['personal-reminders', workspaceId],
    queryFn: () => getPersonalReminders(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: 5 * 60 * 1000,
  })
  const dismissMutation = useMutation({
    mutationFn: (reminderKey: string) => dismissReminder(workspaceId!, reminderKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personal-reminders', workspaceId] }),
    onError: (_error, reminderKey) => setHiddenReminderKeys((current) => current.filter((key) => key !== reminderKey)),
  })
  const reminders = useMemo(() => remindersQuery.data ?? [], [remindersQuery.data])
  const visibleReminders = useMemo(() => reminders.filter((reminder) => !hiddenReminderKeys.includes(reminder.reminder_key)), [hiddenReminderKeys, reminders])

  useEffect(() => {
    if (!preferencesQuery.data?.browser_enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    visibleReminders.forEach((reminder) => {
      const storageKey = `meu-ritmo:notified:${reminder.reminder_key}`
      if (window.localStorage.getItem(storageKey)) return
      window.localStorage.setItem(storageKey, new Date().toISOString())
      const notification = new Notification(reminder.title, { body: reminder.body, tag: storageKey })
      notification.onclick = () => { window.focus(); navigate(reminder.action_path); notification.close() }
    })
  }, [navigate, preferencesQuery.data?.browser_enabled, visibleReminders])

  useEffect(() => {
    if (!workspaceId || !preferencesQuery.data?.push_enabled) return
    void refreshWebPushRegistration(workspaceId).catch((error) => {
      console.warn('Não foi possível renovar a assinatura Web Push.', error)
    })
  }, [preferencesQuery.data?.push_enabled, workspaceId])

  function openReminder(reminder: Reminder) {
    setOpen(false)
    navigate(reminder.action_path)
  }

  function hideReminder(reminderKey: string) {
    setHiddenReminderKeys((current) => [...current, reminderKey])
    dismissMutation.mutate(reminderKey)
  }

  return <div className="notification-center">
    <button className={`notification-trigger ${visibleReminders.length ? 'has-reminders' : ''}`} type="button" aria-label={visibleReminders.length ? `${visibleReminders.length} lembretes` : 'Sem novos lembretes'} aria-expanded={open} aria-controls="notification-panel" onClick={() => setOpen((current) => !current)}>
      {visibleReminders.length ? <BellRing size={19} /> : <Bell size={19} />}
      {visibleReminders.length > 0 && <span>{Math.min(visibleReminders.length, 9)}</span>}
    </button>
    {open && <div className="notification-panel" id="notification-panel" role="dialog" aria-label="Central de lembretes">
      <div className="notification-panel-heading"><div><span className="eyebrow">Agora</span><h2>Lembretes</h2></div><button className="icon-button light" type="button" aria-label="Fechar lembretes" onClick={() => setOpen(false)}><X size={18} /></button></div>
      {remindersQuery.isLoading && <p className="notification-state">Buscando lembretes…</p>}
      {remindersQuery.error && <p className="notification-state error">Não foi possível atualizar os lembretes.</p>}
      {dismissMutation.error && <p className="notification-state error">Não foi possível dispensar o lembrete. Tente novamente.</p>}
      {!remindersQuery.isLoading && visibleReminders.length === 0 && <div className="notification-empty"><Bell size={24} /><strong>Tudo em dia.</strong><span>Nenhum lembrete precisa da sua atenção agora.</span></div>}
      <div className="notification-list">{visibleReminders.map((reminder) => {
        const Icon = reminderIcon[reminder.kind]
        return <article className={`notification-item priority-${reminder.priority}`} key={reminder.reminder_key}>
          <button className="notification-open" type="button" onClick={() => openReminder(reminder)}><span><Icon size={17} /></span><div><strong>{reminder.title}</strong><small>{reminder.body}</small></div></button>
          <button className="notification-dismiss" type="button" aria-label={`Dispensar ${reminder.title}`} disabled={dismissMutation.isPending} onClick={() => hideReminder(reminder.reminder_key)}><X size={15} /></button>
        </article>
      })}</div>
      <Link className="notification-settings-link" to="/notificacoes" onClick={() => setOpen(false)}><Settings size={15} /> Configurar notificações</Link>
    </div>}
  </div>
}
