import { Link } from 'react-router-dom'
import { Archive, ArchiveRestore, Copy, Trash2 } from 'lucide-react'
import type { Project } from '../../types'
import { OverflowMenu } from '../../components/navigation/OverflowMenu'
import { formatRelativeTime } from '../../utils/format'

interface ProjectCardProps {
  project: Project
  onDuplicate: (project: Project) => void
  onArchive: (project: Project) => void
  onUnarchive: (project: Project) => void
  onDelete: (project: Project) => void
}

export function ProjectCard({
  project,
  onDuplicate,
  onArchive,
  onUnarchive,
  onDelete,
}: ProjectCardProps) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <i className="card-corner tl" aria-hidden="true" />
      <i className="card-corner tr" aria-hidden="true" />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Link to={`/projects/${project.id}`} style={{ fontWeight: 600, fontSize: 15 }}>
          {project.name}
        </Link>
        <OverflowMenu
          label={`Acciones para ${project.name}`}
          actions={[
            {
              label: 'Duplicar',
              icon: <Copy size={14} aria-hidden="true" />,
              onSelect: () => onDuplicate(project),
            },
            project.status === 'active'
              ? {
                  label: 'Archivar',
                  icon: <Archive size={14} aria-hidden="true" />,
                  onSelect: () => onArchive(project),
                }
              : {
                  label: 'Restaurar',
                  icon: <ArchiveRestore size={14} aria-hidden="true" />,
                  onSelect: () => onUnarchive(project),
                },
            {
              label: 'Eliminar',
              icon: <Trash2 size={14} aria-hidden="true" />,
              onSelect: () => onDelete(project),
              danger: true,
            },
          ]}
        />
      </div>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.75, minHeight: 36 }}>{project.description}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {project.tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--color-neutral-200)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, opacity: 0.6 }}
      >
        <span>{project.status === 'archived' ? 'Archivado' : 'Activo'}</span>
        <span>Actualizado {formatRelativeTime(project.updatedAt)}</span>
      </div>
    </div>
  )
}
