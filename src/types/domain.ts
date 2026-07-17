export type TaskStatus = 'backlog' | 'planned' | 'in_progress' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'critical'

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
