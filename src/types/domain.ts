export type TaskStatus = 'backlog' | 'planned' | 'in_progress' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type GoalStatus = 'planned' | 'active' | 'at_risk' | 'paused' | 'completed' | 'cancelled'
export type GoalHorizon = 'short' | 'medium' | 'long'
export type GoalProgressMode = 'manual' | 'calculated'
export type ProjectStatus = 'idea' | 'planned' | 'active' | 'blocked' | 'paused' | 'completed' | 'cancelled'
export type CompanionType = 'fox' | 'cat' | 'robot' | 'sprout'
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly'

export interface Task {
  id: string
  workspace_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: Priority
  planned_date: string | null
  estimated_minutes: number
  actual_minutes: number
  project_id: string | null
  goal_id: string | null
  completed_at: string | null
  recurrence_id: string | null
  occurrence_date: string | null
  created_at: string
}

export interface TaskRecurrence {
  id: string
  workspace_id: string
  project_id: string | null
  goal_id: string | null
  created_by: string
  title: string
  description: string | null
  priority: Priority
  estimated_minutes: number
  frequency: RecurrenceFrequency
  interval_count: number
  start_date: string
  end_date: string | null
  next_occurrence: string
  last_generated_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkspaceMembership {
  workspace_id: string
  workspaces: { name: string } | null
}

export interface FocusSession {
  id: string
  task_id: string
  started_at: string
  ended_at: string | null
}

export interface Goal {
  id: string
  workspace_id: string
  title: string
  description: string | null
  status: GoalStatus
  start_date: string | null
  target_date: string | null
  horizon: GoalHorizon
  indicator_name: string | null
  target_value: number | null
  current_value: number
  unit: string | null
  progress: number
  progress_mode: GoalProgressMode
  priority: Priority
  motivation: string | null
  expected_result: string | null
  next_review_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GoalMetric {
  goal_id: string
  open_tasks: number
  completed_tasks: number
  projects_count: number
}

export interface Project {
  id: string
  workspace_id: string
  goal_id: string | null
  title: string
  description: string | null
  area: string | null
  status: ProjectStatus
  priority: Priority
  start_date: string | null
  target_date: string | null
  completed_at: string | null
  expected_result: string | null
  next_action: string | null
  notes: string | null
  last_activity_at: string
  created_at: string
  updated_at: string
}

export interface ProjectMetric {
  project_id: string
  total_tasks: number
  open_tasks: number
  completed_tasks: number
  planned_minutes: number
  actual_minutes: number
  progress: number
}

export interface ProfilePreferences {
  id: string
  name: string
  companion_type: CompanionType
}

export interface DailyReview {
  id: string
  workspace_id: string
  user_id: string
  review_date: string
  wins: string | null
  challenges: string | null
  learnings: string | null
  tomorrow_intention: string | null
  mood_score: number | null
  energy_score: number | null
  created_at: string
  updated_at: string
}

export interface AnalyticsDay {
  day: string
  planned_tasks: number
  completed_tasks: number
  planned_minutes: number
  focus_minutes: number
  mood_score: number | null
  energy_score: number | null
}

export interface WeeklyReview {
  id: string
  workspace_id: string
  user_id: string
  week_start: string
  biggest_win: string | null
  main_challenge: string | null
  key_learning: string | null
  stop_doing: string | null
  start_doing: string | null
  continue_doing: string | null
  next_week_priorities: string[]
  weekly_intention: string | null
  confidence_score: number
  created_at: string
  updated_at: string
}

export type ReminderKind = 'overdue_task' | 'today_task' | 'daily_review' | 'weekly_review'

export interface Reminder {
  reminder_key: string
  kind: ReminderKind
  title: string
  body: string
  action_path: string
  priority: number
  due_date: string | null
}

export interface NotificationPreferences {
  id?: string
  workspace_id: string
  user_id: string
  browser_enabled: boolean
  task_reminders: boolean
  daily_review_reminders: boolean
  weekly_review_reminders: boolean
  daily_digest_time: string
  review_reminder_time: string
  weekly_review_day: number
}

export interface GoogleCalendarLink {
  id: string
  workspace_id: string
  user_id: string
  task_id: string
  calendar_id: string
  google_event_id: string
  html_link: string | null
  synced_at: string
}
