import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, BarChart3, BatteryMedium, Brain, CheckCircle2, Clock3, Info, Sparkles, Target } from 'lucide-react'
import { getDefaultWorkspace, getPersonalAnalytics } from '../services/planning'
import type { AnalyticsDay } from '../types/domain'

type RangeDays = 7 | 30 | 90

function dateString(date: Date) {
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

function rangeDates(days: number) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days + 1)
  return { start: dateString(start), end: dateString(end) }
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))
}

function weekday(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${value}T12:00:00`))
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  if (!hours) return `${minutes}min`
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function ExecutionChart({ data }: { data: AnalyticsDay[] }) {
  const width = 760
  const height = 230
  const padding = 34
  const innerHeight = height - padding * 2
  const max = Math.max(1, ...data.flatMap((row) => [row.planned_tasks, row.completed_tasks]))
  const slot = (width - padding * 2) / Math.max(1, data.length)
  const barWidth = Math.max(2, Math.min(12, slot * .34))
  const labelIndexes = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])

  return <svg className="analytics-svg" role="img" aria-labelledby="execution-chart-title" viewBox={`0 0 ${width} ${height}`}>
    <title id="execution-chart-title">Tarefas planejadas e concluídas por dia</title>
    {[0, .5, 1].map((ratio) => <line key={ratio} x1={padding} x2={width - padding} y1={padding + innerHeight * ratio} y2={padding + innerHeight * ratio} className="chart-grid-line" />)}
    {data.map((row, index) => {
      const center = padding + slot * index + slot / 2
      const plannedHeight = row.planned_tasks / max * innerHeight
      const completedHeight = row.completed_tasks / max * innerHeight
      return <g key={row.day}>
        <rect x={center - barWidth - 1} y={height - padding - plannedHeight} width={barWidth} height={plannedHeight} rx="2" className="chart-bar planned"><title>{shortDate(row.day)}: {row.planned_tasks} planejadas</title></rect>
        <rect x={center + 1} y={height - padding - completedHeight} width={barWidth} height={completedHeight} rx="2" className="chart-bar completed"><title>{shortDate(row.day)}: {row.completed_tasks} concluídas</title></rect>
        {labelIndexes.has(index) && <text x={center} y={height - 10} textAnchor="middle" className="chart-axis-label">{shortDate(row.day)}</text>}
      </g>
    })}
  </svg>
}

function lineSegments(data: AnalyticsDay[], key: 'mood_score' | 'energy_score', width: number, height: number, padding: number) {
  const slot = (width - padding * 2) / Math.max(1, data.length - 1)
  const segments: Array<Array<{ x: number; y: number; value: number; day: string }>> = []
  let current: Array<{ x: number; y: number; value: number; day: string }> = []
  data.forEach((row, index) => {
    const value = row[key]
    if (value === null) {
      if (current.length) segments.push(current)
      current = []
      return
    }
    current.push({ x: padding + slot * index, y: height - padding - ((value - 1) / 4) * (height - padding * 2), value, day: row.day })
  })
  if (current.length) segments.push(current)
  return segments
}

function WellbeingChart({ data }: { data: AnalyticsDay[] }) {
  const width = 760
  const height = 230
  const padding = 34
  const moodSegments = lineSegments(data, 'mood_score', width, height, padding)
  const energySegments = lineSegments(data, 'energy_score', width, height, padding)
  return <svg className="analytics-svg" role="img" aria-labelledby="wellbeing-chart-title" viewBox={`0 0 ${width} ${height}`}>
    <title id="wellbeing-chart-title">Evolução do humor e da energia registrados</title>
    {[1, 2, 3, 4, 5].map((score) => {
      const y = height - padding - ((score - 1) / 4) * (height - padding * 2)
      return <g key={score}><line x1={padding} x2={width - padding} y1={y} y2={y} className="chart-grid-line" /><text x="18" y={y + 4} className="chart-axis-label">{score}</text></g>
    })}
    {moodSegments.map((segment, index) => <g key={`mood-${index}`}><polyline points={segment.map((point) => `${point.x},${point.y}`).join(' ')} className="chart-line mood" />{segment.map((point) => <circle key={point.day} cx={point.x} cy={point.y} r="4" className="chart-point mood"><title>{shortDate(point.day)}: humor {point.value}/5</title></circle>)}</g>)}
    {energySegments.map((segment, index) => <g key={`energy-${index}`}><polyline points={segment.map((point) => `${point.x},${point.y}`).join(' ')} className="chart-line energy" />{segment.map((point) => <circle key={point.day} cx={point.x} cy={point.y} r="4" className="chart-point energy"><title>{shortDate(point.day)}: energia {point.value}/5</title></circle>)}</g>)}
  </svg>
}

export function AnalyticsPage() {
  const [range, setRange] = useState<RangeDays>(30)
  const dates = useMemo(() => rangeDates(range), [range])
  const workspaceQuery = useQuery({ queryKey: ['workspace'], queryFn: getDefaultWorkspace })
  const workspaceId = workspaceQuery.data?.workspace_id
  const analyticsQuery = useQuery({
    queryKey: ['personal-analytics', workspaceId, dates.start, dates.end],
    queryFn: () => getPersonalAnalytics(workspaceId!, dates.start, dates.end),
    enabled: Boolean(workspaceId),
  })
  const data = useMemo(() => analyticsQuery.data ?? [], [analyticsQuery.data])
  const reviewed = data.filter((row) => row.mood_score !== null && row.energy_score !== null)
  const plannedTasks = data.reduce((sum, row) => sum + row.planned_tasks, 0)
  const completedTasks = data.reduce((sum, row) => sum + row.completed_tasks, 0)
  const focusMinutes = data.reduce((sum, row) => sum + row.focus_minutes, 0)
  const completionRate = plannedTasks ? Math.min(100, Math.round(completedTasks / plannedTasks * 100)) : 0
  const averageMood = average(reviewed.map((row) => row.mood_score!))
  const averageEnergy = average(reviewed.map((row) => row.energy_score!))
  const highEnergy = reviewed.filter((row) => row.energy_score! >= 4)
  const lowEnergy = reviewed.filter((row) => row.energy_score! <= 2)
  const weekdayPerformance = useMemo(() => {
    const groups = new Map<string, number[]>()
    data.forEach((row) => groups.set(weekday(row.day), [...(groups.get(weekday(row.day)) ?? []), row.completed_tasks]))
    return [...groups.entries()].map(([day, values]) => ({ day, value: average(values) })).sort((a, b) => b.value - a.value)
  }, [data])
  const hasActivity = plannedTasks > 0 || completedTasks > 0 || focusMinutes > 0 || reviewed.length > 0
  const energyComparisonReady = highEnergy.length >= 2 && lowEnergy.length >= 2
  const highEnergyCompleted = average(highEnergy.map((row) => row.completed_tasks))
  const lowEnergyCompleted = average(lowEnergy.map((row) => row.completed_tasks))

  if (workspaceQuery.isLoading) return <div className="page-state">Preparando suas análises…</div>
  if (!workspaceId) return <div className="page-state error">Seu workspace ainda não está disponível.</div>

  return <div className="today-page analytics-page">
    <header className="page-header analytics-header">
      <div><span className="eyebrow">Clareza sem julgamento</span><h1>Análises do seu ritmo</h1><p>Observe padrões entre planejamento, execução, foco, humor e energia.</p></div>
      <div className="filter-group" aria-label="Período das análises">{([7, 30, 90] as RangeDays[]).map((days) => <button className={range === days ? 'active' : ''} key={days} type="button" onClick={() => setRange(days)}>{days} dias</button>)}</div>
    </header>

    {analyticsQuery.isLoading && <div className="page-state">Calculando seus indicadores…</div>}
    {analyticsQuery.error && <div className="page-state error">Não foi possível carregar as análises.</div>}
    {!analyticsQuery.isLoading && <>
      <section className="analytics-kpi-grid">
        <article className="analytics-kpi"><span className="stat-icon violet"><CheckCircle2 size={20} /></span><div><small>Taxa de execução</small><strong>{completionRate}%</strong><em>{completedTasks} {completedTasks === 1 ? 'concluída' : 'concluídas'} de {plannedTasks} {plannedTasks === 1 ? 'planejada' : 'planejadas'}</em></div></article>
        <article className="analytics-kpi"><span className="stat-icon amber"><Clock3 size={20} /></span><div><small>Foco registrado</small><strong>{formatMinutes(focusMinutes)}</strong><em>em sessões encerradas</em></div></article>
        <article className="analytics-kpi"><span className="stat-icon coral"><Brain size={20} /></span><div><small>Humor médio</small><strong>{reviewed.length ? averageMood.toFixed(1) : '—'}<b>/5</b></strong><em>{reviewed.length} {reviewed.length === 1 ? 'dia registrado' : 'dias registrados'}</em></div></article>
        <article className="analytics-kpi"><span className="stat-icon violet"><BatteryMedium size={20} /></span><div><small>Energia média</small><strong>{reviewed.length ? averageEnergy.toFixed(1) : '—'}<b>/5</b></strong><em>{Math.round(reviewed.length / range * 100)}% de cobertura</em></div></article>
      </section>

      {!hasActivity ? <section className="analytics-empty"><span><BarChart3 size={30} /></span><h2>Seus padrões aparecerão aqui.</h2><p>Planeje tarefas, encerre sessões de foco e registre algumas revisões diárias para formar uma leitura útil.</p></section> : <>
        <section className="analytics-chart-grid">
          <article className="analytics-chart-card"><div className="chart-card-heading"><div><span className="eyebrow">Execução diária</span><h2>Planejado x concluído</h2></div><div className="chart-legend"><span className="planned">Planejadas</span><span className="completed">Concluídas</span></div></div><ExecutionChart data={data} /></article>
          <article className="analytics-chart-card"><div className="chart-card-heading"><div><span className="eyebrow">Check-in diário</span><h2>Humor e energia</h2></div><div className="chart-legend"><span className="mood">Humor</span><span className="energy">Energia</span></div></div>{reviewed.length ? <WellbeingChart data={data} /> : <div className="chart-no-data"><Activity size={25} /><p>Registre sua primeira Revisão Diária neste período.</p></div>}</article>
        </section>

        <section className="analytics-insights"><div className="insights-heading"><span><Sparkles size={20} /></span><div><span className="eyebrow">Leituras responsáveis</span><h2>O que seus dados sugerem</h2></div></div><div className="insight-grid">
          <article><Target size={19} /><div><strong>Dia com mais entregas</strong><p>{completedTasks >= 3 && weekdayPerformance[0]?.value ? `${weekdayPerformance[0].day} tem média de ${weekdayPerformance[0].value.toFixed(1)} tarefas concluídas.` : 'Ainda não há tarefas concluídas suficientes para comparar os dias.'}</p></div></article>
          <article><BatteryMedium size={19} /><div><strong>Energia e execução</strong><p>{energyComparisonReady ? `Com energia 4–5, a média foi ${highEnergyCompleted.toFixed(1)} tarefas; com energia 1–2, ${lowEnergyCompleted.toFixed(1)}.` : `Registre ao menos 2 dias de energia alta e 2 de energia baixa para uma comparação simples.`}</p></div></article>
          <article><Info size={19} /><div><strong>Qualidade da amostra</strong><p>{reviewed.length >= 7 ? `${reviewed.length} check-ins no período já permitem observar tendências iniciais.` : `Há ${reviewed.length} ${reviewed.length === 1 ? 'check-in' : 'check-ins'}. Com 7 ou mais, os padrões ficam mais úteis.`}</p></div></article>
        </div><p className="analytics-disclaimer"><Info size={14} /> Estes padrões descrevem sua rotina registrada e não representam avaliação médica ou psicológica.</p></section>

        <section className="analytics-table-card"><div><span className="eyebrow">Detalhamento recente</span><h2>Últimos 7 dias</h2></div><div className="analytics-table-wrap"><table><thead><tr><th>Dia</th><th>Planejadas</th><th>Concluídas</th><th>Foco</th><th>Humor</th><th>Energia</th></tr></thead><tbody>{data.slice(-7).reverse().map((row) => <tr key={row.day}><td><strong>{weekday(row.day)}</strong><small>{shortDate(row.day)}</small></td><td>{row.planned_tasks}</td><td>{row.completed_tasks}</td><td>{formatMinutes(row.focus_minutes)}</td><td>{row.mood_score ?? '—'}</td><td>{row.energy_score ?? '—'}</td></tr>)}</tbody></table></div></section>
      </>}
    </>}
  </div>
}
