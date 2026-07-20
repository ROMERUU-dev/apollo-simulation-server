import { CheckCircle2, CircleDashed, ClockAlert, LoaderCircle, XCircle } from 'lucide-react'
import type { JobStatus } from '../../api/jobTypes'
import styles from '../../components/feedback/StatusBadge.module.css'
import { JOB_STATUS_LABEL } from './fixedJobStatus'

const toneClass = {
  ok: styles.ok,
  warn: styles.warn,
  bad: styles.bad,
  neutral: styles.neutral,
} as const

const STATUS_CONFIG = {
  queued: { label: JOB_STATUS_LABEL.queued, tone: 'neutral', icon: CircleDashed },
  running: { label: JOB_STATUS_LABEL.running, tone: 'warn', icon: LoaderCircle },
  succeeded: { label: JOB_STATUS_LABEL.succeeded, tone: 'ok', icon: CheckCircle2 },
  failed: { label: JOB_STATUS_LABEL.failed, tone: 'bad', icon: XCircle },
  timed_out: { label: JOB_STATUS_LABEL.timed_out, tone: 'bad', icon: ClockAlert },
} as const satisfies Record<
  JobStatus,
  { label: string; tone: keyof typeof toneClass; icon: typeof CheckCircle2 }
>

export function FixedJobStatusBadge({ status }: { status: JobStatus }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <span className={`${styles.badge} ${toneClass[config.tone]}`}>
      <Icon size={12} aria-hidden="true" className={status === 'running' ? 'spin' : undefined} />
      {config.label}
    </span>
  )
}
