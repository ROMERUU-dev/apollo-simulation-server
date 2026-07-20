import { createContext } from 'react'
import type { Job } from '../api/jobTypes'

export interface JobsContextValue {
  jobs: Job[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export const JobsContext = createContext<JobsContextValue | null>(null)
