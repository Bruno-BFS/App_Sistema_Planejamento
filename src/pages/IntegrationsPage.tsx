import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck2, CheckCircle2, Download, ExternalLink, Info, Link2, LockKeyhole, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import {
  getDefaultWorkspace, listCalendarTasks, listGoogleCalendarLinks, syncTasksToGoogleCalendar,
} from '../services/planning'

function localDate(date = new Date()) {
  const value = new Date(date)
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 10)
}

function futureDate(days: number) {
  const value = new Date()
  value.setDate(value.getDate() + days)
  return localDate(value)
}

function formatSyncTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    .format(new Date(value))
}

export function IntegrationsPage() {
  const { user, session, connectGoogleCalendar } = useAuth()
  const queryClient = useQueryClient()
  const installPrompt = useInstallPrompt()
  const [searchParams] = useSearchParams()
  const [syncMessage, setSyncMessage] = useState('')
  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const providerToken = session?.provider_token ?? null
  const hasGoogleIdentity = Boolean(user?.app_metadata.providers?.includes('google'))
  const justConnected = searchParams.get('calendar') === 'connected'
  const startDate = localDate()
  const endDate = futureDate(30)

  const tasksQuery = useQuery({
    queryKey: ['calendar-sync-tasks', workspaceId, startDate, endDate],
    queryFn: () => listCalendarTasks(workspaceId!, startDate, endDate),
    enabled: Boolean(workspaceId),
  })
  const linksQuery = useQuery({
    queryKey: ['google-calendar-links', workspaceId, user?.id],
    queryFn: () => listGoogleCalendarLinks(workspaceId!, user!.id),
    enabled: Boolean(workspaceId && user),
  })
  const eligibleTasks = useMemo(() => (tasksQuery.data ?? [])
    .filter((task) => task.planned_date && task.status !== 'cancelled')
    .slice(0, 25), [tasksQuery.data])
  const taskMap = useMemo(() => new Map((tasksQuery.data ?? []).map((task) => [task.id, task])), [tasksQuery.data])
  const syncedTaskIds = useMemo(() => new Set((linksQuery.data ?? []).map((link) => link.task_id)), [linksQuery.data])

  const connectMutation = useMutation({ mutationFn: connectGoogleCalendar })
  const syncMutation = useMutation({
    mutationFn: () => syncTasksToGoogleCalendar(eligibleTasks.map((task) => task.id), providerToken!),
    onSuccess: async (result) => {
      setSyncMessage(`${result.count} ${result.count === 1 ? 'tarefa sincronizada' : 'tarefas sincronizadas'} com sucesso.`)
      await queryClient.invalidateQueries({ queryKey: ['google-calendar-links', workspaceId, user?.id] })
    },
    onError: () => setSyncMessage(''),
  })

  if (workspaceQuery.isLoading) return <div className="page-state">Preparando integrações…</div>
  if (!workspaceId || !user) return <div className="page-state error">Não foi possível carregar suas integrações.</div>

  return <div className="today-page integrations-page">
    <header className="page-header"><div><span className="eyebrow">Seu ecossistema</span><h1>Integrações e aplicativo</h1><p>Leve seu planejamento para o calendário e instale o Meu Ritmo no seu dispositivo.</p></div></header>

    <section className="integration-card google-calendar-card">
      <div className="integration-card-heading">
        <span className="integration-logo google-logo"><CalendarCheck2 size={27} /></span>
        <div><span className="eyebrow">Google Calendar</span><h2>Suas tarefas no calendário</h2><p>Sincronização unidirecional de tarefas planejadas para os próximos 30 dias.</p></div>
        <span className={`connection-badge ${providerToken ? 'connected' : 'pending'}`}>{providerToken ? 'Sessão conectada' : hasGoogleIdentity ? 'Permissão necessária' : 'Não conectado'}</span>
      </div>

      {(justConnected || syncMessage) && <p className="integration-success"><CheckCircle2 size={17} /> {syncMessage || 'Conta Google conectada. Você já pode sincronizar suas tarefas.'}</p>}
      <div className="calendar-integration-grid">
        <article><strong>{eligibleTasks.length}</strong><span>tarefas elegíveis</span><small>Hoje até {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${endDate}T12:00:00`))}</small></article>
        <article><strong>{eligibleTasks.filter((task) => syncedTaskIds.has(task.id)).length}</strong><span>já vinculadas</span><small>Atualizações não criam duplicatas</small></article>
        <article><strong>Dia inteiro</strong><span>formato do evento</span><small>Horários entram em uma evolução futura</small></article>
      </div>

      <div className="integration-actions">
        <button className={providerToken ? 'secondary-button compact' : 'primary-button compact'} type="button" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}><Link2 size={17} /> {providerToken ? 'Renovar permissão' : 'Conectar Google Calendar'}</button>
        <button className="primary-button compact" type="button" onClick={() => syncMutation.mutate()} disabled={!providerToken || !eligibleTasks.length || syncMutation.isPending}><RefreshCw size={17} /> {syncMutation.isPending ? 'Sincronizando…' : 'Sincronizar próximos 30 dias'}</button>
        <a className="text-link-button" href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer">Abrir Google Calendar <ExternalLink size={14} /></a>
      </div>
      {connectMutation.error && <p className="form-error">Não foi possível iniciar a conexão com o Google.</p>}
      {syncMutation.error && <p className="form-error">{syncMutation.error.message} Renove a permissão e tente novamente.</p>}
      {(tasksQuery.data?.length ?? 0) > 25 && <p className="integration-note"><Info size={15} /> Por segurança e controle de cota, cada sincronização processa até 25 tarefas.</p>}

      <div className="sync-history">
        <div><span className="eyebrow">Últimos vínculos</span><small>{linksQuery.data?.length ?? 0} eventos</small></div>
        {linksQuery.isLoading && <p>Carregando histórico…</p>}
        {linksQuery.error && <p className="form-error">Não foi possível consultar os eventos vinculados.</p>}
        {!linksQuery.isLoading && !linksQuery.error && !(linksQuery.data?.length) && <p>Nenhuma tarefa foi enviada ao Google Calendar ainda.</p>}
        {(linksQuery.data ?? []).slice(0, 5).map((link) => <article key={link.id}><div><strong>{taskMap.get(link.task_id)?.title ?? 'Tarefa sincronizada'}</strong><small>Atualizado em {formatSyncTime(link.synced_at)}</small></div>{link.html_link && <a href={link.html_link} target="_blank" rel="noreferrer" aria-label="Abrir evento no Google Calendar"><ExternalLink size={15} /></a>}</article>)}
      </div>

      <div className="integration-security"><ShieldCheck size={19} /><div><strong>Token não armazenado</strong><p>A credencial do Google é usada apenas durante a sincronização e não é salva no banco do Meu Ritmo.</p></div></div>
    </section>

    <section className="integration-card pwa-card">
      <div className="integration-card-heading">
        <span className="integration-logo app-logo"><Smartphone size={27} /></span>
        <div><span className="eyebrow">Aplicativo instalável</span><h2>Meu Ritmo no seu dispositivo</h2><p>Abra em uma janela própria e acesse diretamente pela tela inicial.</p></div>
        <span className={`connection-badge ${installPrompt.installed ? 'connected' : 'pending'}`}>{installPrompt.installed ? 'Instalado' : 'Disponível como PWA'}</span>
      </div>
      <div className="pwa-content">
        <img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="Ícone provisório do Meu Ritmo" />
        <div><strong>Ícone provisório</strong><p>A estrutura do aplicativo já está pronta. Depois vamos definir juntos o ícone definitivo e substituir este arquivo sem alterar a instalação.</p><span><LockKeyhole size={14} /> O modo offline protege apenas a abertura do app; dados continuam vindo com segurança do Supabase.</span></div>
        {!installPrompt.installed && <button className="primary-button compact" type="button" onClick={() => void installPrompt.install()} disabled={!installPrompt.canInstall}><Download size={17} /> {installPrompt.canInstall ? 'Instalar aplicativo' : 'Use o menu do navegador para instalar'}</button>}
      </div>
    </section>
  </div>
}
