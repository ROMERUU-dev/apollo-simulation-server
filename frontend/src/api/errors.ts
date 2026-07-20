export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'unavailable'
  | 'conflict'
  | 'validation'
  | 'rate-limit'
  | 'invalid-json'
  | 'unexpected-content'
  | 'timeout'
  | 'aborted'
  | 'http'
  | 'network'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly requestId: string | null

  constructor(
    message: string,
    kind: ApiErrorKind,
    status: number | null = null,
    requestId: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.requestId = requestId
  }
}

export function getUserFacingSessionMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'No se pudo cargar la sesión de CimaSim.'
  }
  if (error.status === 401) return 'La sesión no está disponible o expiró.'
  if (error.status === 403) return 'Tu cuenta no está autorizada para CimaSim.'
  if (error.status === 503) return 'El backend de CimaSim no está disponible temporalmente.'
  if (error.kind === 'invalid-json' || error.kind === 'unexpected-content') {
    return error.requestId
      ? `Respuesta técnica inesperada. Request ${error.requestId}.`
      : 'Respuesta técnica inesperada.'
  }
  return 'No se pudo conectar con el backend de CimaSim.'
}
