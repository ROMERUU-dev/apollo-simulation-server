import { CheckCircle2, XCircle } from 'lucide-react'
import type { SimulatorInfo } from '../../types'

export function SimulatorAvailabilityCard({ simulators }: { simulators: SimulatorInfo[] }) {
  return (
    <div className="card">
      <i className="card-corner tl" aria-hidden="true" />
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '.08em',
          opacity: 0.55,
          marginBottom: 8,
        }}
      >
        Simuladores
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4 }}>
        {simulators.map((sim) => (
          <div key={sim.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {sim.available ? (
              <CheckCircle2 size={15} color="var(--status-ok)" aria-hidden="true" />
            ) : (
              <XCircle size={15} color="var(--status-bad)" aria-hidden="true" />
            )}
            <span style={{ fontSize: 13.5 }}>
              {sim.name} {sim.version} — {sim.available ? 'Disponible' : 'No disponible'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
