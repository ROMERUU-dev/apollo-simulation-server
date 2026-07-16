import { useRef } from 'react'
import { AlertTriangle, FilePlus, Trash2 } from 'lucide-react'
import type { ModelFile, ModelFileKind } from '../../../../types'
import { createId } from '../../../../utils/id'
import { formatBytes } from '../../../../utils/format'
import { extractReferencedFileNames } from '../../../../utils/netlistReferences'
import type { WizardState } from '../wizardTypes'

interface FilesStepProps {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

function detectKind(fileName: string): ModelFileKind {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'lib' || ext === 'mod' || ext === 'model' || ext === 'inc') return ext
  return 'model'
}

export function FilesStep({ state, onChange }: FilesStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const referenced = extractReferencedFileNames(state.netlistContent)

  function addFiles(files: FileList) {
    const additions: ModelFile[] = Array.from(files).map((file) => ({
      id: createId('mf'),
      name: file.name,
      kind: detectKind(file.name),
      sizeBytes: file.size,
      referencedInNetlist: referenced.some(
        (ref) => ref.includes(file.name) || file.name.includes(ref),
      ),
      missing: false,
      uploadedAt: new Date().toISOString(),
    }))
    onChange({ associatedFiles: [...state.associatedFiles, ...additions] })
  }

  function removeFile(id: string) {
    onChange({ associatedFiles: state.associatedFiles.filter((f) => f.id !== id) })
  }

  const missingReferences = referenced.filter(
    (ref) => !state.associatedFiles.some((f) => f.name.includes(ref) || ref.includes(f.name)),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
        >
          <FilePlus size={15} aria-hidden="true" /> Agregar archivos (.lib, .mod, .model, .inc)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".lib,.mod,.model,.inc"
          className="visually-hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {missingReferences.length > 0 && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px',
            background: 'var(--status-warn-bg)',
            color: 'var(--status-warn)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
          }}
        >
          <AlertTriangle size={15} aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
          <span>
            El netlist referencia {missingReferences.length === 1 ? 'el archivo' : 'los archivos'}{' '}
            <strong>{missingReferences.join(', ')}</strong>, que aún no se{' '}
            {missingReferences.length === 1 ? 'ha' : 'han'} agregado.
          </span>
        </div>
      )}

      {state.associatedFiles.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: 13 }}>Sin archivos asociados todavía.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-divider)' }}>
              <th style={{ padding: '8px 6px' }}>Nombre</th>
              <th style={{ padding: '8px 6px' }}>Tipo</th>
              <th style={{ padding: '8px 6px' }}>Tamaño</th>
              <th style={{ padding: '8px 6px' }}>Referencia</th>
              <th style={{ padding: '8px 6px' }} aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {state.associatedFiles.map((file) => (
              <tr key={file.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                <td style={{ padding: '8px 6px' }}>{file.name}</td>
                <td style={{ padding: '8px 6px', textTransform: 'uppercase', opacity: 0.7 }}>
                  {file.kind}
                </td>
                <td style={{ padding: '8px 6px', opacity: 0.7 }}>{formatBytes(file.sizeBytes)}</td>
                <td style={{ padding: '8px 6px' }}>
                  {file.referencedInNetlist ? (
                    <span style={{ color: 'var(--status-ok)' }}>Detectada en netlist</span>
                  ) : (
                    <span style={{ opacity: 0.5 }}>Sin referencia detectada</span>
                  )}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    aria-label={`Eliminar ${file.name}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--status-bad)',
                    }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
