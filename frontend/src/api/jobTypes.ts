export const FIXED_RC_TEMPLATE_ID = 'rc_lowpass_fixed_v1' as const
export const PARAM_RC_TEMPLATE_ID = 'rc_lowpass_param_v1' as const
export const CUSTOM_XYCE_TEMPLATE_ID = 'custom_xyce_netlist_v1' as const
export const SKY130_TEMPLATE_ID = 'sky130_floating_bulk_v1' as const
export type JobTemplateId =
  | typeof FIXED_RC_TEMPLATE_ID
  | typeof PARAM_RC_TEMPLATE_ID
  | typeof CUSTOM_XYCE_TEMPLATE_ID
  | typeof SKY130_TEMPLATE_ID

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
  temperature_celsius?: number | null
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
  temperature_celsius: number
}

// Mirrors backend Sky130FloatingBulkParameters exactly (extra='forbid' there too).
// device/corner kept as literal unions so the allowlist is visible at the type level.
export interface Sky130FloatingBulkParameters {
  device: 'sky130_fd_pr__nfet_g5v0d10v5'
  corner: 'tt'
  l_um: number
  w_um: number
  nf: number
  iin_a: number
  cpar_f: number
  rgate_ohm: number
  rbulk_ohm: number
  cgate_f: number
  cbulk_f: number
  temperature_celsius: number
  tstop_seconds: number
  output_interval_seconds: number
}

export const SKY130_DEFAULTS: Sky130FloatingBulkParameters = {
  device: 'sky130_fd_pr__nfet_g5v0d10v5',
  corner: 'tt',
  l_um: 0.5,
  w_um: 1,
  nf: 1,
  iin_a: 100e-9,
  cpar_f: 1e-12,
  rgate_ohm: 1e14,
  rbulk_ohm: 1e14,
  cgate_f: 1e-15,
  cbulk_f: 10e-15,
  temperature_celsius: 27,
  tstop_seconds: 1e-3,
  output_interval_seconds: 50e-9,
}

export interface Sky130JobCreateRequest {
  name: string
  template_id: typeof SKY130_TEMPLATE_ID
  sky130_parameters: Sky130FloatingBulkParameters
}

export interface NetlistPreflight {
  valid: true
  analysis: 'tran' | 'dc' | 'ac'
  devices: number
  nodes: number
  models: number
  subcircuits: number
  outputs: string[]
  temperature_celsius: number
  sandbox_ready: boolean
  netlist?: string | null
}

export interface ArtifactListResponse {
  artifacts: ArtifactInfo[]
}

export function isTerminalJobStatus(status: JobStatus): status is TerminalJobStatus {
  return status === 'succeeded' || status === 'failed' || status === 'timed_out'
}
