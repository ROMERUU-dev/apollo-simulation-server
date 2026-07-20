import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getJob, jobErrorMessage } from '../api/jobsApi'
import { isTerminalJobStatus, type Job } from '../api/jobTypes'
import { JobsContext, type JobsContextValue } from './jobsContext'

const DETAIL_POLL_MS = 2000
const DETAIL_POLL_MAX_MS = 10 * 60 * 1000

export function useJobs(): JobsContextValue {
  const value = useContext(JobsContext)
  if (!value) throw new Error('JobsProvider is required')
  return value
}

export function useJob(jobId: string | undefined) {
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const pollingStartedRef = useRef(0)

  const refresh = useCallback(async () => {
    controllerRef.current?.abort()
    if (!jobId) {
      setJob(null)
      setLoading(false)
      setError('Trabajo no encontrado.')
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const nextJob = await getJob(jobId, { signal: controller.signal })
      if (!controller.signal.aborted) {
        setJob(nextJob)
        setError(null)
        setLoading(false)
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(jobErrorMessage(requestError))
        setLoading(false)
      }
    }
  }, [jobId])

  useEffect(() => {
    pollingStartedRef.current = Date.now()
    setLoading(true)
    setJob(null)
    setError(null)
    void refresh()
    return () => controllerRef.current?.abort()
  }, [jobId, refresh])

  const shouldPoll = job !== null && !isTerminalJobStatus(job.status)
  useEffect(() => {
    if (!shouldPoll || Date.now() - pollingStartedRef.current >= DETAIL_POLL_MAX_MS) return
    const timeoutId = window.setTimeout(() => void refresh(), DETAIL_POLL_MS)
    return () => window.clearTimeout(timeoutId)
  }, [job, refresh, shouldPoll])

  return { job, loading, error, refresh }
}
