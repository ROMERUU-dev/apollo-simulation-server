import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LineChart } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/feedback/LoadingState'
import { ErrorState } from '../components/feedback/ErrorState'
import { ConfirmDialog } from '../components/feedback/ConfirmDialog'
import { JobStatusBadge } from '../components/feedback/StatusBadge'
import { useJob } from '../hooks/useJobs'
import { jobService, resultService } from '../services'
import { JobProgressBar } from '../features/jobs/JobProgressBar'
import { LiveLogPanel } from '../features/jobs/LiveLogPanel'
import { formatDuration } from '../utils/format'

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { job, loading, refresh } = useJob(jobId)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  if (loading) return <LoadingState label="Cargando trabajo…" />
  if (!job) {
    return (
      <ErrorState
        title="Trabajo no encontrado"
        description="Es posible que haya sido eliminado. Vuelve a la cola de trabajos."
        onRetry={() => navigate('/jobs')}
      />
    )
  }

  async function handleCancel() {
    if (!job) return
    await jobService.cancel(job.id)
    setConfirmingCancel(false)
    refresh()
  }

  async function handleViewResults() {
    if (!job) return
    const result = await resultService.getByJobId(job.id)
    if (result) navigate(`/results/${result.id}`)
  }

  const metrics = [
    { label: 'Corridas totales', value: job.totalRuns },
    { label: 'Completadas', value: job.completedRuns },
    { label: 'Activas', value: job.activeRuns },
    { label: 'Fallidas', value: job.failedRuns },
    { label: 'Tiempo transcurrido', value: formatDuration(job.elapsedSeconds) },
    { label: 'CPU', value: `${Math.round(job.cpuPct)}%` },
    { label: 'Memoria', value: `${(job.memoryMb / 1024).toFixed(1)} GB` },
    { label: 'Worker', value: job.workerName },
  ]

  return (
    <div>
      <PageHeader
        title={job.name}
        subtitle={`${job.projectName} · ${job.simulatorId === 'xyce' ? 'Xyce' : 'ngspice'}`}
        actions={
          <>
            <JobStatusBadge status={job.status} />
            {job.status === 'completed' && (
              <button
                type="button"
                onClick={handleViewResults}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              >
                <LineChart size={15} aria-hidden="true" /> Ver resultados
              </button>
            )}
            {(job.status === 'queued' || job.status === 'running') && (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    color: 'var(--status-bad)',
                  }}
                >
                  Cancelar
                </button>
              </>
            )}
          </>
        }
      />

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
            marginBottom: 6,
          }}
        >
          <span>Progreso general</span>
          <span>{job.progressPct}%</span>
        </div>
        <JobProgressBar percent={job.progressPct} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {metrics.map((metric) => (
          <div key={metric.label} className="card">
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                opacity: 0.55,
                marginBottom: 6,
              }}
            >
              {metric.label}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600 }}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>Registro en vivo</h2>
      <LiveLogPanel logs={job.logs} />

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancelar trabajo"
        description={`¿Seguro que deseas cancelar "${job.name}"? Las corridas en progreso se detendrán.`}
        confirmLabel="Cancelar trabajo"
        tone="danger"
        onConfirm={handleCancel}
        onCancel={() => setConfirmingCancel(false)}
      />
    </div>
  )
}
