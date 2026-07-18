import type { SimulationConfig, SimulationJob } from '../types'
import type { JobService } from './types'

function unavailable(): never {
  throw new Error('La ejecución de simulaciones aún no está habilitada.')
}

class LiveJobService implements JobService {
  async list(): Promise<SimulationJob[]> {
    return []
  }

  async get(_jobId: string): Promise<SimulationJob | null> {
    return null
  }

  async createFromConfig(_config: SimulationConfig, _projectName: string): Promise<SimulationJob> {
    unavailable()
  }

  async cancel(_jobId: string): Promise<SimulationJob> {
    unavailable()
  }

  async retry(_jobId: string): Promise<SimulationJob> {
    unavailable()
  }

  async duplicate(_jobId: string): Promise<SimulationJob> {
    unavailable()
  }

  async remove(_jobId: string): Promise<void> {
    unavailable()
  }

  async simulateCompletion(_jobId: string): Promise<SimulationJob> {
    unavailable()
  }

  async simulateFailure(_jobId: string): Promise<SimulationJob> {
    unavailable()
  }

  subscribe(_listener: () => void): () => void {
    return () => {}
  }
}

export const jobService: JobService = new LiveJobService()
