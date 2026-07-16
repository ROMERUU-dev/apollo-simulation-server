import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/feedback/LoadingState'
import { EmptyState } from '../components/feedback/EmptyState'
import { useProjects } from '../hooks/useProjects'
import { formatBytes } from '../utils/format'

export default function ModelsPage() {
  const { projects, loading } = useProjects()
  const rows = projects.flatMap((project) => project.modelFiles.map((file) => ({ project, file })))

  return (
    <div>
      <PageHeader
        title="Modelos y librerías"
        subtitle="Archivos .lib, .mod, .model e .inc en todos los proyectos"
      />

      {loading ? (
        <LoadingState label="Cargando archivos de modelo…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin archivos de modelo"
          description="Los archivos añadidos a tus proyectos aparecerán aquí."
        />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-divider)' }}>
                <th style={{ padding: '8px 6px' }}>Nombre</th>
                <th style={{ padding: '8px 6px' }}>Tipo</th>
                <th style={{ padding: '8px 6px' }}>Proyecto</th>
                <th style={{ padding: '8px 6px' }}>Tamaño</th>
                <th style={{ padding: '8px 6px' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project, file }) => (
                <tr key={file.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <td style={{ padding: '8px 6px' }}>{file.name}</td>
                  <td style={{ padding: '8px 6px', textTransform: 'uppercase', opacity: 0.7 }}>
                    {file.kind}
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    <Link to={`/projects/${project.id}`}>{project.name}</Link>
                  </td>
                  <td style={{ padding: '8px 6px', opacity: 0.7 }}>
                    {formatBytes(file.sizeBytes)}
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    {file.missing ? (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          color: 'var(--status-warn)',
                        }}
                      >
                        <AlertTriangle size={13} aria-hidden="true" /> Referencia faltante
                      </span>
                    ) : (
                      <span style={{ opacity: 0.6 }}>OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
