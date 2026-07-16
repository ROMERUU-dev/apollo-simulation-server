import { Link } from 'react-router-dom'
import type { SimulationJob } from '../../types'
import { JobStatusBadge } from '../../components/feedback/StatusBadge'
import { JobProgressBar } from './JobProgressBar'

export function JobListItem({ job }: { job: SimulationJob }) {
  return (
    <li
      style={{
        listStyle: 'none',
        padding: '10px 14px',
        borderBottom: '1px solid var(--color-divider)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
      >
        <Link to={`/jobs/${job.id}`} style={{ fontWeight: 600, fontSize: 13.5 }}>
          {job.name}
        </Link>
        <JobStatusBadge status={job.status} />
      </div>
      <div style={{ fontSize: 12, opacity: 0.65 }}>{job.projectName}</div>
      <JobProgressBar percent={job.progressPct} />
      <div style={{ fontSize: 11.5, opacity: 0.6 }}>
        {job.completedRuns} / {job.totalRuns} corridas
      </div>
    </li>
  )
}
