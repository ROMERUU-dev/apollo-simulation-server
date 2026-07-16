import { useServerStatus } from '../../../../hooks/useServerStatus'
import { LoadingState } from '../../../../components/feedback/LoadingState'
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
  const { status, loading } = useServerStatus()

  function updateExecution(patch: Partial<ExecutionConfig>) {
    onChange({ execution: { ...state.execution, ...patch } })
  }

  if (loading || !status) return <LoadingState label="Consultando recursos del servidor…" />

  const availableThreads = status.resources.cpuThreadsTotal - status.resources.cpuThreadsReserved
  const estimatedLoadPct = Math.min(
    100,
    Math.round(
      ((state.execution.parallelJobs + state.execution.reservedThreads) /
        status.resources.cpuThreadsTotal) *
        100,
    ),
  )

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
            max={availableThreads}
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
            max={availableThreads}
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
            max={status.resources.ramTotalGb}
            value={state.execution.reservedRamGb}
            onChange={(e) => updateExecution({ reservedRamGb: Number(e.target.value) })}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 24 }}>
          <input
            id="keep-files"
            type="checkbox"
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
          Recursos del servidor
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 14,
            fontSize: 13,
          }}
        >
          <div>
            <div style={{ opacity: 0.6, fontSize: 11.5 }}>Hilos totales</div>
            <div style={{ fontWeight: 600 }}>{status.resources.cpuThreadsTotal}</div>
          </div>
          <div>
            <div style={{ opacity: 0.6, fontSize: 11.5 }}>Hilos disponibles</div>
            <div style={{ fontWeight: 600 }}>{availableThreads}</div>
          </div>
          <div>
            <div style={{ opacity: 0.6, fontSize: 11.5 }}>Hilos reservados (sistema)</div>
            <div style={{ fontWeight: 600 }}>{status.resources.cpuThreadsReserved}</div>
          </div>
          <div>
            <div style={{ opacity: 0.6, fontSize: 11.5 }}>RAM total</div>
            <div style={{ fontWeight: 600 }}>{status.resources.ramTotalGb} GB</div>
          </div>
          <div>
            <div style={{ opacity: 0.6, fontSize: 11.5 }}>Almacenamiento libre</div>
            <div style={{ fontWeight: 600 }}>
              {(status.resources.storageTotalGb - status.resources.storageUsedGb).toFixed(0)} GB
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            <span>Carga estimada con esta configuración</span>
            <span>{estimatedLoadPct}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--color-neutral-200)', borderRadius: 3 }}>
            <div
              style={{
                height: '100%',
                width: `${estimatedLoadPct}%`,
                background: estimatedLoadPct > 85 ? 'var(--status-bad)' : 'var(--color-accent-600)',
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
