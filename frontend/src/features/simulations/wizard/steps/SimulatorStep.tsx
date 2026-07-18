import { XCircle } from 'lucide-react'
import type { WizardState } from '../wizardTypes'

interface SimulatorStepProps {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

export function SimulatorStep({ state, onChange }: SimulatorStepProps) {
  const simulators = [
    { id: 'xyce' as const, name: 'Xyce' },
    { id: 'ngspice' as const, name: 'ngspice' },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Simulador"
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
    >
      {simulators.map((sim) => {
        const selected = state.simulatorId === sim.id
        return (
          <button
            key={sim.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled
            onClick={() => onChange({ simulatorId: sim.id })}
            className="card"
            style={{
              textAlign: 'left',
              cursor: 'not-allowed',
              opacity: 0.6,
              borderColor: selected ? 'var(--color-accent)' : undefined,
              borderWidth: selected ? 2 : 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16 }}>
                {sim.name}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--status-bad)',
                  fontSize: 12,
                }}
              >
                <XCircle size={14} aria-hidden="true" /> Ejecución no habilitada
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
              El backend autenticado está conectado, pero todavía no existe API de jobs ni ejecución
              real de simuladores.
            </p>
          </button>
        )
      })}
    </div>
  )
}
