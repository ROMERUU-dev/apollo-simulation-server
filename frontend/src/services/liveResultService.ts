import type { SimulationResult } from '../types'
import type { ResultService } from './types'

class LiveResultService implements ResultService {
  async list(): Promise<SimulationResult[]> {
    return []
  }

  async get(_resultId: string): Promise<SimulationResult | null> {
    return null
  }

  async getByJobId(_jobId: string): Promise<SimulationResult | null> {
    return null
  }
}

export const resultService: ResultService = new LiveResultService()
