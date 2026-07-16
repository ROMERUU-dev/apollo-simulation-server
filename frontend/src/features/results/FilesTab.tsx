import { Download, FileArchive } from 'lucide-react'
import type { GeneratedArtifact } from '../../types'
import { formatBytes, formatDateTime } from '../../utils/format'

const KIND_LABEL: Record<GeneratedArtifact['kind'], string> = {
  'raw-output': 'Salida cruda',
  log: 'Registro',
  'plot-data': 'Datos de gráfica',
  'netlist-snapshot': 'Copia del netlist',
  report: 'Reporte',
}

export function FilesTab({ artifacts }: { artifacts: GeneratedArtifact[] }) {
  if (artifacts.length === 0) {
    return <p style={{ opacity: 0.6, fontSize: 13 }}>Sin archivos generados.</p>
  }
  return (
    <ul style={{ margin: 0, padding: 0 }}>
      {artifacts.map((artifact) => (
        <li
          key={artifact.id}
          style={{
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 4px',
            borderBottom: '1px solid var(--color-divider)',
            fontSize: 13,
          }}
        >
          <FileArchive size={16} aria-hidden="true" style={{ opacity: 0.6, flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{artifact.name}</div>
            <div style={{ fontSize: 11.5, opacity: 0.6 }}>
              {KIND_LABEL[artifact.kind]} · {formatBytes(artifact.sizeBytes)} ·{' '}
              {formatDateTime(artifact.createdAt)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.alert(`Descarga simulada de ${artifact.name}`)}
            aria-label={`Descargar ${artifact.name}`}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-divider)',
              borderRadius: 'var(--radius-sm)',
              padding: 6,
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            <Download size={14} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
