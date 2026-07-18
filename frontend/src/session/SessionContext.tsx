import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getHealth } from '../api/healthApi'
import { getIdentity } from '../api/identityApi'
import type { CimaSimHealth, CimaSimIdentity } from '../api/types'
import { getUserFacingSessionMessage } from '../api/errors'
import { SessionContext } from './context'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<CimaSimIdentity | null>(null)
  const [health, setHealth] = useState<CimaSimHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const identityController = useRef<AbortController | null>(null)
  const healthController = useRef<AbortController | null>(null)

  const refreshIdentity = useCallback(async () => {
    identityController.current?.abort()
    const controller = new AbortController()
    identityController.current = controller
    try {
      const result = await getIdentity({ signal: controller.signal })
      setIdentity(result)
      setError(null)
    } catch (err) {
      if (!controller.signal.aborted) {
        setIdentity(null)
        setError(getUserFacingSessionMessage(err))
      }
    }
  }, [])

  const refreshHealth = useCallback(async () => {
    healthController.current?.abort()
    const controller = new AbortController()
    healthController.current = controller
    try {
      const result = await getHealth({ signal: controller.signal })
      setHealth(result)
      setError((current) => current)
    } catch (err) {
      if (!controller.signal.aborted) {
        setHealth(null)
        setError(getUserFacingSessionMessage(err))
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      await Promise.all([refreshIdentity(), refreshHealth()])
      if (active) setLoading(false)
    }
    void load()
    const interval = window.setInterval(() => {
      void refreshHealth()
    }, 45_000)
    return () => {
      active = false
      window.clearInterval(interval)
      identityController.current?.abort()
      healthController.current?.abort()
    }
  }, [refreshHealth, refreshIdentity])

  const value = useMemo(
    () => ({ identity, health, loading, error, refreshIdentity, refreshHealth }),
    [error, health, identity, loading, refreshHealth, refreshIdentity],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
