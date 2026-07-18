import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { getHealth } from '../api/healthApi'
import { getIdentity } from '../api/identityApi'

const identity = {
  user_id: 'cf-sub:abc',
  email: 'usuario@uabc.edu.mx',
  name: null,
  roles: ['user'],
  is_admin: false,
  groups: [],
  limits: { active_jobs_per_user: 2 },
}

const health = {
  status: 'ok',
  service: 'cimasim',
  features: { identity: 'available', job_submission: 'not_available' },
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    }),
  )
}

describe('API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads /api/me', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(await jsonResponse(identity))
    await expect(getIdentity()).resolves.toEqual(identity)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('loads /api/health', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(await jsonResponse(health))
    await expect(getHealth()).resolves.toEqual(health)
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [503, 'unavailable'],
  ])('maps status %s to a typed error', async (status, kind) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await jsonResponse({ error: { request_id: 'req-1' } }, status),
    )
    await expect(getIdentity()).rejects.toMatchObject({ status, kind, requestId: 'req-1' })
  })

  it('rejects invalid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    await expect(getHealth()).rejects.toMatchObject({ kind: 'invalid-json' })
  })

  it('rejects unexpected HTML', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    )
    await expect(getHealth()).rejects.toMatchObject({ kind: 'unexpected-content' })
  })

  it('supports abort', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      return init?.signal?.aborted
        ? Promise.reject(new DOMException('aborted', 'AbortError'))
        : jsonResponse(identity)
    })
    await expect(getIdentity({ signal: controller.signal })).rejects.toMatchObject({
      kind: 'aborted',
    })
  })

  it('handles timeout', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    })
    const request = getHealth({ timeoutMs: 10 })
    const assertion = expect(request).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(20)
    await assertion
  })

  it('does not send auth or Cloudflare assertion headers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(await jsonResponse(identity))
    await getIdentity()
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.headers).not.toHaveProperty('Authorization')
    expect(init?.headers).not.toHaveProperty('Cf-Access-Jwt-Assertion')
  })

  it('does not read browser cookie or identity storage', async () => {
    const cookieSpy = vi.fn(() => '')
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: cookieSpy,
    })
    const localSpy = vi.spyOn(Storage.prototype, 'getItem')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(await jsonResponse(identity))
    await getIdentity()
    expect(cookieSpy).not.toHaveBeenCalled()
    expect(localSpy).not.toHaveBeenCalled()
  })

  it('does not log full error responses', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await jsonResponse({ error: { message: 'internal', request_id: 'req-2' } }, 401),
    )
    await expect(getIdentity()).rejects.toBeInstanceOf(ApiError)
    expect(consoleSpy).not.toHaveBeenCalled()
  })
})
