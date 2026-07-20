import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CalendarTask {
  id: string
  workspace_id: string
  title: string
  description: string | null
  status: string
  priority: string
  planned_date: string | null
  planned_start_time: string | null
  estimated_minutes: number
}

interface CalendarLink {
  task_id: string
  calendar_id: string
  google_event_id: string
}

interface CalendarSyncFailure {
  taskId: string
  code: 'google_error' | 'rate_limited'
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function eventPayload(task: CalendarTask, timeZone: string) {
  const completed = task.status === 'completed'
  const details = [
    task.description,
    `Prioridade: ${task.priority}`,
    `Estimativa: ${task.estimated_minutes} min`,
    'Sincronizado pelo Meu Ritmo.',
  ].filter(Boolean).join('\n\n')

  const base = {
    summary: `${completed ? '✓ ' : ''}${task.title}`,
    description: details,
    transparency: completed ? 'transparent' : 'opaque',
    extendedProperties: { private: { meuRitmoTaskId: task.id } },
  }
  if (!task.planned_start_time) {
    return { ...base, start: { date: task.planned_date }, end: { date: nextDate(task.planned_date!) } }
  }

  const [hours, minutes] = task.planned_start_time.slice(0, 5).split(':').map(Number)
  const endTotal = hours * 60 + minutes + task.estimated_minutes
  const endDate = new Date(`${task.planned_date}T12:00:00Z`)
  endDate.setUTCDate(endDate.getUTCDate() + Math.floor(endTotal / 1440))
  const endTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}:00`
  return {
    ...base,
    start: { dateTime: `${task.planned_date}T${task.planned_start_time.slice(0, 5)}:00`, timeZone },
    end: { dateTime: `${endDate.toISOString().slice(0, 10)}T${endTime}`, timeZone },
  }
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get('Retry-After'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 5000)
  return 400 * (2 ** attempt)
}

async function googleRequest(accessToken: string, url: string, method: 'POST' | 'PUT', body: unknown) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)

    try {
      const googleResponse = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (googleResponse.status === 401 || googleResponse.status === 403) {
        return { kind: 'reauth' as const, status: googleResponse.status }
      }
      if (googleResponse.status === 404 && method === 'PUT') return { kind: 'missing' as const }
      if (googleResponse.ok) {
        return { kind: 'success' as const, event: await googleResponse.json() as { id: string; htmlLink?: string } }
      }

      const retryable = googleResponse.status === 429 || googleResponse.status >= 500
      if (!retryable || attempt === 2) {
        return { kind: 'failed' as const, status: googleResponse.status }
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay(googleResponse, attempt)))
    } catch (error) {
      if (attempt === 2) return { kind: 'failed' as const, status: 503 }
      await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)))
      if (!(error instanceof Error)) break
    } finally {
      clearTimeout(timeout)
    }
  }

  return { kind: 'failed' as const, status: 503 }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Método não permitido.' }, 405)

  const requestId = crypto.randomUUID()
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return response({ error: 'Sessão ausente.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return response({ error: 'Função sem configuração interna.' }, 500)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return response({ error: 'Sessão inválida.' }, 401)
    const { data: profile } = await userClient.from('profiles').select('timezone').eq('id', userData.user.id).maybeSingle()
    const userTimeZone = typeof profile?.timezone === 'string' && profile.timezone ? profile.timezone : 'America/Sao_Paulo'

    const body = await request.json().catch(() => null) as { googleAccessToken?: string; taskIds?: string[] } | null
    if (!body) return response({ error: 'Corpo da requisição inválido.' }, 400)
    const taskIds = [...new Set(body.taskIds ?? [])]
    if (!body.googleAccessToken || body.googleAccessToken.length > 4096) return response({ error: 'Conecte novamente sua conta Google.', code: 'reauth_required' }, 401)
    if (!taskIds.length || taskIds.length > 25) return response({ error: 'Envie entre 1 e 25 tarefas por sincronização.' }, 400)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (taskIds.some((taskId) => !uuidPattern.test(taskId))) return response({ error: 'Identificador de tarefa inválido.' }, 400)

    const { data: taskRows, error: taskError } = await userClient
      .from('tasks')
      .select('id, workspace_id, title, description, status, priority, planned_date, planned_start_time, estimated_minutes')
      .in('id', taskIds)
      .neq('status', 'cancelled')
    if (taskError) throw taskError
    const tasks = (taskRows ?? []) as CalendarTask[]
    if (tasks.length !== taskIds.length) return response({ error: 'Uma ou mais tarefas não estão disponíveis.' }, 403)
    if (tasks.some((task) => !task.planned_date)) return response({ error: 'Todas as tarefas precisam ter uma data planejada.' }, 400)

    const { data: linkRows, error: linkError } = await serviceClient
      .from('google_calendar_links')
      .select('task_id, calendar_id, google_event_id')
      .eq('user_id', userData.user.id)
      .in('task_id', taskIds)
    if (linkError) throw linkError
    const links = new Map(((linkRows ?? []) as CalendarLink[]).map((link) => [link.task_id, link]))
    const synced: Array<{ taskId: string; eventId: string; htmlLink: string | null }> = []
    const failed: CalendarSyncFailure[] = []

    for (const task of tasks) {
      const existing = links.get(task.id)
      const calendarId = existing?.calendar_id ?? 'primary'
      const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
      let result = existing
        ? await googleRequest(body.googleAccessToken, `${baseUrl}/${encodeURIComponent(existing.google_event_id)}`, 'PUT', eventPayload(task, userTimeZone))
        : await googleRequest(body.googleAccessToken, baseUrl, 'POST', eventPayload(task, userTimeZone))

      if (result.kind === 'missing') result = await googleRequest(body.googleAccessToken, baseUrl, 'POST', eventPayload(task, userTimeZone))
      if (result.kind === 'reauth') return response({ error: 'A permissão do Google expirou ou não inclui o Calendar.', code: 'reauth_required' }, 401)
      if (result.kind === 'failed') {
        failed.push({ taskId: task.id, code: result.status === 429 ? 'rate_limited' : 'google_error' })
        continue
      }

      const { error: saveError } = await serviceClient.from('google_calendar_links').upsert({
        workspace_id: task.workspace_id,
        user_id: userData.user.id,
        task_id: task.id,
        calendar_id: calendarId,
        google_event_id: result.event.id,
        html_link: result.event.htmlLink ?? null,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,task_id' })
      if (saveError) throw saveError
      synced.push({ taskId: task.id, eventId: result.event.id, htmlLink: result.event.htmlLink ?? null })
    }

    if (failed.length) {
      console.warn(JSON.stringify({ event: 'google_calendar_partial_sync', requestId, synced: synced.length, failed: failed.length }))
    }
    return response({ synced, count: synced.length, failed, requestId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada.'
    console.error(JSON.stringify({ event: 'google_calendar_sync_failed', requestId, message }))
    return response({ error: 'Não foi possível sincronizar com o Google Calendar.', requestId }, 500)
  }
})
