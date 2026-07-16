import type { JobStatus, LogEntry, RunResult, SimulationJob } from '../types'
import { createId } from '../utils/id'

function buildLogs(status: JobStatus, count: number): LogEntry[] {
  const base = Date.now() - count * 4000
  const levels: LogEntry['level'][] = ['info', 'info', 'info', 'debug', 'warn']
  const logs: LogEntry[] = []
  for (let i = 0; i < count; i += 1) {
    const level = i === count - 1 && status === 'failed' ? 'error' : levels[i % levels.length]
    logs.push({
      id: createId('log'),
      timestamp: new Date(base + i * 4000).toISOString(),
      level,
      message:
        level === 'error'
          ? 'Convergencia no alcanzada en el punto de operación DC'
          : level === 'warn'
            ? `Corrida ${i + 1}: paso de tiempo reducido automáticamente`
            : `Corrida ${i + 1} completada en worker-${(i % 4) + 1}`,
    })
  }
  return logs
}

function buildRuns(total: number, completed: number, failed: number, active: number): RunResult[] {
  const runs: RunResult[] = []
  for (let i = 0; i < total; i += 1) {
    let status: RunResult['status'] = 'queued'
    if (i < completed) status = 'completed'
    else if (i < completed + failed) status = 'failed'
    else if (i < completed + failed + active) status = 'running'

    runs.push({
      id: createId('run'),
      runIndex: i + 1,
      parameters: {
        TEMP: `${-40 + (i % 12) * 15}`,
        VDD: ['1.8', '2.5', '3.3', '5'][i % 4],
      },
      status,
      durationSeconds: status === 'completed' || status === 'failed' ? 12 + (i % 9) : null,
      warnings:
        status === 'failed'
          ? ['Convergencia no alcanzada']
          : i % 7 === 0
            ? ['Paso de tiempo reducido']
            : [],
      resultSummary:
        status === 'completed' ? 'OK' : status === 'failed' ? 'Error de convergencia' : null,
    })
  }
  return runs
}

export const mockJobs: SimulationJob[] = [
  {
    id: 'job-inverter-sweep',
    projectId: 'proj-inverter-cload',
    projectName: 'Inversor con carga capacitiva',
    simulationConfigId: 'sim-inverter-1',
    name: 'Barrido CLOAD/RLOAD',
    simulatorId: 'ngspice',
    status: 'running',
    createdAt: '2026-07-15T09:20:00Z',
    startedAt: '2026-07-15T09:22:00Z',
    finishedAt: null,
    totalRuns: 180,
    completedRuns: 97,
    activeRuns: 4,
    failedRuns: 2,
    progressPct: 54,
    cpuPct: 78,
    memoryMb: 3120,
    workerName: 'worker-2',
    elapsedSeconds: 640,
    estimatedRemainingSeconds: 540,
    logs: buildLogs('running', 24),
    runs: buildRuns(180, 97, 2, 4),
  },
  {
    id: 'job-thermal-temp-sweep',
    projectId: 'proj-thermal-osc',
    projectName: 'Oscilador térmico MOSFET',
    simulationConfigId: 'sim-thermal-osc-1',
    name: 'Barrido de temperatura ambiente',
    simulatorId: 'xyce',
    status: 'completed',
    createdAt: '2026-07-14T15:50:00Z',
    startedAt: '2026-07-14T15:52:00Z',
    finishedAt: '2026-07-14T16:40:00Z',
    totalRuns: 36,
    completedRuns: 36,
    activeRuns: 0,
    failedRuns: 0,
    progressPct: 100,
    cpuPct: 0,
    memoryMb: 0,
    workerName: '—',
    elapsedSeconds: 2880,
    estimatedRemainingSeconds: 0,
    logs: buildLogs('completed', 18),
    runs: buildRuns(36, 36, 0, 0),
  },
  {
    id: 'job-cmos-freq-response',
    projectId: 'proj-cmos-amp',
    projectName: 'Amplificador CMOS',
    simulationConfigId: 'sim-cmos-amp-1',
    name: 'Respuesta en frecuencia',
    simulatorId: 'ngspice',
    status: 'completed',
    createdAt: '2026-07-12T09:40:00Z',
    startedAt: '2026-07-12T09:41:00Z',
    finishedAt: '2026-07-12T10:12:00Z',
    totalRuns: 20,
    completedRuns: 20,
    activeRuns: 0,
    failedRuns: 0,
    progressPct: 100,
    cpuPct: 0,
    memoryMb: 0,
    workerName: '—',
    elapsedSeconds: 1860,
    estimatedRemainingSeconds: 0,
    logs: buildLogs('completed', 14),
    runs: buildRuns(20, 20, 0, 0),
  },
  {
    id: 'job-bsim-corners',
    projectId: 'proj-bsim-sweep',
    projectName: 'Barrido de modelo BSIM',
    simulationConfigId: 'sim-bsim-1',
    name: 'Curvas Id-Vgs por esquina',
    simulatorId: 'xyce',
    status: 'failed',
    createdAt: '2026-07-08T16:30:00Z',
    startedAt: '2026-07-08T16:31:00Z',
    finishedAt: '2026-07-08T17:00:00Z',
    totalRuns: 15,
    completedRuns: 11,
    activeRuns: 0,
    failedRuns: 4,
    progressPct: 100,
    cpuPct: 0,
    memoryMb: 0,
    workerName: '—',
    elapsedSeconds: 1740,
    estimatedRemainingSeconds: 0,
    logs: buildLogs('failed', 20),
    runs: buildRuns(15, 11, 4, 0),
  },
  {
    id: 'job-mirror-montecarlo',
    projectId: 'proj-current-mirror-mc',
    projectName: 'Monte Carlo de espejo de corriente',
    simulationConfigId: 'sim-mirror-1',
    name: 'Monte Carlo 500 corridas',
    simulatorId: 'ngspice',
    status: 'cancelled',
    createdAt: '2026-06-18T08:30:00Z',
    startedAt: '2026-06-18T08:32:00Z',
    finishedAt: '2026-06-18T09:00:00Z',
    totalRuns: 500,
    completedRuns: 210,
    activeRuns: 0,
    failedRuns: 3,
    progressPct: 43,
    cpuPct: 0,
    memoryMb: 0,
    workerName: '—',
    elapsedSeconds: 1680,
    estimatedRemainingSeconds: null,
    logs: buildLogs('cancelled', 16),
    runs: buildRuns(500, 210, 3, 0),
  },
  {
    id: 'job-cmos-mismatch-queued',
    projectId: 'proj-cmos-amp',
    projectName: 'Amplificador CMOS',
    simulationConfigId: 'sim-cmos-amp-1',
    name: 'Análisis de mismatch en espejo de polarización',
    simulatorId: 'ngspice',
    status: 'queued',
    createdAt: '2026-07-16T07:10:00Z',
    startedAt: null,
    finishedAt: null,
    totalRuns: 60,
    completedRuns: 0,
    activeRuns: 0,
    failedRuns: 0,
    progressPct: 0,
    cpuPct: 0,
    memoryMb: 0,
    workerName: '—',
    elapsedSeconds: 0,
    estimatedRemainingSeconds: null,
    logs: [],
    runs: buildRuns(60, 0, 0, 0),
  },
  {
    id: 'job-thermal-vdd-queued',
    projectId: 'proj-thermal-osc',
    projectName: 'Oscilador térmico MOSFET',
    simulationConfigId: 'sim-thermal-osc-1',
    name: 'Barrido de VDD y carga',
    simulatorId: 'xyce',
    status: 'queued',
    createdAt: '2026-07-16T07:40:00Z',
    startedAt: null,
    finishedAt: null,
    totalRuns: 24,
    completedRuns: 0,
    activeRuns: 0,
    failedRuns: 0,
    progressPct: 0,
    cpuPct: 0,
    memoryMb: 0,
    workerName: '—',
    elapsedSeconds: 0,
    estimatedRemainingSeconds: null,
    logs: [],
    runs: buildRuns(24, 0, 0, 0),
  },
]
