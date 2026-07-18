import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/feedback/LoadingState'
import { EmptyState } from '../components/feedback/EmptyState'
import { useJobs } from '../hooks/useJobs'

export default function JobsPage() {
  const { jobs, loading } = useJobs()

  return (
    <div>
      <PageHeader
        title="Trabajos"
        subtitle="Cola de simulaciones en curso, completadas y fallidas"
      />

      {loading ? (
        <LoadingState label="Cargando trabajos…" />
      ) : jobs.length === 0 ? (
        <EmptyState
          title="Sin trabajos reales"
          description="La ejecución de simulaciones aún no está habilitada."
        />
      ) : (
        <EmptyState title="Sin trabajos reales" />
      )}
    </div>
  )
}
