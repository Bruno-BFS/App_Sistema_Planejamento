import { describe, expect, it } from 'vitest'
import { formatCalendarSyncSummary, GoogleCalendarSyncError, normalizeCalendarSyncResponse } from './googleCalendar'

describe('normalizeCalendarSyncResponse', () => {
  it('mantém compatibilidade com respostas anteriores sem falhas parciais', () => {
    expect(normalizeCalendarSyncResponse({ count: 1, synced: [{ taskId: '1', eventId: '2', htmlLink: null }] })).toEqual({
      count: 1,
      synced: [{ taskId: '1', eventId: '2', htmlLink: null }],
      failed: [],
      requestId: undefined,
    })
  })

  it('preserva falhas recuperáveis e o identificador da operação', () => {
    const result = normalizeCalendarSyncResponse({
      count: 1,
      synced: [],
      failed: [{ taskId: '1', code: 'rate_limited' }],
      requestId: 'request-1',
    })

    expect(result.failed).toEqual([{ taskId: '1', code: 'rate_limited' }])
    expect(result.requestId).toBe('request-1')
  })

  it('rejeita respostas inesperadas', () => {
    expect(() => normalizeCalendarSyncResponse({ synced: [] })).toThrow(GoogleCalendarSyncError)
  })
})

describe('formatCalendarSyncSummary', () => {
  it('informa sincronização completa', () => {
    expect(formatCalendarSyncSummary({ count: 2, synced: [], failed: [] })).toBe('2 tarefas sincronizadas com sucesso.')
  })

  it('informa sucesso parcial sem esconder tarefas pendentes', () => {
    expect(formatCalendarSyncSummary({
      count: 1,
      synced: [],
      failed: [{ taskId: '2', code: 'rate_limited' }],
    })).toBe('1 tarefa sincronizada. 1 tarefa precisa de uma nova tentativa.')
  })
})
