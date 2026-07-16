import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileUp, PencilLine } from 'lucide-react'
import { NetlistEditor } from '../../../../components/editor/NetlistEditor'
import { simulationService } from '../../../../services'
import type { NetlistTemplate } from '../../../../services/types'
import type { WizardState } from '../wizardTypes'

interface NetlistStepProps {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

export function NetlistStep({ state, onChange }: NetlistStepProps) {
  const [templates, setTemplates] = useState<NetlistTemplate[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    simulationService.listTemplates().then(setTemplates)
  }, [])

  const validation = simulationService.validateNetlist(state.netlistContent)
  const isDirty = state.netlistContent !== state.savedNetlistContent

  function handleFileSelected(file: File) {
    file.text().then((content) => {
      onChange({ netlistSource: 'upload', netlistFileName: file.name, netlistContent: content })
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label
          htmlFor="simulation-name"
          style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}
        >
          Nombre de la simulación
        </label>
        <input
          id="simulation-name"
          value={state.simulationName}
          onChange={(e) => onChange({ simulationName: e.target.value })}
          placeholder="p. ej. Barrido de temperatura ambiente"
          style={{
            width: '100%',
            maxWidth: 420,
            padding: '9px 12px',
            border: '1px solid var(--color-divider)',
            background: 'var(--color-surface)',
            color: 'inherit',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
        >
          <FileUp size={15} aria-hidden="true" /> Cargar archivo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".cir,.net,.sp,.spice,.txt"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelected(file)
            e.target.value = ''
          }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="visually-hidden">Elegir plantilla</span>
          <select
            value={state.selectedTemplateId ?? ''}
            onChange={(e) => {
              const template = templates.find((t) => t.id === e.target.value)
              if (template) {
                onChange({
                  netlistSource: 'template',
                  selectedTemplateId: template.id,
                  netlistContent: template.content,
                  netlistFileName: null,
                })
              }
            }}
            style={{
              padding: '9px 10px',
              border: '1px solid var(--color-divider)',
              background: 'var(--color-surface)',
              color: 'inherit',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <option value="">Elegir plantilla…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        {state.netlistFileName && (
          <span
            style={{ fontSize: 12.5, opacity: 0.65, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <PencilLine size={13} aria-hidden="true" /> {state.netlistFileName}
          </span>
        )}
        {isDirty && (
          <span style={{ fontSize: 12.5, color: 'var(--status-warn)' }} role="status">
            Cambios sin guardar
          </span>
        )}
      </div>

      <div>
        <label
          htmlFor="netlist-editor"
          style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}
        >
          Contenido del netlist
        </label>
        <NetlistEditor
          id="netlist-editor"
          value={state.netlistContent}
          ariaLabel="Contenido del netlist"
          onChange={(value) => onChange({ netlistContent: value, netlistSource: 'paste' })}
        />
        {!validation.valid && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              padding: '8px 12px',
              background: 'var(--status-bad-bg)',
              color: 'var(--status-bad)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
            }}
          >
            <AlertTriangle size={15} aria-hidden="true" />
            {validation.message}
          </div>
        )}
      </div>
    </div>
  )
}
