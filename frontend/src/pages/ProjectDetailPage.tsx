import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Archive, ArchiveRestore, CirclePlus, Copy, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { BlueprintButton } from '../components/layout/BlueprintButton'
import { LoadingState } from '../components/feedback/LoadingState'
import { ErrorState } from '../components/feedback/ErrorState'
import { ConfirmDialog } from '../components/feedback/ConfirmDialog'
import { useProject } from '../hooks/useProjects'
import { useResults } from '../hooks/useResults'
import { projectService } from '../services'
import { NetlistList, ModelFileList } from '../features/projects/ProjectFileList'
import { ProjectActivityFeed } from '../features/projects/ProjectActivityFeed'
import { ResultListItemCompact } from '../features/results/ResultListItemCompact'

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { project, loading, refresh } = useProject(projectId)
  const { results } = useResults()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (loading) return <LoadingState label="Cargando proyecto…" />
  if (!project) {
    return (
      <ErrorState
        title="Proyecto no encontrado"
        description="Es posible que haya sido eliminado. Vuelve a la lista de proyectos."
        onRetry={() => navigate('/projects')}
      />
    )
  }

  const projectResults = results.filter((r) => r.projectId === project.id)

  async function handleDuplicate() {
    if (!project) return
    const copy = await projectService.duplicate(project.id)
    navigate(`/projects/${copy.id}`)
  }

  async function handleArchiveToggle() {
    if (!project) return
    if (project.status === 'active') await projectService.archive(project.id)
    else await projectService.unarchive(project.id)
    refresh()
  }

  async function handleDelete() {
    if (!project) return
    await projectService.remove(project.id)
    navigate('/projects')
  }

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={project.description}
        actions={
          <>
            <BlueprintButton
              icon={<CirclePlus size={16} aria-hidden="true" />}
              onClick={() => navigate('/simulations/new', { state: { projectId: project.id } })}
            >
              Nueva simulación
            </BlueprintButton>
            <button
              type="button"
              onClick={handleDuplicate}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <Copy size={15} aria-hidden="true" /> Duplicar
            </button>
            <button
              type="button"
              onClick={handleArchiveToggle}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              {project.status === 'active' ? (
                <>
                  <Archive size={15} aria-hidden="true" /> Archivar
                </>
              ) : (
                <>
                  <ArchiveRestore size={15} aria-hidden="true" /> Restaurar
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                color: 'var(--status-bad)',
              }}
            >
              <Trash2 size={15} aria-hidden="true" /> Eliminar
            </button>
          </>
        }
      />

      <div
        style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, alignItems: 'start' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section className="card">
            <h2 style={{ fontSize: 16, marginBottom: 10 }}>Netlists</h2>
            <NetlistList netlists={project.netlists} />
          </section>

          <section className="card">
            <h2 style={{ fontSize: 16, marginBottom: 10 }}>Archivos de modelo</h2>
            <ModelFileList modelFiles={project.modelFiles} />
          </section>

          <section className="card">
            <h2 style={{ fontSize: 16, marginBottom: 10 }}>Simulaciones</h2>
            <p style={{ opacity: 0.6, fontSize: 13 }}>
              Los proyectos aún no tienen persistencia real. La prueba RC fija se gestiona desde
              Trabajos.
            </p>
          </section>

          <section className="card">
            <h2 style={{ fontSize: 16, marginBottom: 10 }}>Resultados recientes</h2>
            {projectResults.length === 0 ? (
              <p style={{ opacity: 0.6, fontSize: 13 }}>Sin resultados todavía.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0 }}>
                {projectResults.map((result) => (
                  <ResultListItemCompact key={result.id} result={result} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card">
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Actividad</h2>
          <ProjectActivityFeed activity={project.activity} />
        </section>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Eliminar proyecto"
        description={`¿Seguro que deseas eliminar "${project.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
