import { supabase } from '../lib/supabase'
import type {
  FocusSession, Goal, GoalHorizon, GoalMetric, GoalProgressMode, GoalStatus,
  Priority, Task, WorkspaceMembership,
} from '../types/domain'

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
  goalId?: string | null
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
      goal_id: input.goalId || null,
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

export interface GoalInput {
  workspaceId: string
  title: string
  description?: string
  status: GoalStatus
  startDate?: string | null
  targetDate?: string | null
  horizon: GoalHorizon
  indicatorName?: string
  targetValue?: number | null
  currentValue: number
  unit?: string
  progress: number
  progressMode: GoalProgressMode
  priority: Priority
  motivation?: string
  expectedResult?: string
  nextReviewDate?: string | null
  notes?: string
}

function goalPayload(input: GoalInput) {
  return {
    workspace_id: input.workspaceId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: input.status,
    start_date: input.startDate || null,
    target_date: input.targetDate || null,
    horizon: input.horizon,
    indicator_name: input.indicatorName?.trim() || null,
    target_value: input.progressMode === 'calculated' ? input.targetValue : null,
    current_value: input.progressMode === 'calculated' ? input.currentValue : 0,
    unit: input.unit?.trim() || null,
    progress: input.progress,
    progress_mode: input.progressMode,
    priority: input.priority,
    motivation: input.motivation?.trim() || null,
    expected_result: input.expectedResult?.trim() || null,
    next_review_date: input.nextReviewDate || null,
    notes: input.notes?.trim() || null,
  }
}

export async function listGoals(workspaceId: string) {
  const client = requireClient()
  const { data, error } = await client
    .from('goals')
    .select('*')
    .eq('workspace_id', workspaceId)
    .neq('status', 'cancelled')
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Goal[]
}

export async function listGoalMetrics(workspaceId: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('get_goal_metrics', { p_workspace_id: workspaceId })
  if (error) throw error
  const rows = (data ?? []) as Array<GoalMetric & {
    open_tasks: number | string
    completed_tasks: number | string
    projects_count: number | string
  }>
  return rows.map((metric) => ({
    ...metric,
    open_tasks: Number(metric.open_tasks),
    completed_tasks: Number(metric.completed_tasks),
    projects_count: Number(metric.projects_count),
  })) as GoalMetric[]
}

export async function createGoal(input: GoalInput) {
  const client = requireClient()
  const { data, error } = await client.from('goals').insert(goalPayload(input)).select('*').single()
  if (error) throw error
  return data as Goal
}

export async function updateGoal(goalId: string, input: GoalInput) {
  const client = requireClient()
  const { data, error } = await client
    .from('goals')
    .update(goalPayload(input))
    .eq('id', goalId)
    .select('*')
    .single()
  if (error) throw error
  return data as Goal
}

export async function deleteGoal(goalId: string) {
  const client = requireClient()
  const { error } = await client.from('goals').delete().eq('id', goalId)
  if (error) throw error
}
