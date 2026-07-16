export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  message: string
}

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface RunResult {
  id: string
  runIndex: number
  parameters: Record<string, string>
  status: RunStatus
  durationSeconds: number | null
  warnings: string[]
  resultSummary: string | null
}

export interface SimulationJob {
  id: string
  projectId: string
  projectName: string
  simulationConfigId: string
  name: string
  simulatorId: 'xyce' | 'ngspice'
  status: JobStatus
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  totalRuns: number
  completedRuns: number
  activeRuns: number
  failedRuns: number
  progressPct: number
  cpuPct: number
  memoryMb: number
  workerName: string
  elapsedSeconds: number
  estimatedRemainingSeconds: number | null
  logs: LogEntry[]
  runs: RunResult[]
}
