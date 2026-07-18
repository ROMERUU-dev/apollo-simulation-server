import { ApiError } from './errors'
import type { ApiErrorBody } from './types'

const DEFAULT_TIMEOUT_MS = 8000

export interface ApiRequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

function joinSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (a.aborted || b.aborted) controller.abort()
  else {
    a.addEventListener('abort', abort, { once: true })
    b.addEventListener('abort', abort, { once: true })
  }
  return controller.signal
}

function requestIdFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const data = body as ApiErrorBody
  return data.error?.request_id ?? data.request_id ?? null
}

function messageForStatus(status: number): string {
  if (status === 401) return 'La sesión no está disponible o expiró.'
  if (status === 403) return 'Tu cuenta no está autorizada para CimaSim.'
  if (status === 503) return 'El backend de CimaSim no está disponible temporalmente.'
  return 'La API respondió con un error.'
}

function kindForStatus(status: number) {
  if (status === 401) return 'unauthorized' as const
  if (status === 403) return 'forbidden' as const
  if (status === 503) return 'unavailable' as const
  return 'http' as const
}

export async function apiGetJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const timeout = new AbortController()
  const timeoutId = window.setTimeout(() => timeout.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const signal = joinSignals(timeout.signal, options.signal)

  try {
    const response = await fetch(path, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal,
    })
    const contentType = response.headers.get('content-type') ?? ''
    const isJson = contentType.toLowerCase().includes('application/json')

    if (!isJson) {
      throw new ApiError('La API no devolvió JSON.', 'unexpected-content', response.status)
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new ApiError('La API devolvió JSON inválido.', 'invalid-json', response.status)
    }

    if (!response.ok) {
      throw new ApiError(
        messageForStatus(response.status),
        kindForStatus(response.status),
        response.status,
        requestIdFromBody(body),
      )
    }

    return body as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        options.signal?.aborted ? 'La solicitud fue cancelada.' : 'La solicitud excedió el tiempo.',
        options.signal?.aborted ? 'aborted' : 'timeout',
      )
    }
    throw new ApiError('No se pudo conectar con la API.', 'network')
  } finally {
    window.clearTimeout(timeoutId)
  }
}
