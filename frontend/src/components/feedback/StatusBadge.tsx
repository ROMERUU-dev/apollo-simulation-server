import type { ReactNode } from 'react'
import { Ban, CheckCircle2, CircleDashed, LoaderCircle, XCircle } from 'lucide-react'
import type { JobStatus } from '../../types'
import styles from './StatusBadge.module.css'

const JOB_STATUS_CONFIG: Record<
  JobStatus,
  { label: string; tone: keyof typeof toneClass; icon: typeof CheckCircle2 }
> = {
  queued: { label: 'En cola', tone: 'neutral', icon: CircleDashed },
  running: { label: 'Ejecutando', tone: 'warn', icon: LoaderCircle },
  completed: { label: 'Completado', tone: 'ok', icon: CheckCircle2 },
  failed: { label: 'Fallido', tone: 'bad', icon: XCircle },
  cancelled: { label: 'Cancelado', tone: 'neutral', icon: Ban },
}

const toneClass = {
  ok: styles.ok,
  warn: styles.warn,
  bad: styles.bad,
  neutral: styles.neutral,
} as const

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const config = JOB_STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <span className={`${styles.badge} ${toneClass[config.tone]}`}>
      <Icon size={12} aria-hidden="true" className={status === 'running' ? 'spin' : undefined} />
      {config.label}
    </span>
  )
}

export function ToneBadge({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'neutral'
  icon: typeof CheckCircle2
  children: ReactNode
}) {
  return (
    <span className={`${styles.badge} ${toneClass[tone]}`}>
      <Icon size={12} aria-hidden="true" />
      {children}
    </span>
  )
}
