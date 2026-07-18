import { describe, expect, it } from 'vitest'
import { jobService, projectService, resultService, serverStatusService } from '../services'

describe('production services', () => {
  it('do not use mock service instances from the production barrel', () => {
    expect(projectService.constructor.name).not.toMatch(/Mock/)
    expect(jobService.constructor.name).not.toMatch(/Mock/)
    expect(resultService.constructor.name).not.toMatch(/Mock/)
    expect(serverStatusService.constructor.name).not.toMatch(/Mock/)
  })

  it('return empty live collections', async () => {
    await expect(projectService.list()).resolves.toEqual([])
    await expect(jobService.list()).resolves.toEqual([])
    await expect(resultService.list()).resolves.toEqual([])
    await expect(serverStatusService.get()).resolves.toMatchObject({
      activeJobsCount: 0,
      queuedJobsCount: 0,
    })
  })
})
