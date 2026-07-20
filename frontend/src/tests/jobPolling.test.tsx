import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getJob } from '../api/jobsApi'
import { useJob } from '../hooks/useJobs'

vi.mock('../api/jobsApi', () => ({
  getJob: vi.fn(),
  jobErrorMessage: () => 'No fue posible cargar el trabajo.',
  listJobs: vi.fn(),
}))

const JOB_ID = `job_${'4'.repeat(32)}`
const baseJob = {
  job_id: JOB_ID,
  name: 'Prueba RC',
  template_id: 'rc_lowpass_fixed_v1' as const,
  simulator: 'xyce' as const,
  created_at: '2026-07-20T12:00:00Z',
  updated_at: '2026-07-20T12:00:00Z',
  summary: null,
}

describe('job detail polling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  async function flushRequests() {
    await act(async () => {
      await Promise.resolve()
    })
  }

  it.each(['queued', 'running'] as const)('continues polling while %s', async (status) => {
    vi.mocked(getJob).mockResolvedValue({ ...baseJob, status })
    const { result } = renderHook(() => useJob(JOB_ID))
    await flushRequests()
    expect(result.current.job?.status).toBe(status)
    await act(() => vi.advanceTimersByTimeAsync(2001))
    await flushRequests()
    expect(getJob).toHaveBeenCalledTimes(2)
  })

  it.each(['succeeded', 'failed', 'timed_out'] as const)(
    'stops polling after %s',
    async (status) => {
      vi.mocked(getJob).mockResolvedValue({ ...baseJob, status })
      const { result } = renderHook(() => useJob(JOB_ID))
      await flushRequests()
      expect(result.current.job?.status).toBe(status)
      await act(() => vi.advanceTimersByTimeAsync(5000))
      expect(getJob).toHaveBeenCalledTimes(1)
    },
  )

  it('moves from queued to succeeded and then stops', async () => {
    vi.mocked(getJob)
      .mockResolvedValueOnce({ ...baseJob, status: 'queued' })
      .mockResolvedValue({ ...baseJob, status: 'succeeded' })
    const { result } = renderHook(() => useJob(JOB_ID))
    await flushRequests()
    expect(result.current.job?.status).toBe('queued')
    await act(() => vi.advanceTimersByTimeAsync(2001))
    await flushRequests()
    expect(result.current.job?.status).toBe('succeeded')
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(getJob).toHaveBeenCalledTimes(2)
  })

  it('aborts an active request when unmounted', async () => {
    let requestSignal: AbortSignal | undefined
    vi.mocked(getJob).mockImplementation((_jobId, options) => {
      requestSignal = options?.signal
      return new Promise(() => {})
    })
    const { unmount } = renderHook(() => useJob(JOB_ID))
    await flushRequests()
    unmount()
    expect(requestSignal?.aborted).toBe(true)
  })
})
