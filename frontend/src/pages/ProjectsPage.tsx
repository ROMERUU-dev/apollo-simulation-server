import { CirclePlus } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { BlueprintButton } from '../components/layout/BlueprintButton'
import { LoadingState } from '../components/feedback/LoadingState'
import { EmptyState } from '../components/feedback/EmptyState'
import { useProjects } from '../hooks/useProjects'

export default function ProjectsPage() {
  const { projects, loading } = useProjects()

  return (
    <div>
      <PageHeader
        title="Proyectos"
        subtitle="Organiza netlists, modelos y simulaciones por proyecto"
        actions={
          <BlueprintButton
            icon={<CirclePlus size={16} aria-hidden="true" />}
            onClick={() => {}}
            disabled
          >
            Nuevo proyecto
          </BlueprintButton>
        }
      />

      {loading ? (
        <LoadingState label="Cargando proyectos…" />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Todavía no tienes proyectos reales."
          description="La creación de proyectos se habilitará con el motor de simulación."
        />
      ) : (
        <EmptyState title="Todavía no tienes proyectos reales." />
      )}
    </div>
  )
}
