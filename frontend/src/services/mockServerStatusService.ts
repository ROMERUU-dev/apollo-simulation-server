import { mockServerStatus } from '../mocks/server'
import { delay } from '../utils/delay'
import { jobService } from './mockJobService'
import type { ServerStatus } from '../types'
import type { ServerStatusService } from './types'

const listeners = new Set<() => void>()
let currentStatus: ServerStatus = { ...mockServerStatus }

jobService.subscribe(() => {
  void refreshJobCounts()
})

async function refreshJobCounts() {
  const jobs = await jobService.list()
  currentStatus = {
    ...currentStatus,
    activeJobsCount: jobs.filter((j) => j.status === 'running').length,
    queuedJobsCount: jobs.filter((j) => j.status === 'queued').length,
  }
  listeners.forEach((listener) => listener())
}

class MockServerStatusService implements ServerStatusService {
  async get(): Promise<ServerStatus> {
    await delay(150)
    await refreshJobCounts()
    return currentStatus
  }

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
}

export const serverStatusService: ServerStatusService = new MockServerStatusService()
