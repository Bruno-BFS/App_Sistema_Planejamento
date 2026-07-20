import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarPage } from './CalendarPage'

const planningMocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  getDefaultWorkspace: vi.fn(),
  listCalendarTasks: vi.fn(),
  listUnscheduledTasks: vi.fn(),
  setTaskCompleted: vi.fn(),
  updateTask: vi.fn(),
}))

vi.mock('../services/planning', () => planningMocks)

function renderCalendarPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><CalendarPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planningMocks.getDefaultWorkspace.mockResolvedValue({ workspace_id: 'workspace-1', workspaces: { name: 'Pessoal' } })
    planningMocks.listCalendarTasks.mockResolvedValue([])
    planningMocks.listUnscheduledTasks.mockResolvedValue([])
  })

  it('mostra o calendário antes do cronograma diário', async () => {
    const { container } = renderCalendarPage()
    await screen.findByRole('heading', { name: 'Agenda' })

    const calendar = container.querySelector('.calendar-shell')
    const schedule = container.querySelector('.day-planner')
    expect(calendar).not.toBeNull()
    expect(schedule).not.toBeNull()
    expect(calendar!.compareDocumentPosition(schedule!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Cronograma do dia')).toBeInTheDocument()
  })
})
