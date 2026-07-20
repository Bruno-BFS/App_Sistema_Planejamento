import { describe, expect, it } from 'vitest'
import { calculateOccupiedMinutes, hasScheduleConflict, minutesToTime, timeToMinutes } from './schedule'

describe('schedule', () => {
  it('converte horários sem depender do fuso do navegador', () => {
    expect(timeToMinutes('09:30:00')).toBe(570)
    expect(minutesToTime(570)).toBe('09:30')
  })

  it('não conta duas vezes intervalos sobrepostos', () => {
    const tasks = [
      { planned_start_time: '09:00', estimated_minutes: 60, status: 'planned' as const },
      { planned_start_time: '09:30', estimated_minutes: 60, status: 'planned' as const },
    ]
    expect(calculateOccupiedMinutes(tasks)).toBe(90)
  })

  it('detecta conflitos e ignora a própria tarefa', () => {
    const task = { id: 'a', planned_start_time: '10:00', estimated_minutes: 60 }
    const tasks = [
      { ...task, status: 'planned' as const },
      { id: 'b', planned_start_time: '10:30', estimated_minutes: 30, status: 'planned' as const },
    ]
    expect(hasScheduleConflict(task, tasks)).toBe(true)
  })
})
