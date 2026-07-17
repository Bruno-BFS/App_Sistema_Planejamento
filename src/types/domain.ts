export type TaskStatus = 'backlog' | 'planned' | 'in_progress' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type GoalStatus = 'planned' | 'active' | 'at_risk' | 'paused' | 'completed' | 'cancelled'
export type GoalHorizon = 'short' | 'medium' | 'long'
export type GoalProgressMode = 'manual' | 'calculated'

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
  created_at: string
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
