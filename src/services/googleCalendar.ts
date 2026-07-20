import { supabase } from '../lib/supabase'
import type { GoogleCalendarLink } from '../types/domain'

export type CalendarSyncFailureCode = 'google_error' | 'rate_limited'

export interface CalendarSyncFailure {
  taskId: string
  code: CalendarSyncFailureCode
}

export interface CalendarSyncItem {
  taskId: string
  eventId: string
  htmlLink: string | null
}

export interface CalendarSyncResult {
  count: number
  synced: CalendarSyncItem[]
  failed: CalendarSyncFailure[]
  requestId?: string
}

export class GoogleCalendarSyncError extends Error {
  readonly code: string

  constructor(
    message: string,
    code: string = 'sync_failed',
  ) {
    super(message)
    this.name = 'GoogleCalendarSyncError'
    this.code = code
  }

  get requiresReauthentication() {
    return this.code === 'reauth_required'
  }
}

function requireClient() {
  if (!supabase) throw new GoogleCalendarSyncError('Supabase não configurado.', 'configuration_error')
  return supabase
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizeCalendarSyncResponse(payload: unknown): CalendarSyncResult {
  if (!isRecord(payload) || typeof payload.count !== 'number' || !Array.isArray(payload.synced)) {
    throw new GoogleCalendarSyncError('O Google Calendar retornou uma resposta inválida.')
  }

  return {
    count: payload.count,
    synced: payload.synced as CalendarSyncItem[],
    failed: Array.isArray(payload.failed) ? payload.failed as CalendarSyncFailure[] : [],
    requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
  }
}

export function formatCalendarSyncSummary(result: CalendarSyncResult) {
  const successText = `${result.count} ${result.count === 1 ? 'tarefa sincronizada' : 'tarefas sincronizadas'}`
  if (!result.failed.length) return `${successText} com sucesso.`

  const retryText = `${result.failed.length} ${result.failed.length === 1 ? 'tarefa precisa' : 'tarefas precisam'} de uma nova tentativa.`
  return `${successText}. ${retryText}`
}

async function readFunctionError(error: unknown) {
  let message = 'Não foi possível sincronizar com o Google Calendar.'
  let code = 'sync_failed'

  if (isRecord(error) && 'context' in error && error.context instanceof Response) {
    const payload = await error.context.clone().json().catch(() => null) as { error?: string; code?: string } | null
    if (payload?.error) message = payload.error
    if (payload?.code) code = payload.code
  }

  return new GoogleCalendarSyncError(message, code)
}

export async function listGoogleCalendarLinks(workspaceId: string, userId: string) {
  const client = requireClient()
  const { data, error } = await client
    .from('google_calendar_links')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .order('synced_at', { ascending: false })

  if (error) throw error
  return data as GoogleCalendarLink[]
}

export async function syncTasksToGoogleCalendar(taskIds: string[], googleAccessToken: string) {
  if (!taskIds.length) throw new GoogleCalendarSyncError('Selecione ao menos uma tarefa para sincronizar.', 'empty_selection')
  if (!googleAccessToken) throw new GoogleCalendarSyncError('Conecte novamente sua conta Google.', 'reauth_required')

  const client = requireClient()
  const { data, error } = await client.functions.invoke('google-calendar-sync', {
    body: { taskIds, googleAccessToken },
  })

  if (error) throw await readFunctionError(error)
  return normalizeCalendarSyncResponse(data)
}
