import { useCallback, useEffect, useState } from 'react'
import { serverStatusService } from '../services'
import type { ServerStatus } from '../types'

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    serverStatusService
      .get()
      .then((result) => {
        setStatus(result)
        setError(null)
        setLoading(false)
      })
      .catch(() => {
        setError('No se pudo obtener el estado del servidor.')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
    return serverStatusService.subscribe(refresh)
  }, [refresh])

  return { status, loading, error, refresh }
}
