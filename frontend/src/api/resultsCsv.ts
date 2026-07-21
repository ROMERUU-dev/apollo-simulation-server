import { ApiError } from './errors'
import type { JobRequestOptions } from './jobsApi'

export const MAX_RESULTS_BYTES = 10 * 1024 * 1024
export const MAX_RESULTS_ROWS = 100_000
export const MAX_RESULTS_COLUMNS = 128

export interface GenericResults {
  columns: string[]
  rows: number[][]
}

export function parseResultsCsv(text: string): GenericResults {
  const normalized = text.replaceAll('\r\n', '\n')
  if (/^\s*</.test(normalized) || /<html[\s>]/i.test(normalized)) {
    throw new ApiError('El artefacto no es un CSV válido.', 'unexpected-content')
  }
  const lines = normalized.endsWith('\n')
    ? normalized.slice(0, -1).split('\n')
    : normalized.split('\n')
  const columns = lines[0]?.split(',') ?? []
  if (
    columns.length < 2 ||
    columns.length > MAX_RESULTS_COLUMNS ||
    new Set(columns).size !== columns.length ||
    columns.some((column) => !column || /^[=+\-@]/.test(column))
  ) {
    throw new ApiError('El CSV contiene encabezados inválidos.', 'invalid-json')
  }
  const dataLines = lines.slice(1)
  if (dataLines.length === 0 || dataLines.length > MAX_RESULTS_ROWS) {
    throw new ApiError('El CSV contiene una cantidad de filas inválida.', 'invalid-json')
  }
  let previous = -Infinity
  let direction = 0
  const rows = dataLines.map((line) => {
    const values = line.split(',').map(Number)
    if (values.length !== columns.length || values.some((value) => !Number.isFinite(value))) {
      throw new ApiError('El CSV contiene valores inválidos.', 'invalid-json')
    }
    if (previous !== -Infinity && values[0] !== previous) {
      const currentDirection = values[0] > previous ? 1 : -1
      if (direction !== 0 && currentDirection !== direction) {
        throw new ApiError('El eje X no es monótono.', 'invalid-json')
      }
      direction = currentDirection
    }
    previous = values[0]
    return values
  })
  return { columns, rows }
}

export async function fetchResults(jobId: string, options: JobRequestOptions = {}) {
  const response = await fetch(`/api/jobs/${jobId}/artifacts/results.csv`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'text/csv' },
    signal: options.signal,
  })
  if (!response.ok)
    throw new ApiError('No fue posible obtener results.csv.', 'http', response.status)
  if (!(response.headers.get('content-type') ?? '').toLowerCase().startsWith('text/csv')) {
    throw new ApiError('El artefacto recibido no es CSV.', 'unexpected-content')
  }
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(declared) && declared > MAX_RESULTS_BYTES) {
    throw new ApiError('results.csv supera el tamaño permitido.', 'unexpected-content')
  }
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_RESULTS_BYTES) {
    throw new ApiError('results.csv supera el tamaño permitido.', 'unexpected-content')
  }
  return parseResultsCsv(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
}
