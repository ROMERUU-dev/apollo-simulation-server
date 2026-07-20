export const FIXED_RC_TEMPLATE_ID = 'rc_lowpass_fixed_v1' as const

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'timed_out'
export type TerminalJobStatus = 'succeeded' | 'failed' | 'timed_out'

export interface ArtifactInfo {
  filename: 'waveform.csv'
  content_type: 'text/csv'
  size_bytes: number
}

export interface JobSummary {
  status: TerminalJobStatus
  simulator: 'xyce'
  template: typeof FIXED_RC_TEMPLATE_ID
  samples: number | null
  duration_seconds: number | null
  elapsed_seconds: number | null
  error: string | null
  artifacts: ArtifactInfo[]
}

export interface Job {
  job_id: string
  name: string
  template_id: typeof FIXED_RC_TEMPLATE_ID
  simulator: 'xyce'
  status: JobStatus
  created_at: string
  updated_at: string
  summary: JobSummary | null
}

export interface JobListResponse {
  jobs: Job[]
}

export interface JobCreateRequest {
  name: string
  template_id: typeof FIXED_RC_TEMPLATE_ID
}

export interface ArtifactListResponse {
  artifacts: ArtifactInfo[]
}

export function isTerminalJobStatus(status: JobStatus): status is TerminalJobStatus {
  return status === 'succeeded' || status === 'failed' || status === 'timed_out'
}
