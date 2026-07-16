import { AlertTriangle, CheckCircle2, Timer, XCircle } from 'lucide-react'
import type { SimulationResult } from '../../types'
import { formatDateTime, formatDuration } from '../../utils/format'

export function SummaryTab({ result }: { result: SimulationResult }) {
  const stats = [
    { label: 'Corridas totales', value: result.totalRuns, icon: Timer },
    { label: 'Completadas', value: result.completedRuns, icon: CheckCircle2 },
    { label: 'Fallidas', value: result.failedRuns, icon: XCircle },
    { label: 'Advertencias', value: result.warningsCount, icon: AlertTriangle },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 14,
        }}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
                opacity: 0.6,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '.06em',
              }}
            >
              <stat.icon size={14} aria-hidden="true" />
              {stat.label}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 600 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div
        className="card"
        style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Proyecto</span>
          <strong>{result.projectName}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Simulador</span>
          <strong>{result.simulatorId === 'xyce' ? 'Xyce' : 'ngspice'}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Duración total</span>
          <strong>{formatDuration(result.durationSeconds)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Completado</span>
          <strong>{formatDateTime(result.createdAt)}</strong>
        </div>
      </div>
    </div>
  )
}
