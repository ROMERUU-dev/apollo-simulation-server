import { useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { BlueprintButton } from '../components/layout/BlueprintButton'
import { LoadingState } from '../components/feedback/LoadingState'
import { EmptyState } from '../components/feedback/EmptyState'
import { ConfirmDialog } from '../components/feedback/ConfirmDialog'
import { useProjects } from '../hooks/useProjects'
import { projectService } from '../services'
import type { CreateProjectInput } from '../services/types'
import type { Project, ProjectSortField, ProjectStatus, SortDirection } from '../types'
import { ProjectCard } from '../features/projects/ProjectCard'
import { ProjectFilters } from '../features/projects/ProjectFilters'
import { CreateProjectDialog } from '../features/projects/CreateProjectDialog'

export default function ProjectsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all')
  const [sortField, setSortField] = useState<ProjectSortField>('updatedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)

  const { projects, loading, refresh } = useProjects({ query, status, sortField, sortDirection })

  async function handleCreate(input: CreateProjectInput) {
    await projectService.create(input)
    setCreateOpen(false)
    refresh()
  }

  async function handleDuplicate(project: Project) {
    await projectService.duplicate(project.id)
    refresh()
  }

  async function handleArchive(project: Project) {
    await projectService.archive(project.id)
    refresh()
  }

  async function handleUnarchive(project: Project) {
    await projectService.unarchive(project.id)
    refresh()
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    await projectService.remove(pendingDelete.id)
    setPendingDelete(null)
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="Proyectos"
        subtitle="Organiza netlists, modelos y simulaciones por proyecto"
        actions={
          <BlueprintButton
            icon={<CirclePlus size={16} aria-hidden="true" />}
            onClick={() => setCreateOpen(true)}
          >
            Nuevo proyecto
          </BlueprintButton>
        }
      />

      <ProjectFilters
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(field, direction) => {
          setSortField(field)
          setSortDirection(direction)
        }}
      />

      {loading ? (
        <LoadingState label="Cargando proyectos…" />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No se encontraron proyectos"
          description="Ajusta los filtros de búsqueda o crea un nuevo proyecto."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar proyecto"
        description={`¿Seguro que deseas eliminar "${pendingDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        tone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
