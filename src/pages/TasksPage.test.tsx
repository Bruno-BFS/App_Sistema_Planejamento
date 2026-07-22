import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../types/domain'
import { TasksPage } from './TasksPage'

const planningMocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  createTaskRecurrence: vi.fn(),
  archiveTask: vi.fn(),
  getDefaultWorkspace: vi.fn(),
  listGoals: vi.fn(),
  listProjects: vi.fn(),
  listTasks: vi.fn(),
  listTrashedTasks: vi.fn(),
  permanentlyDeleteTask: vi.fn(),
  restoreTask: vi.fn(),
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
  planned_start_time: '09:00:00',
  estimated_minutes: 45,
  actual_minutes: 0,
  project_id: null,
  goal_id: null,
  completed_at: null,
  recurrence_id: null,
  occurrence_date: null,
  deleted_at: null,
  deleted_previous_status: null,
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
    planningMocks.listTrashedTasks.mockResolvedValue([])
    planningMocks.updateTask.mockResolvedValue(undefined)
    planningMocks.createTaskRecurrence.mockResolvedValue(undefined)
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
    expect(screen.getByLabelText('Horário de início')).toHaveValue('09:00')

    await user.clear(titleInput)
    await user.type(titleInput, 'Tarefa atualizada')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(planningMocks.updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({
      title: 'Tarefa atualizada',
      description: 'Descrição original',
      priority: 'high',
      estimated_minutes: 45,
      planned_date: '2026-07-20',
      planned_start_time: '09:00',
      goal_id: null,
      project_id: null,
    })))
  })

  it('cria uma recorrência semanal com horário e dias escolhidos', async () => {
    const user = userEvent.setup()
    planningMocks.listTasks.mockResolvedValue([])
    renderTasksPage()

    await screen.findByText('Nenhuma tarefa encontrada.')
    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    await user.type(screen.getByLabelText('Título'), 'Treinar inglês')
    await user.click(screen.getByRole('button', { name: 'Semanal' }))
    await user.type(screen.getByLabelText('Horário de início'), '18:30')
    await user.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))

    await waitFor(() => expect(planningMocks.createTaskRecurrence).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Treinar inglês',
      frequency: 'weekly',
      intervalCount: 1,
      plannedStartTime: '18:30',
      weekdays: expect.arrayContaining([new Date().getDay()]),
    })))
    expect(planningMocks.createTask).not.toHaveBeenCalled()
  })

  it('move uma tarefa para a lixeira e permite desfazer', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    planningMocks.archiveTask.mockResolvedValue(undefined)
    planningMocks.restoreTask.mockResolvedValue(undefined)
    renderTasksPage()

    await screen.findByText('Tarefa exemplo')
    await user.click(screen.getByRole('button', { name: 'Excluir Tarefa exemplo' }))

    await waitFor(() => expect(planningMocks.archiveTask).toHaveBeenCalledWith('task-1'))
    await user.click(await screen.findByRole('button', { name: 'Desfazer' }))
    await waitFor(() => expect(planningMocks.restoreTask).toHaveBeenCalledWith('task-1'))
    confirm.mockRestore()
  })

  it('restaura uma tarefa pela lixeira', async () => {
    const user = userEvent.setup()
    planningMocks.listTrashedTasks.mockResolvedValue([{ ...task, status: 'cancelled', deleted_at: '2026-07-22T12:00:00.000Z', deleted_previous_status: 'planned' }])
    planningMocks.restoreTask.mockResolvedValue(undefined)
    renderTasksPage()

    await screen.findByText('Tarefa exemplo')
    await user.click(screen.getByRole('button', { name: 'Lixeira' }))
    await screen.findByRole('heading', { name: 'Lixeira' })
    await user.click(screen.getByRole('button', { name: 'Restaurar' }))

    await waitFor(() => expect(planningMocks.restoreTask).toHaveBeenCalledWith('task-1'))
  })
})
