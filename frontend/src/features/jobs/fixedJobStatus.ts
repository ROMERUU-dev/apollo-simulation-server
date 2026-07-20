import type { JobStatus } from '../../api/jobTypes'

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  queued: 'En cola',
  running: 'Ejecutando',
  succeeded: 'Completado',
  failed: 'Fallido',
  timed_out: 'Tiempo agotado',
}
