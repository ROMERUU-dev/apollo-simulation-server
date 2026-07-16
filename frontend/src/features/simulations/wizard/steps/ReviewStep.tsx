import { useProjects } from '../../../../hooks/useProjects'
import { computeSweepSummary } from '../../../../utils/parameterSweep'
import type { WizardState } from '../wizardTypes'

interface ReviewStepProps {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onJumpToStep: (step: number) => void
}

const sectionStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 }
const rowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 12 }

export function ReviewStep({ state, onChange, onJumpToStep }: ReviewStepProps) {
  const { projects } = useProjects({ status: 'active' })
  const summary = computeSweepSummary(state.parameters)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={sectionStyle}>
        <label htmlFor="review-project" style={{ fontSize: 13, fontWeight: 600 }}>
          Proyecto
        </label>
        <select
          id="review-project"
          value={state.projectId ?? ''}
          onChange={(e) => onChange({ projectId: e.target.value || null })}
          style={{
            padding: '8px 10px',
            border: '1px solid var(--color-divider)',
            background: 'var(--color-bg)',
            color: 'inherit',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <option value="">Sin asignar</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>1. Netlist</h3>
          <button type="button" onClick={() => onJumpToStep(0)} style={{ fontSize: 12 }}>
            Editar
          </button>
        </div>
        <div style={rowStyle}>
          <span>Nombre</span>
          <strong>{state.simulationName || '(sin nombre)'}</strong>
        </div>
        <div style={rowStyle}>
          <span>Líneas</span>
          <strong>{state.netlistContent.split('\n').length}</strong>
        </div>
      </div>

      <div className="card" style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>2. Archivos asociados</h3>
          <button type="button" onClick={() => onJumpToStep(1)} style={{ fontSize: 12 }}>
            Editar
          </button>
        </div>
        <div style={rowStyle}>
          <span>Archivos</span>
          <strong>{state.associatedFiles.length}</strong>
        </div>
      </div>

      <div className="card" style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>3. Simulador</h3>
          <button type="button" onClick={() => onJumpToStep(2)} style={{ fontSize: 12 }}>
            Editar
          </button>
        </div>
        <div style={rowStyle}>
          <span>Seleccionado</span>
          <strong>{state.simulatorId ?? '(sin elegir)'}</strong>
        </div>
      </div>

      <div className="card" style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>4. Parámetros</h3>
          <button type="button" onClick={() => onJumpToStep(3)} style={{ fontSize: 12 }}>
            Editar
          </button>
        </div>
        <div style={rowStyle}>
          <span>Total de corridas</span>
          <strong>{summary.totalCombinations.toLocaleString('es')}</strong>
        </div>
      </div>

      <div className="card" style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>5. Ejecución</h3>
          <button type="button" onClick={() => onJumpToStep(4)} style={{ fontSize: 12 }}>
            Editar
          </button>
        </div>
        <div style={rowStyle}>
          <span>Trabajos paralelos</span>
          <strong>{state.execution.parallelJobs}</strong>
        </div>
        <div style={rowStyle}>
          <span>Prioridad</span>
          <strong>{state.execution.priority}</strong>
        </div>
      </div>
    </div>
  )
}
