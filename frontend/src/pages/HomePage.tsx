import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/feedback/LoadingState'
import { ErrorState } from '../components/feedback/ErrorState'
import { EmptyState } from '../components/feedback/EmptyState'
import { useJobs } from '../hooks/useJobs'
import { useProjects } from '../hooks/useProjects'
import { useResults } from '../hooks/useResults'
import { useSession } from '../session/useSession'

export default function HomePage() {
  const {
    identity,
    health,
    loading: sessionLoading,
    error: sessionError,
    refreshHealth,
  } = useSession()
  const { jobs, loading: jobsLoading } = useJobs()
  const { projects, loading: projectsLoading } = useProjects({
    status: 'active',
    sortField: 'updatedAt',
    sortDirection: 'desc',
  })
  const { results, loading: resultsLoading } = useResults()

  if (sessionError) {
    return (
      <ErrorState
        title="Sesión no disponible"
        description={sessionError}
        onRetry={() => {
          window.location.reload()
        }}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle="Backend conectado · Ejecución de simulaciones próximamente"
      />

      {sessionLoading ? (
        <LoadingState label="Cargando sesión…" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 14,
            marginBottom: 26,
          }}
        >
          {[
            { label: 'API', value: health?.status === 'ok' ? 'Conectada' : 'No disponible' },
            { label: 'Sesión', value: identity?.email ?? 'No identificada' },
            {
              label: 'Envío de trabajos',
              value:
                health?.features.job_submission === 'not_available'
                  ? 'Aún no habilitado'
                  : 'Disponible',
            },
            { label: 'Ejecución', value: 'Próximamente' },
          ].map((item) => (
            <div key={item.label} className="card">
              <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.55 }}>
                {item.label}
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, marginTop: 8 }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, alignItems: 'start' }}
      >
        <section aria-labelledby="jobs-heading">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <h2 id="jobs-heading" style={{ fontSize: 17 }}>
              Trabajos activos y en cola
            </h2>
            <button
              type="button"
              onClick={refreshHealth}
              className="card"
              style={{ cursor: 'pointer' }}
            >
              Actualizar API
            </button>
          </div>
          <div style={{ border: '1px solid var(--color-divider)' }}>
            {jobsLoading ? (
              <LoadingState label="Cargando trabajos…" />
            ) : jobs.length === 0 ? (
              <EmptyState
                title="Trabajos reales: 0"
                description="La ejecución real aún no está habilitada."
              />
            ) : (
              <EmptyState title="Trabajos reales: 0" />
            )}
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section aria-labelledby="projects-heading">
            <h2 id="projects-heading" style={{ fontSize: 17, marginBottom: 10 }}>
              Proyectos recientes
            </h2>
            <div style={{ border: '1px solid var(--color-divider)', padding: '0 10px' }}>
              {projectsLoading ? (
                <LoadingState label="Cargando proyectos…" />
              ) : projects.length === 0 ? (
                <EmptyState
                  title="Proyectos reales: 0"
                  description="La creación de proyectos se habilitará con el motor de simulación."
                />
              ) : (
                <EmptyState title="Proyectos reales: 0" />
              )}
            </div>
          </section>

          <section aria-labelledby="results-heading">
            <h2 id="results-heading" style={{ fontSize: 17, marginBottom: 10 }}>
              Simulaciones recientes
            </h2>
            <div style={{ border: '1px solid var(--color-divider)', padding: '0 10px' }}>
              {resultsLoading ? (
                <LoadingState label="Cargando resultados…" />
              ) : results.length === 0 ? (
                <EmptyState
                  title="Resultados reales: 0"
                  description="No hay resultados reales porque la ejecución todavía no está habilitada."
                />
              ) : (
                <EmptyState title="Resultados reales: 0" />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
