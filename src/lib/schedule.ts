import type { Task } from '../types/domain'

export const DEFAULT_DAY_START_MINUTES = 7 * 60
export const DEFAULT_DAY_END_MINUTES = 22 * 60

export function timeToMinutes(value: string | null | undefined) {
  if (!value) return null
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

export function minutesToTime(value: number) {
  const normalized = Math.max(0, Math.min(1439, Math.round(value)))
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

export function formatMinutes(value: number) {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  if (!hours) return `${minutes}min`
  if (!minutes) return `${hours}h`
  return `${hours}h ${minutes}min`
}

export function taskTimeRange(task: Pick<Task, 'planned_start_time' | 'estimated_minutes'>) {
  const start = timeToMinutes(task.planned_start_time)
  if (start === null) return null
  return { start, end: Math.min(24 * 60, start + task.estimated_minutes) }
}

export function calculateOccupiedMinutes(
  tasks: Array<Pick<Task, 'planned_start_time' | 'estimated_minutes' | 'status'>>,
  dayStart = DEFAULT_DAY_START_MINUTES,
  dayEnd = DEFAULT_DAY_END_MINUTES,
) {
  const ranges = tasks
    .filter((task) => task.status !== 'cancelled')
    .map(taskTimeRange)
    .filter((range): range is { start: number; end: number } => Boolean(range))
    .map((range) => ({ start: Math.max(dayStart, range.start), end: Math.min(dayEnd, range.end) }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start)

  let occupied = 0
  let currentStart = -1
  let currentEnd = -1
  for (const range of ranges) {
    if (range.start > currentEnd) {
      if (currentEnd > currentStart) occupied += currentEnd - currentStart
      currentStart = range.start
      currentEnd = range.end
    } else {
      currentEnd = Math.max(currentEnd, range.end)
    }
  }
  if (currentEnd > currentStart) occupied += currentEnd - currentStart
  return occupied
}

export function hasScheduleConflict(
  task: Pick<Task, 'id' | 'planned_start_time' | 'estimated_minutes'>,
  tasks: Array<Pick<Task, 'id' | 'planned_start_time' | 'estimated_minutes' | 'status'>>,
) {
  const range = taskTimeRange(task)
  if (!range) return false
  return tasks.some((other) => {
    if (other.id === task.id || other.status === 'cancelled') return false
    const otherRange = taskTimeRange(other)
    return Boolean(otherRange && range.start < otherRange.end && range.end > otherRange.start)
  })
}
