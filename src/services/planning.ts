import { supabase } from '../lib/supabase'
import type {
  AnalyticsDay, CompanionType, DailyReview, FocusSession, Goal, GoalHorizon, GoalMetric, GoalProgressMode, GoalStatus,
  Priority, ProfilePreferences, Project, ProjectMetric, ProjectStatus, Task, WeeklyReview, WorkspaceMembership,
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
  projectId?: string | null
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
      project_id: input.projectId || null,
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

export interface ProjectInput {
  workspaceId: string
  goalId?: string | null
  title: string
  description?: string
  area?: string
  status: ProjectStatus
  priority: Priority
  startDate?: string | null
  targetDate?: string | null
  expectedResult?: string
  nextAction?: string
  notes?: string
}

function projectPayload(input: ProjectInput) {
  return {
    workspace_id: input.workspaceId,
    goal_id: input.goalId || null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    area: input.area?.trim() || null,
    status: input.status,
    priority: input.priority,
    start_date: input.startDate || null,
    target_date: input.targetDate || null,
    expected_result: input.expectedResult?.trim() || null,
    next_action: input.nextAction?.trim() || null,
    notes: input.notes?.trim() || null,
  }
}

export async function listProjects(workspaceId: string) {
  const client = requireClient()
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .neq('status', 'cancelled')
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Project[]
}

export async function listProjectMetrics(workspaceId: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('get_project_metrics', { p_workspace_id: workspaceId })
  if (error) throw error
  const rows = (data ?? []) as Array<Record<keyof ProjectMetric, number | string>>
  return rows.map((metric) => ({
    project_id: String(metric.project_id),
    total_tasks: Number(metric.total_tasks),
    open_tasks: Number(metric.open_tasks),
    completed_tasks: Number(metric.completed_tasks),
    planned_minutes: Number(metric.planned_minutes),
    actual_minutes: Number(metric.actual_minutes),
    progress: Number(metric.progress),
  })) as ProjectMetric[]
}

export async function createProject(input: ProjectInput) {
  const client = requireClient()
  const { data, error } = await client.from('projects').insert(projectPayload(input)).select('*').single()
  if (error) throw error
  return data as Project
}

export async function updateProject(projectId: string, input: ProjectInput) {
  const client = requireClient()
  const { data, error } = await client.from('projects').update(projectPayload(input)).eq('id', projectId).select('*').single()
  if (error) throw error
  return data as Project
}

export async function deleteProject(projectId: string) {
  const client = requireClient()
  const { error } = await client.from('projects').delete().eq('id', projectId)
  if (error) throw error
}

export async function getProfilePreferences(userId: string) {
  const client = requireClient()
  const { data, error } = await client
    .from('profiles')
    .select('id, name, companion_type')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data as ProfilePreferences
}

export async function updateCompanion(userId: string, companion: CompanionType) {
  const client = requireClient()
  const { error } = await client.from('profiles').update({ companion_type: companion }).eq('id', userId)
  if (error) throw error
}

export interface DailyReviewInput {
  workspaceId: string
  userId: string
  reviewDate?: string
  wins?: string
  challenges?: string
  learnings?: string
  tomorrowIntention?: string
  moodScore: number
  energyScore: number
}

export async function getDailyReview(workspaceId: string, userId: string, reviewDate = localDateString()) {
  const client = requireClient()
  const { data, error } = await client
    .from('daily_reviews')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('review_date', reviewDate)
    .maybeSingle()
  if (error) throw error
  return data as DailyReview | null
}

export async function listRecentReviews(workspaceId: string, userId: string, limit = 14) {
  const client = requireClient()
  const { data, error } = await client
    .from('daily_reviews')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .order('review_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as DailyReview[]
}

export async function saveDailyReview(input: DailyReviewInput) {
  const client = requireClient()
  const { data, error } = await client
    .from('daily_reviews')
    .upsert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      review_date: input.reviewDate || localDateString(),
      wins: input.wins?.trim() || null,
      challenges: input.challenges?.trim() || null,
      learnings: input.learnings?.trim() || null,
      tomorrow_intention: input.tomorrowIntention?.trim() || null,
      mood_score: input.moodScore,
      energy_score: input.energyScore,
    }, { onConflict: 'workspace_id,user_id,review_date' })
    .select('*')
    .single()
  if (error) throw error
  return data as DailyReview
}

export async function deleteDailyReview(reviewId: string) {
  const client = requireClient()
  const { error } = await client.from('daily_reviews').delete().eq('id', reviewId)
  if (error) throw error
}

export async function getPersonalAnalytics(workspaceId: string, startDate: string, endDate: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('get_personal_analytics', {
    p_workspace_id: workspaceId,
    p_start_date: startDate,
    p_end_date: endDate,
  })
  if (error) throw error
  const rows = (data ?? []) as Array<AnalyticsDay & Record<string, number | string | null>>
  return rows.map((row) => ({
    day: String(row.day),
    planned_tasks: Number(row.planned_tasks),
    completed_tasks: Number(row.completed_tasks),
    planned_minutes: Number(row.planned_minutes),
    focus_minutes: Number(row.focus_minutes),
    mood_score: row.mood_score === null ? null : Number(row.mood_score),
    energy_score: row.energy_score === null ? null : Number(row.energy_score),
  })) as AnalyticsDay[]
}

export interface WeeklyReviewInput {
  workspaceId: string
  userId: string
  weekStart: string
  biggestWin?: string
  mainChallenge?: string
  keyLearning?: string
  stopDoing?: string
  startDoing?: string
  continueDoing?: string
  priorities: string[]
  weeklyIntention?: string
  confidenceScore: number
}

export async function getWeeklyReview(workspaceId: string, userId: string, weekStart: string) {
  const client = requireClient()
  const { data, error } = await client
    .from('weekly_reviews')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle()
  if (error) throw error
  return data as WeeklyReview | null
}

export async function listRecentWeeklyReviews(workspaceId: string, userId: string, limit = 8) {
  const client = requireClient()
  const { data, error } = await client
    .from('weekly_reviews')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as WeeklyReview[]
}

export async function saveWeeklyReview(input: WeeklyReviewInput) {
  const client = requireClient()
  const priorities = input.priorities.map((item) => item.trim()).filter(Boolean).slice(0, 3)
  const { data, error } = await client
    .from('weekly_reviews')
    .upsert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      week_start: input.weekStart,
      biggest_win: input.biggestWin?.trim() || null,
      main_challenge: input.mainChallenge?.trim() || null,
      key_learning: input.keyLearning?.trim() || null,
      stop_doing: input.stopDoing?.trim() || null,
      start_doing: input.startDoing?.trim() || null,
      continue_doing: input.continueDoing?.trim() || null,
      next_week_priorities: priorities,
      weekly_intention: input.weeklyIntention?.trim() || null,
      confidence_score: input.confidenceScore,
    }, { onConflict: 'workspace_id,user_id,week_start' })
    .select('*')
    .single()
  if (error) throw error
  return data as WeeklyReview
}

export async function deleteWeeklyReview(reviewId: string) {
  const client = requireClient()
  const { error } = await client.from('weekly_reviews').delete().eq('id', reviewId)
  if (error) throw error
}
