import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { createFixedRcJob, getJob, listJobArtifacts, listJobs } from '../api/jobsApi'

const JOB_ID = `job_${'1'.repeat(32)}`
const queuedJob = {
  job_id: JOB_ID,
  name: 'Prueba RC',
  template_id: 'rc_lowpass_fixed_v1',
  simulator: 'xyce',
  status: 'queued',
  created_at: '2026-07-20T12:00:00Z',
  updated_at: '2026-07-20T12:00:00Z',
  summary: null,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('jobs API client', () => {
  afterEach(() => vi.useRealTimers())

  it.each([
    [201, false],
    [200, true],
  ])('accepts creation response %i', async (status, recovered) => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(queuedJob, status))
    const result = await createFixedRcJob('Prueba RC', 'key-1')
    expect(result).toEqual({ job: queuedJob, recovered })
    expect(fetch).toHaveBeenCalledWith(
      '/api/jobs',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    )
  })

  it('lists jobs without changing backend order', async () => {
    const newer = { ...queuedJob, job_id: `job_${'2'.repeat(32)}`, name: 'Segundo' }
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ jobs: [newer, queuedJob] }))
    expect((await listJobs()).map((job) => job.name)).toEqual(['Segundo', 'Prueba RC'])
  })

  it('gets a job and its artifacts through relative URLs', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(queuedJob))
      .mockResolvedValueOnce(
        jsonResponse({
          artifacts: [{ filename: 'waveform.csv', content_type: 'text/csv', size_bytes: 120 }],
        }),
      )
    expect((await getJob(JOB_ID)).job_id).toBe(JOB_ID)
    expect(await listJobArtifacts(JOB_ID)).toHaveLength(1)
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      `/api/jobs/${JOB_ID}`,
      `/api/jobs/${JOB_ID}/artifacts`,
    ])
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [409, 'conflict'],
    [422, 'validation'],
    [429, 'rate-limit'],
    [503, 'unavailable'],
  ])('maps HTTP %i to a sanitized error', async (status, kind) => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { request_id: 'req-1' } }, status))
    await expect(listJobs()).rejects.toMatchObject({ kind, requestId: 'req-1' })
  })

  it('rejects invalid JSON and unexpected HTML', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }),
      )
      .mockResolvedValueOnce(
        new Response('<html>Access</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      )
    await expect(listJobs()).rejects.toMatchObject({ kind: 'invalid-json' })
    await expect(listJobs()).rejects.toMatchObject({ kind: 'unexpected-content' })
  })

  it('reports caller cancellation without retrying', async () => {
    vi.mocked(fetch).mockImplementationOnce((_input, init) => {
      if (init?.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
      return Promise.reject(new Error('expected an aborted signal'))
    })
    const controller = new AbortController()
    controller.abort()
    await expect(listJobs({ signal: controller.signal })).rejects.toMatchObject({
      kind: 'aborted',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reports a timeout as unconfirmed', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementationOnce((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        )
      })
    })
    const pending = listJobs({ timeoutMs: 10 })
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(11)
    await assertion
  })

  it('sends no authentication material and does not persist responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(queuedJob, 201))
    await createFixedRcJob('Prueba RC', 'opaque-key')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    const serialized = JSON.stringify({ url, init })
    expect(url).toBe('/api/jobs')
    expect(serialized).not.toMatch(/Authorization|Cf-Access-Jwt-Assertion|cookie|localStorage/i)
    expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBe('opaque-key')
  })

  it('rejects invalid job identifiers before making a request', async () => {
    await expect(getJob('../secret')).rejects.toBeInstanceOf(ApiError)
    expect(fetch).not.toHaveBeenCalled()
  })
})
