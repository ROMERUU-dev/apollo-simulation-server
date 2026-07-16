import { CirclePlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { BlueprintButton } from '../components/layout/BlueprintButton'
import { LoadingState } from '../components/feedback/LoadingState'
import { ErrorState } from '../components/feedback/ErrorState'
import { EmptyState } from '../components/feedback/EmptyState'
import { useServerStatus } from '../hooks/useServerStatus'
import { useJobs } from '../hooks/useJobs'
import { useProjects } from '../hooks/useProjects'
import { useResults } from '../hooks/useResults'
import { ResourceMeter } from '../features/server/ResourceMeter'
import { SimulatorAvailabilityCard } from '../features/server/SimulatorAvailabilityCard'
import { JobListItem } from '../features/jobs/JobListItem'
import { ProjectListItemCompact } from '../features/projects/ProjectListItemCompact'
import { ResultListItemCompact } from '../features/results/ResultListItemCompact'
import { formatBytes } from '../utils/format'

export default function HomePage() {
  const navigate = useNavigate()
  const { status, loading: statusLoading, error: statusError, refresh } = useServerStatus()
  const { jobs, loading: jobsLoading } = useJobs()
  const { projects, loading: projectsLoading } = useProjects({
    status: 'active',
    sortField: 'updatedAt',
    sortDirection: 'desc',
  })
  const { results, loading: resultsLoading } = useResults()

  const activeAndQueuedJobs = jobs
    .filter((j) => j.status === 'running' || j.status === 'queued')
    .slice(0, 4)
  const recentProjects = projects.slice(0, 4)
  const recentResults = [...results]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)

  if (statusError) {
    return <ErrorState onRetry={refresh} />
  }

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle="Resumen del servidor y actividad reciente"
        actions={
          <BlueprintButton
            icon={<CirclePlus size={16} aria-hidden="true" />}
            onClick={() => navigate('/simulations/new')}
          >
            Nueva simulación
          </BlueprintButton>
        }
      />

      {statusLoading || !status ? (
        <LoadingState label="Cargando estado del servidor…" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 14,
            marginBottom: 26,
          }}
        >
          <ResourceMeter
            label="CPU"
            percent={status.resources.cpuThreadsUsedPct}
            detail={`${Math.round((status.resources.cpuThreadsUsedPct / 100) * status.resources.cpuThreadsTotal)} de ${status.resources.cpuThreadsTotal} hilos en uso`}
          />
          <ResourceMeter
            label="Memoria RAM"
            percent={(status.resources.ramUsedGb / status.resources.ramTotalGb) * 100}
            detail={`${status.resources.ramUsedGb.toFixed(1)} GB de ${status.resources.ramTotalGb} GB`}
          />
          <ResourceMeter
            label="Almacenamiento"
            percent={(status.resources.storageUsedGb / status.resources.storageTotalGb) * 100}
            detail={`${formatBytes((status.resources.storageTotalGb - status.resources.storageUsedGb) * 1024 ** 3)} libres`}
          />
          <SimulatorAvailabilityCard simulators={status.simulators} />
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
            <a
              href="/jobs"
              onClick={(e) => {
                e.preventDefault()
                navigate('/jobs')
              }}
              style={{ fontSize: 13 }}
            >
              Ver todos →
            </a>
          </div>
          <div style={{ border: '1px solid var(--color-divider)' }}>
            {jobsLoading ? (
              <LoadingState label="Cargando trabajos…" />
            ) : activeAndQueuedJobs.length === 0 ? (
              <EmptyState
                title="Sin trabajos activos"
                description="No hay simulaciones en ejecución ni en cola."
              />
            ) : (
              <ul style={{ margin: 0, padding: 0 }}>
                {activeAndQueuedJobs.map((job) => (
                  <JobListItem key={job.id} job={job} />
                ))}
              </ul>
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
              ) : recentProjects.length === 0 ? (
                <EmptyState
                  title="Sin proyectos"
                  description="Crea tu primer proyecto para comenzar."
                />
              ) : (
                <ul style={{ margin: 0, padding: 0 }}>
                  {recentProjects.map((project) => (
                    <ProjectListItemCompact key={project.id} project={project} />
                  ))}
                </ul>
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
              ) : recentResults.length === 0 ? (
                <EmptyState
                  title="Sin resultados"
                  description="Los resultados aparecerán aquí al completarse simulaciones."
                />
              ) : (
                <ul style={{ margin: 0, padding: 0 }}>
                  {recentResults.map((result) => (
                    <ResultListItemCompact key={result.id} result={result} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
