import { CheckCircle2, XCircle } from 'lucide-react'
import { useServerStatus } from '../../../../hooks/useServerStatus'
import { LoadingState } from '../../../../components/feedback/LoadingState'
import type { WizardState } from '../wizardTypes'

interface SimulatorStepProps {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

export function SimulatorStep({ state, onChange }: SimulatorStepProps) {
  const { status, loading } = useServerStatus()

  if (loading || !status) return <LoadingState label="Consultando simuladores disponibles…" />

  return (
    <div
      role="radiogroup"
      aria-label="Simulador"
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
    >
      {status.simulators.map((sim) => {
        const selected = state.simulatorId === sim.id
        return (
          <button
            key={sim.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!sim.available}
            onClick={() => onChange({ simulatorId: sim.id })}
            className="card"
            style={{
              textAlign: 'left',
              cursor: sim.available ? 'pointer' : 'not-allowed',
              opacity: sim.available ? 1 : 0.5,
              borderColor: selected ? 'var(--color-accent)' : undefined,
              borderWidth: selected ? 2 : 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16 }}>
                {sim.name} {sim.version}
              </span>
              {sim.available ? (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--status-ok)',
                    fontSize: 12,
                  }}
                >
                  <CheckCircle2 size={14} aria-hidden="true" /> Disponible
                </span>
              ) : (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--status-bad)',
                    fontSize: 12,
                  }}
                >
                  <XCircle size={14} aria-hidden="true" /> No disponible
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>{sim.description}</p>
          </button>
        )
      })}
    </div>
  )
}
