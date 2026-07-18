import type { ExecutionConfig, FailureBehavior, JobPriority } from '../../../../types'
import type { WizardState } from '../wizardTypes'

interface ExecutionStepProps {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }
const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--color-divider)',
  background: 'var(--color-surface)',
  color: 'inherit',
  borderRadius: 'var(--radius-sm)',
}

export function ExecutionStep({ state, onChange }: ExecutionStepProps) {
  function updateExecution(patch: Partial<ExecutionConfig>) {
    onChange({ execution: { ...state.execution, ...patch } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <div>
          <label style={labelStyle} htmlFor="parallel-jobs">
            Trabajos paralelos
          </label>
          <input
            id="parallel-jobs"
            type="number"
            min={1}
            max={1}
            disabled
            value={state.execution.parallelJobs}
            onChange={(e) => updateExecution({ parallelJobs: Number(e.target.value) })}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle} htmlFor="timeout">
            Timeout por corrida (s)
          </label>
          <input
            id="timeout"
            type="number"
            min={10}
            disabled
            value={state.execution.timeoutSeconds}
            onChange={(e) => updateExecution({ timeoutSeconds: Number(e.target.value) })}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle} htmlFor="priority">
            Prioridad
          </label>
          <select
            id="priority"
            disabled
            value={state.execution.priority}
            onChange={(e) => updateExecution({ priority: e.target.value as JobPriority })}
            style={inputStyle}
          >
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
          </select>
        </div>

        <div>
          <label style={labelStyle} htmlFor="on-failure">
            Comportamiento ante fallos
          </label>
          <select
            id="on-failure"
            disabled
            value={state.execution.onFailure}
            onChange={(e) => updateExecution({ onFailure: e.target.value as FailureBehavior })}
            style={inputStyle}
          >
            <option value="stop-all">Detener todo</option>
            <option value="skip-and-continue">Omitir y continuar</option>
            <option value="retry-then-skip">Reintentar y luego omitir</option>
          </select>
        </div>

        <div>
          <label style={labelStyle} htmlFor="reserved-threads">
            Hilos reservados
          </label>
          <input
            id="reserved-threads"
            type="number"
            min={0}
            max={0}
            disabled
            value={state.execution.reservedThreads}
            onChange={(e) => updateExecution({ reservedThreads: Number(e.target.value) })}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle} htmlFor="reserved-ram">
            RAM reservada (GB)
          </label>
          <input
            id="reserved-ram"
            type="number"
            min={1}
            max={1}
            disabled
            value={state.execution.reservedRamGb}
            onChange={(e) => updateExecution({ reservedRamGb: Number(e.target.value) })}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 24 }}>
          <input
            id="keep-files"
            type="checkbox"
            disabled
            checked={state.execution.keepIntermediateFiles}
            onChange={(e) => updateExecution({ keepIntermediateFiles: e.target.checked })}
          />
          <label htmlFor="keep-files" style={{ fontSize: 13 }}>
            Conservar archivos intermedios
          </label>
        </div>
      </div>

      <div className="card">
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '.06em',
            opacity: 0.55,
            marginBottom: 10,
          }}
        >
          Ejecución
        </div>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
          La configuración de ejecución es una vista previa. La API de jobs, colas y simuladores
          reales aún no está habilitada.
        </p>
      </div>
    </div>
  )
}
