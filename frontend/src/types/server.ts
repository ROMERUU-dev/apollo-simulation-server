export type SimulatorId = 'xyce' | 'ngspice'

export interface SimulatorInfo {
  id: SimulatorId
  name: string
  version: string
  available: boolean
  description: string
}

export interface ServerResources {
  cpuThreadsTotal: number
  cpuThreadsReserved: number
  cpuThreadsUsedPct: number
  ramTotalGb: number
  ramUsedGb: number
  storageTotalGb: number
  storageUsedGb: number
}

export interface ServerStatus {
  hostname: string
  model: string
  online: boolean
  resources: ServerResources
  simulators: SimulatorInfo[]
  activeJobsCount: number
  queuedJobsCount: number
}
