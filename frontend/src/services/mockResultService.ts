import { mockResults } from '../mocks/results'
import { delay } from '../utils/delay'
import type { ResultService } from './types'

const results = [...mockResults]

class MockResultService implements ResultService {
  async list() {
    await delay(150)
    return results
  }

  async get(resultId: string) {
    await delay(150)
    return results.find((r) => r.id === resultId) ?? null
  }

  async getByJobId(jobId: string) {
    await delay(150)
    return results.find((r) => r.jobId === jobId) ?? null
  }
}

export const resultService: ResultService = new MockResultService()
