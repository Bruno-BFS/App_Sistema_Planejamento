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
  estimated_minutes: number
}

interface CalendarLink {
  task_id: string
  calendar_id: string
  google_event_id: string
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

function eventPayload(task: CalendarTask) {
  const completed = task.status === 'completed'
  const details = [
    task.description,
    `Prioridade: ${task.priority}`,
    `Estimativa: ${task.estimated_minutes} min`,
    'Sincronizado pelo Meu Ritmo.',
  ].filter(Boolean).join('\n\n')

  return {
    summary: `${completed ? '✓ ' : ''}${task.title}`,
    description: details,
    start: { date: task.planned_date },
    end: { date: nextDate(task.planned_date!) },
    transparency: completed ? 'transparent' : 'opaque',
    extendedProperties: { private: { meuRitmoTaskId: task.id } },
  }
}

async function googleRequest(accessToken: string, url: string, method: 'POST' | 'PUT', body: unknown) {
  const googleResponse = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (googleResponse.status === 401 || googleResponse.status === 403) {
    return { kind: 'reauth' as const, status: googleResponse.status }
  }
  if (googleResponse.status === 404 && method === 'PUT') return { kind: 'missing' as const }
  if (!googleResponse.ok) {
    const errorText = (await googleResponse.text()).slice(0, 500)
    throw new Error(`Google Calendar respondeu ${googleResponse.status}: ${errorText}`)
  }
  return { kind: 'success' as const, event: await googleResponse.json() as { id: string; htmlLink?: string } }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Método não permitido.' }, 405)

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

    const body = await request.json() as { googleAccessToken?: string; taskIds?: string[] }
    const taskIds = [...new Set(body.taskIds ?? [])]
    if (!body.googleAccessToken) return response({ error: 'Conecte novamente sua conta Google.', code: 'reauth_required' }, 401)
    if (!taskIds.length || taskIds.length > 25) return response({ error: 'Envie entre 1 e 25 tarefas por sincronização.' }, 400)

    const { data: taskRows, error: taskError } = await userClient
      .from('tasks')
      .select('id, workspace_id, title, description, status, priority, planned_date, estimated_minutes')
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

    for (const task of tasks) {
      const existing = links.get(task.id)
      const calendarId = existing?.calendar_id ?? 'primary'
      const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
      let result = existing
        ? await googleRequest(body.googleAccessToken, `${baseUrl}/${encodeURIComponent(existing.google_event_id)}`, 'PUT', eventPayload(task))
        : await googleRequest(body.googleAccessToken, baseUrl, 'POST', eventPayload(task))

      if (result.kind === 'missing') result = await googleRequest(body.googleAccessToken, baseUrl, 'POST', eventPayload(task))
      if (result.kind === 'reauth') return response({ error: 'A permissão do Google expirou ou não inclui o Calendar.', code: 'reauth_required' }, 401)
      if (result.kind !== 'success') throw new Error('Resposta inesperada do Google Calendar.')

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

    return response({ synced, count: synced.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada.'
    console.error('google-calendar-sync failed', message)
    return response({ error: 'Não foi possível sincronizar com o Google Calendar.' }, 500)
  }
})
