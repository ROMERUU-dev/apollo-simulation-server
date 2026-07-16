import { useMemo, useState } from 'react'
import { ClipboardCopy } from 'lucide-react'
import type { RunResult } from '../../types'
import { EmptyState } from '../../components/feedback/EmptyState'

const STATUS_LABEL: Record<RunResult['status'], string> = {
  queued: 'En cola',
  running: 'Ejecutando',
  completed: 'Completada',
  failed: 'Fallida',
}

export function RunsTab({ runs }: { runs: RunResult[] }) {
  const [statusFilter, setStatusFilter] = useState<RunResult['status'] | 'all'>('all')

  const filteredRuns = useMemo(
    () => (statusFilter === 'all' ? runs : runs.filter((r) => r.status === statusFilter)),
    [runs, statusFilter],
  )

  if (runs.length === 0) {
    return (
      <EmptyState
        title="Sin corridas"
        description="Esta simulación no registró corridas individuales."
      />
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          Filtrar por estado
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RunResult['status'] | 'all')}
            style={{
              padding: '6px 8px',
              border: '1px solid var(--color-divider)',
              background: 'var(--color-surface)',
              color: 'inherit',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <option value="all">Todos</option>
            <option value="completed">Completadas</option>
            <option value="failed">Fallidas</option>
            <option value="running">Ejecutando</option>
            <option value="queued">En cola</option>
          </select>
        </label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-divider)' }}>
              <th style={{ padding: '8px 6px' }}>Corrida</th>
              <th style={{ padding: '8px 6px' }}>Parámetros</th>
              <th style={{ padding: '8px 6px' }}>Estado</th>
              <th style={{ padding: '8px 6px' }}>Tiempo</th>
              <th style={{ padding: '8px 6px' }}>Resultado</th>
              <th style={{ padding: '8px 6px' }}>Advertencias</th>
              <th style={{ padding: '8px 6px' }} aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((run) => {
              const paramText = Object.entries(run.parameters)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')
              return (
                <tr key={run.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <td style={{ padding: '8px 6px' }}>#{run.runIndex}</td>
                  <td style={{ padding: '8px 6px', opacity: 0.75 }}>{paramText || '—'}</td>
                  <td style={{ padding: '8px 6px' }}>{STATUS_LABEL[run.status]}</td>
                  <td style={{ padding: '8px 6px', opacity: 0.75 }}>
                    {run.durationSeconds !== null ? `${run.durationSeconds}s` : '—'}
                  </td>
                  <td style={{ padding: '8px 6px' }}>{run.resultSummary ?? '—'}</td>
                  <td
                    style={{
                      padding: '8px 6px',
                      color: run.warnings.length > 0 ? 'var(--status-warn)' : undefined,
                    }}
                  >
                    {run.warnings.length > 0 ? run.warnings.join('; ') : '—'}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                    <button
                      type="button"
                      aria-label={`Copiar parámetros de la corrida ${run.runIndex}`}
                      onClick={() => navigator.clipboard?.writeText(paramText)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'inherit',
                        opacity: 0.7,
                      }}
                      disabled={!paramText}
                    >
                      <ClipboardCopy size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
