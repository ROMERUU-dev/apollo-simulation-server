import type { SimulatorId } from './server'

export type ParameterMode = 'fixed' | 'linear' | 'log' | 'list' | 'original' | 'exclude'

export interface ParameterDefinition {
  id: string
  name: string
  originalValue: string
  unit: string
  mode: ParameterMode
  fixedValue: string
  rangeStart: string
  rangeEnd: string
  rangeStep: string
  listValues: string
}

/** Derived, read-only view of how many concrete values a parameter expands to. */
export interface ParameterSweep {
  parameterId: string
  valueCount: number
  values: string[]
  warning?: string
}

export type FailureBehavior = 'stop-all' | 'skip-and-continue' | 'retry-then-skip'
export type JobPriority = 'low' | 'normal' | 'high'

export interface ExecutionConfig {
  parallelJobs: number
  timeoutSeconds: number
  priority: JobPriority
  onFailure: FailureBehavior
  keepIntermediateFiles: boolean
  reservedThreads: number
  reservedRamGb: number
}

export interface SimulationConfig {
  id: string
  projectId: string
  name: string
  netlistId: string
  netlistContent: string
  modelFileIds: string[]
  simulatorId: SimulatorId
  parameters: ParameterDefinition[]
  execution: ExecutionConfig
  createdAt: string
}
