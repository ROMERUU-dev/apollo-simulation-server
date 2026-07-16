import type { SimulationJob, SimulationResult } from '../../types'
import { formatDateTime, formatDuration } from '../../utils/format'

export function ConfigTab({
  result,
  job,
}: {
  result: SimulationResult
  job: SimulationJob | null
}) {
  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, maxWidth: 520 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Simulador</span>
        <strong>{result.simulatorId === 'xyce' ? 'Xyce 7.10.0' : 'ngspice 42'}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Proyecto</span>
        <strong>{result.projectName}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Corridas configuradas</span>
        <strong>{result.totalRuns}</strong>
      </div>
      {job && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Worker</span>
            <strong>{job.workerName}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Iniciado</span>
            <strong>{job.startedAt ? formatDateTime(job.startedAt) : '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Duración</span>
            <strong>{formatDuration(job.elapsedSeconds)}</strong>
          </div>
        </>
      )}
    </div>
  )
}
