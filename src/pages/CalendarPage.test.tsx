import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarPage } from './CalendarPage'

const planningMocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  createTaskRecurrence: vi.fn(),
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

  it('permite criar uma repetição a partir do dia selecionado', async () => {
    const user = userEvent.setup()
    planningMocks.createTaskRecurrence.mockResolvedValue({})
    renderCalendarPage()
    await screen.findByRole('heading', { name: 'Agenda' })

    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    await user.type(screen.getByLabelText('Tarefa'), 'Planejar a semana')
    await user.click(screen.getByRole('button', { name: 'Semanal' }))
    await user.click(screen.getByRole('button', { name: 'Criar repetição' }))

    expect(planningMocks.createTaskRecurrence).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      title: 'Planejar a semana',
      frequency: 'weekly',
      startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      weekdays: expect.arrayContaining([expect.any(Number)]),
    }))
    expect(planningMocks.createTask).not.toHaveBeenCalled()
  })
})
