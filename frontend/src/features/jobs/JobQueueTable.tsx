import { useNavigate } from 'react-router-dom'
import { Copy, FolderOpen, RotateCcw, Trash2, XCircle } from 'lucide-react'
import type { SimulationJob } from '../../types'
import { JobStatusBadge } from '../../components/feedback/StatusBadge'
import { OverflowMenu, type OverflowMenuAction } from '../../components/navigation/OverflowMenu'
import { JobProgressBar } from './JobProgressBar'
import { formatDateTime, formatDuration } from '../../utils/format'

interface JobQueueTableProps {
  jobs: SimulationJob[]
  onCancel: (job: SimulationJob) => void
  onRetry: (job: SimulationJob) => void
  onDuplicate: (job: SimulationJob) => void
  onDelete: (job: SimulationJob) => void
}

export function JobQueueTable({
  jobs,
  onCancel,
  onRetry,
  onDuplicate,
  onDelete,
}: JobQueueTableProps) {
  const navigate = useNavigate()

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-divider)' }}>
            <th style={{ padding: '8px 6px' }}>Trabajo</th>
            <th style={{ padding: '8px 6px' }}>Proyecto</th>
            <th style={{ padding: '8px 6px' }}>Estado</th>
            <th style={{ padding: '8px 6px' }}>Progreso</th>
            <th style={{ padding: '8px 6px' }}>Corridas</th>
            <th style={{ padding: '8px 6px' }}>Creado</th>
            <th style={{ padding: '8px 6px' }} aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const actions: OverflowMenuAction[] = [
              {
                label: 'Abrir',
                icon: <FolderOpen size={14} aria-hidden="true" />,
                onSelect: () => navigate(`/jobs/${job.id}`),
              },
            ]
            if (job.status === 'queued' || job.status === 'running') {
              actions.push({
                label: 'Cancelar',
                icon: <XCircle size={14} aria-hidden="true" />,
                onSelect: () => onCancel(job),
                danger: true,
              })
            }
            if (job.status === 'failed' || job.status === 'cancelled') {
              actions.push({
                label: 'Reintentar',
                icon: <RotateCcw size={14} aria-hidden="true" />,
                onSelect: () => onRetry(job),
              })
            }
            actions.push({
              label: 'Duplicar',
              icon: <Copy size={14} aria-hidden="true" />,
              onSelect: () => onDuplicate(job),
            })
            if (job.status !== 'running') {
              actions.push({
                label: 'Eliminar',
                icon: <Trash2 size={14} aria-hidden="true" />,
                onSelect: () => onDelete(job),
                danger: true,
              })
            }

            return (
              <tr key={job.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                <td style={{ padding: '8px 6px' }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--color-accent-700)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      textAlign: 'left',
                    }}
                  >
                    {job.name}
                  </button>
                </td>
                <td style={{ padding: '8px 6px', opacity: 0.75 }}>{job.projectName}</td>
                <td style={{ padding: '8px 6px' }}>
                  <JobStatusBadge status={job.status} />
                </td>
                <td style={{ padding: '8px 6px', minWidth: 140 }}>
                  <JobProgressBar percent={job.progressPct} />
                </td>
                <td style={{ padding: '8px 6px', opacity: 0.75 }}>
                  {job.completedRuns}/{job.totalRuns}
                  {job.failedRuns > 0 && (
                    <span style={{ color: 'var(--status-bad)' }}> ({job.failedRuns} fallidas)</span>
                  )}
                </td>
                <td style={{ padding: '8px 6px', opacity: 0.65, whiteSpace: 'nowrap' }}>
                  {formatDateTime(job.createdAt)}
                  {job.elapsedSeconds > 0 && (
                    <div style={{ fontSize: 11 }}>
                      {formatDuration(job.elapsedSeconds)} transcurrido
                    </div>
                  )}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                  <OverflowMenu label={`Acciones para ${job.name}`} actions={actions} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
