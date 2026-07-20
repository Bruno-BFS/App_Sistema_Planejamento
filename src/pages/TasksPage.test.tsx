import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../types/domain'
import { TasksPage } from './TasksPage'

const planningMocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  getDefaultWorkspace: vi.fn(),
  listGoals: vi.fn(),
  listProjects: vi.fn(),
  listTasks: vi.fn(),
  setTaskCompleted: vi.fn(),
  updateTask: vi.fn(),
}))

vi.mock('../services/planning', () => planningMocks)

const task: Task = {
  id: 'task-1',
  workspace_id: 'workspace-1',
  title: 'Tarefa exemplo',
  description: 'Descrição original',
  status: 'planned',
  priority: 'high',
  planned_date: '2026-07-20',
  estimated_minutes: 45,
  actual_minutes: 0,
  project_id: null,
  goal_id: null,
  completed_at: null,
  recurrence_id: null,
  occurrence_date: null,
  created_at: '2026-07-20T12:00:00.000Z',
}

function renderTasksPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><TasksPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planningMocks.getDefaultWorkspace.mockResolvedValue({ workspace_id: 'workspace-1', workspaces: { name: 'Pessoal' } })
    planningMocks.listTasks.mockResolvedValue([task])
    planningMocks.listGoals.mockResolvedValue([])
    planningMocks.listProjects.mockResolvedValue([])
    planningMocks.updateTask.mockResolvedValue(undefined)
  })

  it('abre a tarefa preenchida e salva as alterações', async () => {
    const user = userEvent.setup()
    renderTasksPage()

    await screen.findByText('Tarefa exemplo')
    await user.click(screen.getByRole('button', { name: 'Editar Tarefa exemplo' }))

    const titleInput = screen.getByLabelText('Título')
    expect(titleInput).toHaveValue('Tarefa exemplo')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Descrição original')
    expect(screen.getByLabelText('Prioridade')).toHaveValue('high')
    expect(screen.getByLabelText('Estimativa (min)')).toHaveValue(45)

    await user.clear(titleInput)
    await user.type(titleInput, 'Tarefa atualizada')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(planningMocks.updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({
      title: 'Tarefa atualizada',
      description: 'Descrição original',
      priority: 'high',
      estimated_minutes: 45,
      planned_date: '2026-07-20',
      goal_id: null,
      project_id: null,
    })))
  })
})
