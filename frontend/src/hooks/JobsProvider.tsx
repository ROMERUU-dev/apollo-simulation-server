import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { jobErrorMessage, listJobs } from '../api/jobsApi'
import { isTerminalJobStatus, type Job } from '../api/jobTypes'
import { JobsContext } from './jobsContext'

const LIST_POLL_MS = 5000

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const loadedRef = useRef(false)

  const refresh = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    if (!loadedRef.current) setLoading(true)
    try {
      const nextJobs = await listJobs({ signal: controller.signal })
      if (!controller.signal.aborted) {
        setJobs(nextJobs)
        setError(null)
        loadedRef.current = true
        setLoading(false)
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(jobErrorMessage(requestError))
        loadedRef.current = true
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void refresh()
    return () => controllerRef.current?.abort()
  }, [refresh])

  const hasActiveJobs = jobs.some((job) => !isTerminalJobStatus(job.status))
  useEffect(() => {
    if (!hasActiveJobs) return
    const timeoutId = window.setTimeout(() => void refresh(), LIST_POLL_MS)
    return () => window.clearTimeout(timeoutId)
  }, [hasActiveJobs, jobs, refresh])

  const value = useMemo(() => ({ jobs, loading, error, refresh }), [error, jobs, loading, refresh])
  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>
}
