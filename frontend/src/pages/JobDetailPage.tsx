import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import type { WaveformPoint } from '../api/waveform'
import { calculateWaveformMetrics, fetchWaveform } from '../api/waveform'
import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/feedback/LoadingState'
import { ErrorState } from '../components/feedback/ErrorState'
import { FixedJobStatusBadge } from '../features/jobs/FixedJobStatusBadge'
import { ResultChart } from '../components/charts/ResultChart'
import { useJob } from '../hooks/useJobs'
import { formatBytes, formatDateTime } from '../utils/format'

function jobStatusMessage(status: string): string | null {
  if (status === 'queued') return 'Trabajo en cola.'
  if (status === 'running') return 'Xyce está ejecutando la simulación.'
  if (status === 'failed') return 'La simulación no pudo completarse.'
  if (status === 'timed_out') return 'La simulación excedió el tiempo permitido.'
  return null
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { job, loading, error, refresh } = useJob(jobId)
  const [waveform, setWaveform] = useState<WaveformPoint[] | null>(null)
  const [waveformError, setWaveformError] = useState<string | null>(null)
  const [waveformLoading, setWaveformLoading] = useState(false)
  const hasWaveform =
    job?.summary?.artifacts.some((artifact) => artifact.filename === 'waveform.csv') ?? false

  useEffect(() => {
    if (!job || job.status !== 'succeeded' || !hasWaveform) return
    const controller = new AbortController()
    setWaveformLoading(true)
    setWaveformError(null)
    void fetchWaveform(job.job_id, { signal: controller.signal })
      .then((points) => {
        if (!controller.signal.aborted) setWaveform(points)
      })
      .catch(() => {
        if (!controller.signal.aborted) setWaveformError('No fue posible cargar waveform.csv.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setWaveformLoading(false)
      })
    return () => controller.abort()
  }, [hasWaveform, job])

  const metrics = useMemo(() => (waveform ? calculateWaveformMetrics(waveform) : null), [waveform])

  if (loading) return <LoadingState label="Cargando trabajo…" />
  if (error || !job) {
    return (
      <ErrorState
        title="Trabajo no disponible"
        description={error ?? 'Trabajo no encontrado.'}
        onRetry={() => void refresh()}
      />
    )
  }

  const statusMessage = jobStatusMessage(job.status)
  const artifact = job.summary?.artifacts.find((item) => item.filename === 'waveform.csv')
  const shortJobId = `${job.job_id.slice(0, 12)}…`

  return (
    <div>
      <PageHeader
        title={job.name}
        subtitle={`Trabajo ${shortJobId} · Xyce · plantilla RC fija`}
        actions={<FixedJobStatusBadge status={job.status} />}
      />

      {statusMessage && (
        <p className="fixed-job-boundary" role="status">
          {statusMessage}
        </p>
      )}

      <div className="fixed-job-summary-grid">
        <div className="fixed-job-stat">
          <span>Creado</span>
          <strong>{formatDateTime(job.created_at)}</strong>
        </div>
        <div className="fixed-job-stat">
          <span>Actualizado</span>
          <strong>{formatDateTime(job.updated_at)}</strong>
        </div>
        <div className="fixed-job-stat">
          <span>Muestras</span>
          <strong>{job.summary?.samples ?? '—'}</strong>
        </div>
        <div className="fixed-job-stat">
          <span>Duración simulada</span>
          <strong>
            {job.summary?.duration_seconds !== null && job.summary?.duration_seconds !== undefined
              ? `${(job.summary.duration_seconds * 1000).toFixed(3)} ms`
              : '—'}
          </strong>
        </div>
        <div className="fixed-job-stat">
          <span>Tiempo real</span>
          <strong>
            {job.summary?.elapsed_seconds !== null && job.summary?.elapsed_seconds !== undefined
              ? `${job.summary.elapsed_seconds.toFixed(3)} s`
              : '—'}
          </strong>
        </div>
        <div className="fixed-job-stat">
          <span>Simulador</span>
          <strong>Xyce</strong>
        </div>
        <div className="fixed-job-stat">
          <span>Plantilla</span>
          <strong>
            <code>{job.template_id}</code>
          </strong>
        </div>
        <div className="fixed-job-stat">
          <span>Artefacto</span>
          <strong>
            {artifact ? `${artifact.filename} · ${formatBytes(artifact.size_bytes)}` : '—'}
          </strong>
        </div>
      </div>

      {job.status === 'succeeded' && artifact && (
        <section aria-labelledby="waveform-heading">
          <div className="fixed-job-section-heading">
            <div>
              <h2 id="waveform-heading">Respuesta transitoria</h2>
              <p>Series reales V(in) y V(out), sin reducción de muestras.</p>
            </div>
            <a
              className="fixed-job-primary-button"
              href={`/api/jobs/${job.job_id}/artifacts/waveform.csv`}
              download
            >
              <Download size={16} aria-hidden="true" /> Descargar waveform.csv
            </a>
          </div>
          {waveformLoading ? (
            <LoadingState label="Validando waveform.csv…" />
          ) : waveformError ? (
            <ErrorState title="Gráfica no disponible" description={waveformError} />
          ) : waveform ? (
            <ResultChart points={waveform} />
          ) : null}
          {metrics && (
            <div className="fixed-job-summary-grid" aria-label="Resumen numérico del CSV">
              <div className="fixed-job-stat">
                <span>Salida final</span>
                <strong>{metrics.finalOutputVolts.toFixed(6)} V</strong>
              </div>
              <div className="fixed-job-stat">
                <span>Máximo V(in)</span>
                <strong>{metrics.maximumInputVolts.toFixed(6)} V</strong>
              </div>
              <div className="fixed-job-stat">
                <span>Máximo V(out)</span>
                <strong>{metrics.maximumOutputVolts.toFixed(6)} V</strong>
              </div>
              <div className="fixed-job-stat">
                <span>Muestras CSV</span>
                <strong>{metrics.samples}</strong>
              </div>
              <div className="fixed-job-stat">
                <span>Duración CSV</span>
                <strong>{(metrics.durationSeconds * 1000).toFixed(3)} ms</strong>
              </div>
            </div>
          )}
        </section>
      )}

      <p style={{ marginTop: 24 }}>
        <Link to="/jobs">Volver a trabajos</Link>
      </p>
    </div>
  )
}
