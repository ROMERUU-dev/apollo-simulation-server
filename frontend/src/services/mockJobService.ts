import { mockJobs } from '../mocks/jobs'
import type { LogEntry, RunResult, SimulationConfig, SimulationJob } from '../types'
import { createId } from '../utils/id'
import { delay } from '../utils/delay'
import { computeSweepSummary } from '../utils/parameterSweep'
import type { JobService } from './types'

let jobs: SimulationJob[] = mockJobs.map((j) => ({ ...j, logs: [...j.logs], runs: [...j.runs] }))
const listeners = new Set<() => void>()
let tickerId: ReturnType<typeof window.setInterval> | null = null

function notify() {
  listeners.forEach((listener) => listener())
}

function pushLog(job: SimulationJob, level: LogEntry['level'], message: string) {
  job.logs = [
    ...job.logs,
    { id: createId('log'), timestamp: new Date().toISOString(), level, message },
  ]
}

function hasRunningJobs() {
  return jobs.some((j) => j.status === 'running')
}

function tick() {
  let changed = false
  jobs = jobs.map((job) => {
    if (job.status !== 'running') return job
    changed = true
    const next: SimulationJob = { ...job }
    next.elapsedSeconds += 1.2
    const remainingRuns = next.totalRuns - next.completedRuns - next.failedRuns
    const advance = Math.min(remainingRuns, Math.max(1, Math.round(next.totalRuns * 0.015)))
    next.completedRuns += advance
    next.activeRuns = Math.min(4, next.totalRuns - next.completedRuns - next.failedRuns)
    next.cpuPct = Math.min(97, Math.max(35, next.cpuPct + (Math.random() * 10 - 5)))
    next.memoryMb = Math.max(512, next.memoryMb + Math.round(Math.random() * 60 - 30))
    next.progressPct = Math.min(
      100,
      Math.round(((next.completedRuns + next.failedRuns) / next.totalRuns) * 100),
    )
    next.estimatedRemainingSeconds =
      next.completedRuns > 0
        ? Math.round(
            (next.elapsedSeconds / next.completedRuns) * (next.totalRuns - next.completedRuns),
          )
        : null
    if (Math.random() < 0.12) {
      pushLog(next, 'info', `Corrida ${next.completedRuns} completada en ${next.workerName}`)
    }
    if (next.completedRuns + next.failedRuns >= next.totalRuns) {
      next.status = 'completed'
      next.progressPct = 100
      next.activeRuns = 0
      next.cpuPct = 0
      next.finishedAt = new Date().toISOString()
      next.estimatedRemainingSeconds = 0
      pushLog(next, 'info', 'Simulación completada')
    }
    return next
  })
  if (changed) notify()
  if (!hasRunningJobs()) stopTicker()
}

function startTicker() {
  if (tickerId !== null || typeof document === 'undefined' || document.hidden) return
  tickerId = setInterval(tick, 1200)
}

function stopTicker() {
  if (tickerId !== null) {
    clearInterval(tickerId)
    tickerId = null
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopTicker()
    else if (hasRunningJobs()) startTicker()
  })
}

function buildQueuedRuns(total: number): RunResult[] {
  return Array.from({ length: total }, (_, i) => ({
    id: createId('run'),
    runIndex: i + 1,
    parameters: {},
    status: 'queued',
    durationSeconds: null,
    warnings: [],
    resultSummary: null,
  }))
}

class MockJobService implements JobService {
  async list(): Promise<SimulationJob[]> {
    await delay(150)
    return jobs
  }

  async get(jobId: string): Promise<SimulationJob | null> {
    await delay(100)
    return jobs.find((j) => j.id === jobId) ?? null
  }

  async createFromConfig(config: SimulationConfig, projectName: string): Promise<SimulationJob> {
    await delay(300)
    const { totalCombinations } = computeSweepSummary(config.parameters)
    const totalRuns = Math.max(1, totalCombinations)
    const now = new Date().toISOString()
    const job: SimulationJob = {
      id: createId('job'),
      projectId: config.projectId,
      projectName,
      simulationConfigId: config.id,
      name: config.name,
      simulatorId: config.simulatorId,
      status: 'queued',
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      totalRuns,
      completedRuns: 0,
      activeRuns: 0,
      failedRuns: 0,
      progressPct: 0,
      cpuPct: 0,
      memoryMb: 0,
      workerName: '—',
      elapsedSeconds: 0,
      estimatedRemainingSeconds: null,
      logs: [{ id: createId('log'), timestamp: now, level: 'info', message: 'Trabajo encolado' }],
      runs: buildQueuedRuns(totalRuns),
    }
    jobs = [job, ...jobs]
    notify()
    setTimeout(() => {
      jobs = jobs.map((j) =>
        j.id === job.id
          ? {
              ...j,
              status: 'running',
              startedAt: new Date().toISOString(),
              workerName: 'worker-1',
              cpuPct: 40,
              memoryMb: 800,
              activeRuns: Math.min(4, j.totalRuns),
              logs: [
                ...j.logs,
                {
                  id: createId('log'),
                  timestamp: new Date().toISOString(),
                  level: 'info',
                  message: 'Simulación iniciada',
                },
              ],
            }
          : j,
      )
      notify()
      startTicker()
    }, 1400)
    return job
  }

  async cancel(jobId: string): Promise<SimulationJob> {
    await delay(150)
    return this.transition(jobId, (job) => {
      job.status = 'cancelled'
      job.finishedAt = new Date().toISOString()
      job.cpuPct = 0
      job.activeRuns = 0
      pushLog(job, 'warn', 'Trabajo cancelado por el usuario')
    })
  }

  async retry(jobId: string): Promise<SimulationJob> {
    await delay(200)
    const result = this.transition(jobId, (job) => {
      job.status = 'running'
      job.failedRuns = 0
      job.finishedAt = null
      job.workerName = job.workerName === '—' ? 'worker-1' : job.workerName
      pushLog(job, 'info', 'Reintentando corridas fallidas')
    })
    startTicker()
    return result
  }

  async duplicate(jobId: string): Promise<SimulationJob> {
    await delay(200)
    const source = jobs.find((j) => j.id === jobId)
    if (!source) throw new Error(`Trabajo no encontrado: ${jobId}`)
    const now = new Date().toISOString()
    const copy: SimulationJob = {
      ...source,
      id: createId('job'),
      status: 'queued',
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      completedRuns: 0,
      activeRuns: 0,
      failedRuns: 0,
      progressPct: 0,
      cpuPct: 0,
      memoryMb: 0,
      workerName: '—',
      elapsedSeconds: 0,
      estimatedRemainingSeconds: null,
      logs: [
        {
          id: createId('log'),
          timestamp: now,
          level: 'info',
          message: 'Trabajo duplicado y encolado',
        },
      ],
      runs: buildQueuedRuns(source.totalRuns),
    }
    jobs = [copy, ...jobs]
    notify()
    return copy
  }

  async remove(jobId: string): Promise<void> {
    await delay(150)
    jobs = jobs.filter((j) => j.id !== jobId)
    notify()
  }

  async simulateCompletion(jobId: string): Promise<SimulationJob> {
    await delay(150)
    return this.transition(jobId, (job) => {
      job.status = 'completed'
      job.completedRuns = job.totalRuns - job.failedRuns
      job.activeRuns = 0
      job.progressPct = 100
      job.cpuPct = 0
      job.finishedAt = new Date().toISOString()
      job.estimatedRemainingSeconds = 0
      pushLog(job, 'info', 'Finalización simulada por el usuario')
    })
  }

  async simulateFailure(jobId: string): Promise<SimulationJob> {
    await delay(150)
    return this.transition(jobId, (job) => {
      job.status = 'failed'
      job.activeRuns = 0
      job.cpuPct = 0
      job.finishedAt = new Date().toISOString()
      pushLog(job, 'error', 'Fallo simulado por el usuario')
    })
  }

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  private transition(jobId: string, mutate: (job: SimulationJob) => void): SimulationJob {
    let updated: SimulationJob | undefined
    jobs = jobs.map((j) => {
      if (j.id !== jobId) return j
      const next = { ...j }
      mutate(next)
      updated = next
      return next
    })
    if (!updated) throw new Error(`Trabajo no encontrado: ${jobId}`)
    notify()
    return updated
  }
}

export const jobService: JobService = new MockJobService()
