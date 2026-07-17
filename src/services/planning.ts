import { supabase } from '../lib/supabase'
import type { FocusSession, Priority, Task, WorkspaceMembership } from '../types/domain'

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

function localDateString() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

export async function getDefaultWorkspace() {
  const client = requireClient()
  const { data, error } = await client
    .from('workspace_members')
    .select('workspace_id, workspaces(name)')
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as WorkspaceMembership | null
}

export async function listTodayTasks(workspaceId: string) {
  const today = localDateString()
  const client = requireClient()
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('planned_date', today)
    .neq('status', 'cancelled')
    .order('position')
    .order('created_at')

  if (error) throw error
  return data as Task[]
}

export async function listTasks(workspaceId: string) {
  const client = requireClient()
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .neq('status', 'cancelled')
    .order('planned_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw error
  return data as Task[]
}

export async function createTask(input: {
  workspaceId: string
  title: string
  priority: Priority
  estimatedMinutes: number
  description?: string
  plannedDate?: string | null
}) {
  const client = requireClient()
  const { data, error } = await client
    .from('tasks')
    .insert({
      workspace_id: input.workspaceId,
      title: input.title,
      priority: input.priority,
      estimated_minutes: input.estimatedMinutes,
      description: input.description?.trim() || null,
      planned_date: input.plannedDate === undefined ? localDateString() : input.plannedDate,
      status: 'planned',
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Task
}

export async function updateTask(taskId: string, values: Partial<Pick<Task,
  'title' | 'description' | 'priority' | 'planned_date' | 'estimated_minutes' | 'status' | 'completed_at'
>>) {
  const client = requireClient()
  const { error } = await client.from('tasks').update(values).eq('id', taskId)
  if (error) throw error
}

export async function deleteTask(taskId: string) {
  const client = requireClient()
  const { error } = await client.from('tasks').delete().eq('id', taskId)
  if (error) throw error
}

export async function setTaskCompleted(taskId: string, completed: boolean) {
  const client = requireClient()
  const { error } = await client
    .from('tasks')
    .update({
      status: completed ? 'completed' : 'planned',
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', taskId)

  if (error) throw error
}

export async function getActiveFocusSession(workspaceId: string, userId: string) {
  const client = requireClient()
  const { data, error } = await client
    .from('focus_sessions')
    .select('id, task_id, started_at, ended_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle()

  if (error) throw error
  return data as FocusSession | null
}

export async function startFocusSession(workspaceId: string, taskId: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('start_focus_session', {
    p_workspace_id: workspaceId,
    p_task_id: taskId,
  })
  if (error) throw error
  return data as string
}

export async function stopFocusSession(sessionId: string) {
  const client = requireClient()
  const { error } = await client.rpc('stop_focus_session', { p_session_id: sessionId })
  if (error) throw error
}
