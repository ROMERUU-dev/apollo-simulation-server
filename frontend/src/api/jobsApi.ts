import { ApiError } from './errors'
import {
  FIXED_RC_TEMPLATE_ID,
  type ArtifactInfo,
  type ArtifactListResponse,
  type Job,
  type JobListResponse,
  type JobStatus,
  type JobSummary,
  type TerminalJobStatus,
} from './jobTypes'
import type { ApiErrorBody } from './types'

const DEFAULT_TIMEOUT_MS = 8000
const JOB_ID_PATTERN = /^job_[0-9a-f]{32}$/
const JOB_STATUSES: JobStatus[] = ['queued', 'running', 'succeeded', 'failed', 'timed_out']
const TERMINAL_STATUSES: TerminalJobStatus[] = ['succeeded', 'failed', 'timed_out']

export interface JobRequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requestIdFromBody(body: unknown): string | null {
  if (!isRecord(body)) return null
  const data = body as ApiErrorBody
  return data.error?.request_id ?? data.request_id ?? null
}

function errorForStatus(status: number, requestId: string | null): ApiError {
  if (status === 401) {
    return new ApiError('La sesión expiró o no está disponible.', 'unauthorized', status, requestId)
  }
  if (status === 403) {
    return new ApiError(
      'Tu cuenta no está autorizada para ejecutar simulaciones.',
      'forbidden',
      status,
      requestId,
    )
  }
  if (status === 409) {
    return new ApiError(
      'La solicitud entró en conflicto con una ejecución anterior.',
      'conflict',
      status,
      requestId,
    )
  }
  if (status === 422) {
    return new ApiError(
      'La configuración fija no fue aceptada por el servidor.',
      'validation',
      status,
      requestId,
    )
  }
  if (status === 429) {
    return new ApiError(
      'Alcanzaste el límite de trabajos activos. Espera a que terminen.',
      'rate-limit',
      status,
      requestId,
    )
  }
  if (status === 503) {
    return new ApiError(
      'El motor de simulación no está disponible temporalmente.',
      'unavailable',
      status,
      requestId,
    )
  }
  return new ApiError('La API respondió con un error.', 'http', status, requestId)
}

function parseArtifact(value: unknown): ArtifactInfo {
  if (
    !isRecord(value) ||
    value.filename !== 'waveform.csv' ||
    value.content_type !== 'text/csv' ||
    typeof value.size_bytes !== 'number' ||
    !Number.isSafeInteger(value.size_bytes) ||
    value.size_bytes < 0
  ) {
    throw new ApiError('La API devolvió datos de artefacto inválidos.', 'invalid-json')
  }
  return value as unknown as ArtifactInfo
}

function nullableFiniteNumber(value: unknown): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError('La API devolvió un resumen inválido.', 'invalid-json')
  }
  return value
}

function parseSummary(value: unknown): JobSummary | null {
  if (value === null) return null
  if (
    !isRecord(value) ||
    !TERMINAL_STATUSES.includes(value.status as TerminalJobStatus) ||
    value.simulator !== 'xyce' ||
    value.template !== FIXED_RC_TEMPLATE_ID ||
    (value.error !== null && typeof value.error !== 'string') ||
    !Array.isArray(value.artifacts)
  ) {
    throw new ApiError('La API devolvió un resumen inválido.', 'invalid-json')
  }
  return {
    status: value.status as TerminalJobStatus,
    simulator: 'xyce',
    template: FIXED_RC_TEMPLATE_ID,
    samples: nullableFiniteNumber(value.samples),
    duration_seconds: nullableFiniteNumber(value.duration_seconds),
    elapsed_seconds: nullableFiniteNumber(value.elapsed_seconds),
    error: value.error as string | null,
    artifacts: value.artifacts.map(parseArtifact),
  }
}

export function parseJob(value: unknown): Job {
  if (
    !isRecord(value) ||
    typeof value.job_id !== 'string' ||
    !JOB_ID_PATTERN.test(value.job_id) ||
    typeof value.name !== 'string' ||
    value.template_id !== FIXED_RC_TEMPLATE_ID ||
    value.simulator !== 'xyce' ||
    !JOB_STATUSES.includes(value.status as JobStatus) ||
    typeof value.created_at !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    throw new ApiError('La API devolvió datos de trabajo inválidos.', 'invalid-json')
  }
  return {
    job_id: value.job_id,
    name: value.name,
    template_id: FIXED_RC_TEMPLATE_ID,
    simulator: 'xyce',
    status: value.status as JobStatus,
    created_at: value.created_at,
    updated_at: value.updated_at,
    summary: parseSummary(value.summary),
  }
}

async function requestJson(
  path: string,
  init: RequestInit,
  options: JobRequestOptions,
): Promise<{ body: unknown; status: number }> {
  const timeoutController = new AbortController()
  const combinedController = new AbortController()
  const abortFromCaller = () => combinedController.abort('caller')
  const abortFromTimeout = () => combinedController.abort('timeout')
  options.signal?.addEventListener('abort', abortFromCaller, { once: true })
  timeoutController.signal.addEventListener('abort', abortFromTimeout, { once: true })
  if (options.signal?.aborted) abortFromCaller()
  const timeoutId = window.setTimeout(
    () => timeoutController.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )

  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      signal: combinedController.signal,
    })
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!contentType.includes('application/json')) {
      throw new ApiError(
        'La API devolvió contenido inesperado.',
        'unexpected-content',
        response.status,
      )
    }
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new ApiError('La API devolvió JSON inválido.', 'invalid-json', response.status)
    }
    if (!response.ok) throw errorForStatus(response.status, requestIdFromBody(body))
    return { body, status: response.status }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (combinedController.signal.aborted) {
      if (options.signal?.aborted) {
        throw new ApiError('La solicitud fue cancelada.', 'aborted')
      }
      throw new ApiError('No fue posible confirmar la solicitud.', 'timeout')
    }
    throw new ApiError('No fue posible confirmar la solicitud.', 'network')
  } finally {
    window.clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', abortFromCaller)
    timeoutController.signal.removeEventListener('abort', abortFromTimeout)
  }
}

export async function createFixedRcJob(
  name: string,
  idempotencyKey: string,
  options: JobRequestOptions = {},
): Promise<{ job: Job; recovered: boolean }> {
  const { body, status } = await requestJson(
    '/api/jobs',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ name, template_id: FIXED_RC_TEMPLATE_ID }),
    },
    options,
  )
  if (status !== 200 && status !== 201) {
    throw new ApiError('La API devolvió un estado inesperado.', 'http', status)
  }
  return { job: parseJob(body), recovered: status === 200 }
}

export async function listJobs(options: JobRequestOptions = {}): Promise<Job[]> {
  const { body } = await requestJson(
    '/api/jobs',
    { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' },
    options,
  )
  if (!isRecord(body) || !Array.isArray(body.jobs)) {
    throw new ApiError('La API devolvió una lista inválida.', 'invalid-json')
  }
  return (body as unknown as JobListResponse).jobs.map(parseJob)
}

export async function getJob(jobId: string, options: JobRequestOptions = {}): Promise<Job> {
  if (!JOB_ID_PATTERN.test(jobId)) throw new ApiError('Identificador de trabajo inválido.', 'http')
  const { body } = await requestJson(
    `/api/jobs/${jobId}`,
    { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' },
    options,
  )
  return parseJob(body)
}

export async function listJobArtifacts(
  jobId: string,
  options: JobRequestOptions = {},
): Promise<ArtifactInfo[]> {
  if (!JOB_ID_PATTERN.test(jobId)) throw new ApiError('Identificador de trabajo inválido.', 'http')
  const { body } = await requestJson(
    `/api/jobs/${jobId}/artifacts`,
    { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' },
    options,
  )
  if (!isRecord(body) || !Array.isArray(body.artifacts)) {
    throw new ApiError('La API devolvió una lista de artefactos inválida.', 'invalid-json')
  }
  return (body as unknown as ArtifactListResponse).artifacts.map(parseArtifact)
}

export function jobErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'No fue posible confirmar la solicitud.'
  return error.requestId ? `${error.message} Solicitud ${error.requestId}.` : error.message
}
