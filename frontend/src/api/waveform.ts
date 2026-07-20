import { ApiError } from './errors'
import type { JobRequestOptions } from './jobsApi'

export const MAX_WAVEFORM_BYTES = 5 * 1024 * 1024
export const MAX_WAVEFORM_ROWS = 10_000
const EXPECTED_HEADER = 'time_seconds,input_volts,output_volts'

export interface WaveformPoint {
  timeSeconds: number
  inputVolts: number
  outputVolts: number
}

export interface WaveformMetrics {
  finalOutputVolts: number
  maximumInputVolts: number
  maximumOutputVolts: number
  samples: number
  durationSeconds: number
}

export function parseWaveformCsv(text: string): WaveformPoint[] {
  const normalized = text.replaceAll('\r\n', '\n')
  if (/^\s*</.test(normalized) || /<html[\s>]/i.test(normalized)) {
    throw new ApiError('El artefacto recibido no es un CSV válido.', 'unexpected-content')
  }
  const lines = normalized.endsWith('\n')
    ? normalized.slice(0, -1).split('\n')
    : normalized.split('\n')
  if (lines[0] !== EXPECTED_HEADER) {
    throw new ApiError('El CSV no contiene las columnas esperadas.', 'invalid-json')
  }
  const dataLines = lines.slice(1)
  if (dataLines.length === 0 || dataLines.length > MAX_WAVEFORM_ROWS) {
    throw new ApiError('El CSV contiene una cantidad de muestras inválida.', 'invalid-json')
  }

  let previousTime = -Infinity
  const points = dataLines.map((line) => {
    const columns = line.split(',')
    if (columns.length !== 3 || columns.some((column) => column.trim() === '')) {
      throw new ApiError('El CSV contiene una fila incompleta.', 'invalid-json')
    }
    const values = columns.map((column) => Number(column))
    if (values.some((value) => !Number.isFinite(value))) {
      throw new ApiError('El CSV contiene valores no numéricos.', 'invalid-json')
    }
    const [timeSeconds, inputVolts, outputVolts] = values
    if (timeSeconds < 0 || timeSeconds < previousTime) {
      throw new ApiError('El CSV contiene tiempos fuera de orden.', 'invalid-json')
    }
    previousTime = timeSeconds
    return { timeSeconds, inputVolts, outputVolts }
  })

  const duration = points.at(-1)!.timeSeconds - points[0].timeSeconds
  if (!Number.isFinite(duration) || duration < 0 || duration > 60) {
    throw new ApiError('La duración del CSV no es razonable.', 'invalid-json')
  }
  return points
}

export function calculateWaveformMetrics(points: WaveformPoint[]): WaveformMetrics {
  if (points.length === 0) throw new ApiError('El CSV no contiene muestras.', 'invalid-json')
  return {
    finalOutputVolts: points.at(-1)!.outputVolts,
    maximumInputVolts: Math.max(...points.map((point) => point.inputVolts)),
    maximumOutputVolts: Math.max(...points.map((point) => point.outputVolts)),
    samples: points.length,
    durationSeconds: points.at(-1)!.timeSeconds - points[0].timeSeconds,
  }
}

export async function fetchWaveform(
  jobId: string,
  options: JobRequestOptions = {},
): Promise<WaveformPoint[]> {
  const timeoutController = new AbortController()
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort('caller')
  const abortFromTimeout = () => controller.abort('timeout')
  options.signal?.addEventListener('abort', abortFromCaller, { once: true })
  timeoutController.signal.addEventListener('abort', abortFromTimeout, { once: true })
  if (options.signal?.aborted) abortFromCaller()
  const timeoutId = window.setTimeout(() => timeoutController.abort(), options.timeoutMs ?? 8000)
  try {
    const response = await fetch(`/api/jobs/${jobId}/artifacts/waveform.csv`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'text/csv' },
      signal: controller.signal,
    })
    if (!response.ok)
      throw new ApiError('No fue posible obtener waveform.csv.', 'http', response.status)
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!contentType.startsWith('text/csv')) {
      throw new ApiError('El artefacto recibido no es CSV.', 'unexpected-content', response.status)
    }
    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_WAVEFORM_BYTES) {
      throw new ApiError('waveform.csv supera el tamaño permitido.', 'unexpected-content')
    }
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_WAVEFORM_BYTES) {
      throw new ApiError('waveform.csv supera el tamaño permitido.', 'unexpected-content')
    }
    return parseWaveformCsv(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (controller.signal.aborted) {
      throw new ApiError(
        options.signal?.aborted ? 'La solicitud fue cancelada.' : 'La descarga excedió el tiempo.',
        options.signal?.aborted ? 'aborted' : 'timeout',
      )
    }
    throw new ApiError('No fue posible obtener waveform.csv.', 'network')
  } finally {
    window.clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', abortFromCaller)
    timeoutController.signal.removeEventListener('abort', abortFromTimeout)
  }
}
