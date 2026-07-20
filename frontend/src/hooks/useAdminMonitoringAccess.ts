import { useEffect, useState } from 'react'
import { ApiError } from '../api/errors'
import { getMonitoringSummary } from '../api/monitoringApi'

export function useAdminMonitoringAccess() {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void getMonitoringSummary({ signal: controller.signal })
      .then(() => setAllowed(true))
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.kind === 'aborted')) setAllowed(false)
      })
    return () => controller.abort()
  }, [])

  return allowed
}
