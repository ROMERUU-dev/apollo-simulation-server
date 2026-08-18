import { Link } from 'react-router-dom'
import { LineChart } from 'lucide-react'
import { EmptyState } from '../components/feedback/EmptyState'
import { ErrorState } from '../components/feedback/ErrorState'
import { LoadingState } from '../components/feedback/LoadingState'
import { PageHeader } from '../components/layout/PageHeader'
import { useJobs } from '../hooks/useJobs'
import { formatDateTime } from '../utils/format'

export default function ResultsIndexPage() {
  const { jobs, loading, error, refresh } = useJobs()
  const completed = jobs.filter(
    (job) =>
      job.status === 'succeeded' &&
      job.summary !== null &&
      job.summary.artifacts.some((artifact) =>
        ['waveform.csv', 'results.csv'].includes(artifact.filename),
      ),
  )

  return (
    <div>
      <PageHeader
        title="Resultados"
        subtitle="Resultados Xyce validados y simulaciones RC heredadas"
      />
      {loading ? (
        <LoadingState label="Cargando resultados…" />
      ) : error ? (
        <ErrorState
          title="No se pudieron cargar los resultados"
          description={error}
          onRetry={() => void refresh()}
        />
      ) : completed.length === 0 ? (
        <EmptyState title="Aún no tienes simulaciones completadas." />
      ) : (
        <ul style={{ margin: 0, padding: 0, border: '1px solid var(--color-divider)' }}>
          {completed.map((job) => (
            <li
              key={job.job_id}
              style={{ listStyle: 'none', borderBottom: '1px solid var(--color-divider)' }}
            >
              <Link
                to={`/jobs/${job.job_id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <LineChart
                  size={18}
                  aria-hidden="true"
                  style={{ color: 'var(--color-accent-700)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{job.name}</strong>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    {formatDateTime(job.created_at)} · {job.summary?.samples ?? '—'} muestras ·{' '}
                    {job.summary?.duration_seconds !== null
                      ? `${((job.summary?.duration_seconds ?? 0) * 1000).toFixed(3)} ms`
                      : '—'}
                  </div>
                </div>
                <span>Ver gráfica</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
