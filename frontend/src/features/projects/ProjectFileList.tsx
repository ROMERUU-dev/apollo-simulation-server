import { AlertTriangle, FileCode2, FileText } from 'lucide-react'
import type { ModelFile, Netlist } from '../../types'
import { formatBytes } from '../../utils/format'

export function NetlistList({ netlists }: { netlists: Netlist[] }) {
  if (netlists.length === 0) {
    return <p style={{ opacity: 0.6, fontSize: 13 }}>Sin netlists todavía.</p>
  }
  return (
    <ul style={{ margin: 0, padding: 0 }}>
      {netlists.map((netlist) => (
        <li
          key={netlist.id}
          style={{
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 4px',
            borderBottom: '1px solid var(--color-divider)',
            fontSize: 13,
          }}
        >
          <FileCode2 size={15} aria-hidden="true" style={{ opacity: 0.6, flex: 'none' }} />
          <span style={{ flex: 1 }}>{netlist.name}</span>
          <span style={{ opacity: 0.6, fontSize: 12 }}>{formatBytes(netlist.sizeBytes)}</span>
        </li>
      ))}
    </ul>
  )
}

export function ModelFileList({ modelFiles }: { modelFiles: ModelFile[] }) {
  if (modelFiles.length === 0) {
    return <p style={{ opacity: 0.6, fontSize: 13 }}>Sin archivos de modelo todavía.</p>
  }
  return (
    <ul style={{ margin: 0, padding: 0 }}>
      {modelFiles.map((file) => (
        <li
          key={file.id}
          style={{
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 4px',
            borderBottom: '1px solid var(--color-divider)',
            fontSize: 13,
          }}
        >
          <FileText size={15} aria-hidden="true" style={{ opacity: 0.6, flex: 'none' }} />
          <span style={{ flex: 1 }}>{file.name}</span>
          <span
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              opacity: 0.6,
              padding: '1px 6px',
              border: '1px solid var(--color-divider)',
              borderRadius: 999,
            }}
          >
            {file.kind}
          </span>
          <span style={{ opacity: 0.6, fontSize: 12 }}>{formatBytes(file.sizeBytes)}</span>
          {file.missing && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--status-warn)',
                fontSize: 12,
              }}
            >
              <AlertTriangle size={13} aria-hidden="true" />
              Referencia faltante
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
