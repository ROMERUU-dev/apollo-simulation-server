import { PageHeader } from '../components/layout/PageHeader'
import { LoadingState } from '../components/feedback/LoadingState'
import { ErrorState } from '../components/feedback/ErrorState'
import { useServerStatus } from '../hooks/useServerStatus'
import { ResourceMeter } from '../features/server/ResourceMeter'
import { SimulatorAvailabilityCard } from '../features/server/SimulatorAvailabilityCard'

export default function ResourcesPage() {
  const { status, loading, error, refresh } = useServerStatus()

  if (loading || !status) return <LoadingState label="Consultando recursos del servidor…" />
  if (error) return <ErrorState onRetry={refresh} />

  return (
    <div>
      <PageHeader title="Recursos del servidor" subtitle={`${status.model} · ${status.hostname}`} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          marginBottom: 26,
        }}
      >
        <ResourceMeter
          label="CPU"
          percent={status.resources.cpuThreadsUsedPct}
          detail={`${Math.round((status.resources.cpuThreadsUsedPct / 100) * status.resources.cpuThreadsTotal)} de ${status.resources.cpuThreadsTotal} hilos en uso`}
        />
        <ResourceMeter
          label="Memoria RAM"
          percent={(status.resources.ramUsedGb / status.resources.ramTotalGb) * 100}
          detail={`${status.resources.ramUsedGb.toFixed(1)} GB de ${status.resources.ramTotalGb} GB`}
        />
        <ResourceMeter
          label="Almacenamiento"
          percent={(status.resources.storageUsedGb / status.resources.storageTotalGb) * 100}
          detail={`${(status.resources.storageTotalGb - status.resources.storageUsedGb).toFixed(0)} GB de ${status.resources.storageTotalGb} GB libres`}
        />
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}
      >
        <section className="card">
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Distribución de hilos</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Hilos totales</span>
              <strong>{status.resources.cpuThreadsTotal}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Reservados para otros servicios</span>
              <strong>{status.resources.cpuThreadsReserved}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Disponibles para simulación</span>
              <strong>
                {status.resources.cpuThreadsTotal - status.resources.cpuThreadsReserved}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Trabajos activos</span>
              <strong>{status.activeJobsCount}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Trabajos en cola</span>
              <strong>{status.queuedJobsCount}</strong>
            </div>
          </div>
        </section>

        <SimulatorAvailabilityCard simulators={status.simulators} />
      </div>
    </div>
  )
}
