import type { ServerStatus } from '../types'
import type { ServerStatusService } from './types'

class LiveServerStatusService implements ServerStatusService {
  async get(): Promise<ServerStatus> {
    return {
      hostname: '',
      model: '',
      online: false,
      resources: {
        cpuThreadsTotal: 0,
        cpuThreadsReserved: 0,
        cpuThreadsUsedPct: 0,
        ramTotalGb: 0,
        ramUsedGb: 0,
        storageTotalGb: 0,
        storageUsedGb: 0,
      },
      simulators: [
        {
          id: 'xyce',
          name: 'Xyce',
          version: '',
          available: false,
          description: 'Ejecución real aún no habilitada.',
        },
        {
          id: 'ngspice',
          name: 'ngspice',
          version: '',
          available: false,
          description: 'Ejecución real aún no habilitada.',
        },
      ],
      activeJobsCount: 0,
      queuedJobsCount: 0,
    }
  }

  subscribe(_listener: () => void): () => void {
    return () => {}
  }
}

export const serverStatusService: ServerStatusService = new LiveServerStatusService()
