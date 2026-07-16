export type ArtifactKind = 'raw-output' | 'log' | 'plot-data' | 'netlist-snapshot' | 'report'

export interface GeneratedArtifact {
  id: string
  name: string
  kind: ArtifactKind
  sizeBytes: number
  createdAt: string
}

export interface SignalSeries {
  name: string
  unit: string
  /** Values aligned index-for-index with the parent SimulationResult.xAxis.values. */
  values: number[]
}

export interface ResultAxis {
  name: string
  unit: string
  values: number[]
}

export interface SimulationResult {
  id: string
  jobId: string
  projectId: string
  projectName: string
  simulationName: string
  simulatorId: 'xyce' | 'ngspice'
  createdAt: string
  totalRuns: number
  completedRuns: number
  failedRuns: number
  warningsCount: number
  durationSeconds: number
  xAxis: ResultAxis
  series: SignalSeries[]
  artifacts: GeneratedArtifact[]
}
