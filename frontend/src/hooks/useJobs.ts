import { useCallback, useEffect, useState } from 'react'
import { jobService } from '../services'
import type { SimulationJob } from '../types'

export function useJobs() {
  const [jobs, setJobs] = useState<SimulationJob[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    jobService.list().then((list) => {
      setJobs(list)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    refresh()
    return jobService.subscribe(refresh)
  }, [refresh])

  return { jobs, loading, refresh }
}

export function useJob(jobId: string | undefined) {
  const [job, setJob] = useState<SimulationJob | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!jobId) {
      setJob(null)
      setLoading(false)
      return
    }
    jobService.get(jobId).then((result) => {
      setJob(result)
      setLoading(false)
    })
  }, [jobId])

  useEffect(() => {
    refresh()
    return jobService.subscribe(refresh)
  }, [refresh])

  return { job, loading, refresh }
}
