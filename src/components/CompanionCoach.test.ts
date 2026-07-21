import { describe, expect, it } from 'vitest'
import { getCompanionGuidance } from './companionGuidance'

const base = { completedCount: 0, hasReview: false, hour: 10, overdueCount: 0, taskCount: 3 }

describe('getCompanionGuidance', () => {
  it('prioriza uma sessão de foco ativa', () => {
    const result = getCompanionGuidance({ ...base, activeTaskTitle: 'Preparar apresentação', overdueCount: 2 })
    expect(result.title).toBe('Seu foco está em andamento')
    expect(result.message).toContain('Preparar apresentação')
  })

  it('oferece replanejamento quando existem tarefas vencidas', () => {
    const result = getCompanionGuidance({ ...base, overdueCount: 2 })
    expect(result.showReplanning).toBe(true)
    expect(result.actionLabel).toBe('Organizar pendências')
  })

  it('celebra o plano concluído e conduz para a revisão', () => {
    const result = getCompanionGuidance({ ...base, completedCount: 3 })
    expect(result.mood).toBe(5)
    expect(result.actionPath).toBe('/revisao')
  })

  it('sugere revisão no fim do dia', () => {
    const result = getCompanionGuidance({ ...base, hour: 20 })
    expect(result.actionLabel).toBe('Fazer revisão diária')
  })
})
