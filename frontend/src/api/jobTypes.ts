export const FIXED_RC_TEMPLATE_ID = 'rc_lowpass_fixed_v1' as const
export const PARAM_RC_TEMPLATE_ID = 'rc_lowpass_param_v1' as const
export const CUSTOM_XYCE_TEMPLATE_ID = 'custom_xyce_netlist_v1' as const
export type JobTemplateId =
  typeof FIXED_RC_TEMPLATE_ID | typeof PARAM_RC_TEMPLATE_ID | typeof CUSTOM_XYCE_TEMPLATE_ID

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'timed_out'
export type TerminalJobStatus = 'succeeded' | 'failed' | 'timed_out'

export interface ArtifactInfo {
  filename: 'waveform.csv' | 'results.csv'
  content_type: 'text/csv'
  size_bytes: number
}

export interface RcParameters {
  resistance_ohms: number
  capacitance_farads: number
  input_voltage_volts: number
  duration_seconds: number
}

export interface DerivedMetrics {
  time_constant_seconds: number
}

export interface JobSummary {
  status: TerminalJobStatus
  simulator: 'xyce'
  template: JobTemplateId
  samples: number | null
  duration_seconds: number | null
  elapsed_seconds: number | null
  error: string | null
  artifacts: ArtifactInfo[]
  parameters?: RcParameters | null
  derived?: DerivedMetrics | null
  analysis?: 'tran' | 'dc' | 'ac' | null
  columns?: string[] | null
}

export interface Job {
  job_id: string
  name: string
  template_id: JobTemplateId
  simulator: 'xyce'
  status: JobStatus
  created_at: string
  updated_at: string
  summary: JobSummary | null
  parameters?: RcParameters | null
  derived?: DerivedMetrics | null
}

export interface JobListResponse {
  jobs: Job[]
}

export interface FixedJobCreateRequest {
  name: string
  template_id: typeof FIXED_RC_TEMPLATE_ID
}

export interface ParameterizedJobCreateRequest {
  name: string
  template_id: typeof PARAM_RC_TEMPLATE_ID
  parameters: RcParameters
}

export type JobCreateRequest = FixedJobCreateRequest | ParameterizedJobCreateRequest

export interface CustomJobCreateRequest {
  name: string
  template_id: typeof CUSTOM_XYCE_TEMPLATE_ID
  netlist: string
  requested_outputs: string[]
}

export interface NetlistPreflight {
  valid: true
  analysis: 'tran' | 'dc' | 'ac'
  devices: number
  nodes: number
  models: number
  subcircuits: number
  outputs: string[]
  sandbox_ready: boolean
}

export interface ArtifactListResponse {
  artifacts: ArtifactInfo[]
}

export function isTerminalJobStatus(status: JobStatus): status is TerminalJobStatus {
  return status === 'succeeded' || status === 'failed' || status === 'timed_out'
}
