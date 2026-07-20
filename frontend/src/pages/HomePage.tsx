import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/feedback/LoadingState'
import { ErrorState } from '../components/feedback/ErrorState'
import { EmptyState } from '../components/feedback/EmptyState'
import { FixedJobStatusBadge } from '../features/jobs/FixedJobStatusBadge'
import { useJobs } from '../hooks/useJobs'
import { useSession } from '../session/useSession'

export default function HomePage() {
  const {
    identity,
    health,
    loading: sessionLoading,
    error: sessionError,
    refreshHealth,
  } = useSession()
  const { jobs, loading: jobsLoading, error: jobsError, refresh } = useJobs()
  const activeJobs = jobs.filter((job) => job.status === 'queued' || job.status === 'running')
  const completedJobs = jobs.filter((job) => job.status === 'succeeded')
  const submissionAvailable = health?.features.custom_netlists === 'available'

  if (sessionError) {
    return (
      <ErrorState
        title="Sesión no disponible"
        description={sessionError}
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <div>
      <PageHeader title="Inicio" subtitle="Backend conectado · Simulación Xyce controlada" />
      {sessionLoading ? (
        <LoadingState label="Cargando sesión…" />
      ) : (
        <div className="fixed-job-summary-grid">
          <div className="fixed-job-stat">
            <span>Backend</span>
            <strong>{health?.status === 'ok' ? 'Conectado' : 'No disponible'}</strong>
          </div>
          <div className="fixed-job-stat">
            <span>Sesión</span>
            <strong>{identity?.name?.trim() || identity?.email || 'No disponible'}</strong>
          </div>
          <div className="fixed-job-stat">
            <span>Envío de trabajos</span>
            <strong>{submissionAvailable ? 'Disponible' : 'Temporalmente no disponible'}</strong>
          </div>
          <div className="fixed-job-stat">
            <span>Ejecución</span>
            <strong>Xyce · runner rootless aislado</strong>
          </div>
          <div className="fixed-job-stat">
            <span>Trabajos activos</span>
            <strong>{activeJobs.length}</strong>
          </div>
          <div className="fixed-job-stat">
            <span>Simulaciones completadas</span>
            <strong>{completedJobs.length}</strong>
          </div>
        </div>
      )}

      <p className="fixed-job-boundary">
        Las simulaciones RC anteriores permanecen disponibles como historial de solo lectura.
      </p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          margin: '26px 0 10px',
        }}
      >
        <h2 style={{ fontSize: 18 }}>Actividad reciente</h2>
        <button
          type="button"
          className="fixed-job-secondary-button"
          onClick={() => {
            void refresh()
            void refreshHealth()
          }}
        >
          <RefreshCw size={15} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {jobsLoading ? (
        <LoadingState label="Cargando trabajos…" />
      ) : jobsError ? (
        <ErrorState
          title="No se pudo cargar la actividad"
          description={jobsError}
          onRetry={() => void refresh()}
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          title="Aún no tienes trabajos"
          action={<Link to="/simulations/new">Nueva netlist</Link>}
        />
      ) : (
        <ul style={{ margin: 0, padding: 0, border: '1px solid var(--color-divider)' }}>
          {jobs.slice(0, 6).map((job) => (
            <li
              key={job.job_id}
              style={{
                listStyle: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderBottom: '1px solid var(--color-divider)',
              }}
            >
              <div style={{ flex: 1 }}>
                <Link to={`/jobs/${job.job_id}`}>{job.name}</Link>
                <div style={{ fontSize: 12, opacity: 0.6 }}>Xyce · {job.template_id}</div>
              </div>
              <FixedJobStatusBadge status={job.status} />
            </li>
          ))}
        </ul>
      )}

      <section style={{ marginTop: 26 }} aria-labelledby="projects-heading">
        <h2 id="projects-heading" style={{ fontSize: 18, marginBottom: 10 }}>
          Proyectos
        </h2>
        <EmptyState
          title="Persistencia de proyectos no disponible"
          description="Los trabajos de simulación se almacenan directamente en colas internas."
        />
      </section>
    </div>
  )
}
