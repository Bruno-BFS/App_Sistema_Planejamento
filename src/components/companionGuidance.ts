export interface CompanionSnapshot {
  activeTaskTitle?: string
  completedCount: number
  hasReview: boolean
  hour: number
  overdueCount: number
  taskCount: number
}

export interface CompanionGuidance {
  actionLabel: string
  actionPath: string
  message: string
  mood: number
  showReplanning: boolean
  title: string
}

export function getCompanionGuidance(snapshot: CompanionSnapshot): CompanionGuidance {
  if (snapshot.activeTaskTitle) return {
    actionLabel: 'Acompanhar foco', actionPath: '/', mood: 4, showReplanning: false,
    title: 'Seu foco está em andamento',
    message: `Continue em “${snapshot.activeTaskTitle}”. Eu cuido para você não perder o fio do dia.`,
  }
  if (snapshot.overdueCount > 0) return {
    actionLabel: 'Organizar pendências', actionPath: '/', mood: 2, showReplanning: true,
    title: `${snapshot.overdueCount} ${snapshot.overdueCount === 1 ? 'pendência precisa' : 'pendências precisam'} de uma decisão`,
    message: 'Nada de culpa: escolha o que cabe hoje e mova o restante para amanhã.',
  }
  if (snapshot.taskCount === 0) return {
    actionLabel: 'Planejar meu dia', actionPath: '/', mood: 3, showReplanning: false,
    title: 'Seu dia ainda está em branco',
    message: 'Vamos começar com poucas tarefas e tempo realista para cada uma.',
  }
  if (snapshot.completedCount === snapshot.taskCount) return {
    actionLabel: snapshot.hasReview ? 'Ver meu progresso' : 'Encerrar o dia',
    actionPath: snapshot.hasReview ? '/analises' : '/revisao', mood: 5, showReplanning: false,
    title: 'Você concluiu o plano de hoje',
    message: snapshot.hasReview ? 'Tudo registrado. Aproveite para reconhecer o seu avanço.' : 'Boa! Registre como foi o dia enquanto ainda está fresco.',
  }
  if (!snapshot.hasReview && snapshot.hour >= 18) return {
    actionLabel: 'Fazer revisão diária', actionPath: '/revisao', mood: 3, showReplanning: false,
    title: 'Que tal fechar o dia com clareza?',
    message: 'Uma revisão curta ajuda a aprender com hoje e aliviar a cabeça para amanhã.',
  }
  const remaining = snapshot.taskCount - snapshot.completedCount
  return {
    actionLabel: 'Ver tarefas de hoje', actionPath: '/', mood: snapshot.completedCount > 0 ? 4 : 3, showReplanning: false,
    title: `${remaining} ${remaining === 1 ? 'passo restante' : 'passos restantes'} hoje`,
    message: snapshot.completedCount > 0 ? 'Você já avançou. Escolha agora a próxima ação mais importante.' : 'Comece pela tarefa que mais alivia ou mais aproxima do seu objetivo.',
  }
}
