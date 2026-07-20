import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/feedback/LoadingState'
import { ErrorState } from '../components/feedback/ErrorState'
import { EmptyState } from '../components/feedback/EmptyState'
import { FixedJobStatusBadge } from '../features/jobs/FixedJobStatusBadge'
import { jobTemplateLabel } from '../features/jobs/jobTemplate'
import { useJobs } from '../hooks/useJobs'
import { formatDateTime } from '../utils/format'

function seconds(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${(value * 1000).toFixed(3)} ms`
}

export default function JobsPage() {
  const { jobs, loading, error, refresh } = useJobs()

  return (
    <div>
      <PageHeader
        title="Trabajos"
        subtitle="Cola persistente de simulaciones RC autorizadas"
        actions={
          <button
            type="button"
            className="fixed-job-secondary-button"
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} aria-hidden="true" /> Actualizar
          </button>
        }
      />

      {loading ? (
        <LoadingState label="Cargando trabajos…" />
      ) : error ? (
        <ErrorState
          title="No se pudieron cargar los trabajos"
          description={error}
          onRetry={() => void refresh()}
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          title="Aún no tienes trabajos"
          description="Ejecuta la prueba RC fija para verla en esta cola."
          action={<Link to="/simulations/new">Nueva simulación</Link>}
        />
      ) : (
        <div className="fixed-jobs-table-wrap">
          <table className="fixed-jobs-table">
            <thead>
              <tr>
                <th>Trabajo</th>
                <th>Estado</th>
                <th>Simulador</th>
                <th>Plantilla</th>
                <th>Creado</th>
                <th>Duración</th>
                <th>Muestras</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.job_id}>
                  <td>
                    <Link to={`/jobs/${job.job_id}`}>{job.name}</Link>
                  </td>
                  <td>
                    <FixedJobStatusBadge status={job.status} />
                  </td>
                  <td>Xyce</td>
                  <td>
                    <span>{jobTemplateLabel(job.template_id)}</span>
                    <br />
                    <code>{job.template_id}</code>
                  </td>
                  <td>{formatDateTime(job.created_at)}</td>
                  <td>{seconds(job.summary?.duration_seconds)}</td>
                  <td>{job.summary?.samples ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
