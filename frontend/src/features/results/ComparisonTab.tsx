import { useState } from 'react'
import type { RunResult } from '../../types'
import { EmptyState } from '../../components/feedback/EmptyState'

export function ComparisonTab({ runs }: { runs: RunResult[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => runs.slice(0, 2).map((r) => r.id))
  const completedRuns = runs.filter((r) => r.status === 'completed' || r.status === 'failed')

  if (completedRuns.length < 2) {
    return (
      <EmptyState
        title="No hay suficientes corridas para comparar"
        description="Se necesitan al menos dos corridas finalizadas."
      />
    )
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectedRuns = completedRuns.filter((r) => selectedIds.includes(r.id))
  const parameterNames = Array.from(new Set(selectedRuns.flatMap((r) => Object.keys(r.parameters))))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <fieldset
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          border: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          Corridas a comparar
        </legend>
        {completedRuns.slice(0, 12).map((run) => (
          <label
            key={run.id}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(run.id)}
              onChange={() => toggleSelection(run.id)}
            />
            #{run.runIndex}
          </label>
        ))}
      </fieldset>

      {selectedRuns.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: 13 }}>Selecciona al menos una corrida.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 480 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-divider)' }}>
                <th style={{ padding: '8px 10px' }}>Métrica</th>
                {selectedRuns.map((run) => (
                  <th key={run.id} style={{ padding: '8px 10px' }}>
                    Corrida #{run.runIndex}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parameterNames.map((name) => (
                <tr key={name} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                  <td style={{ padding: '8px 10px', opacity: 0.65 }}>{name}</td>
                  {selectedRuns.map((run) => (
                    <td key={run.id} style={{ padding: '8px 10px' }}>
                      {run.parameters[name] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                <td style={{ padding: '8px 10px', opacity: 0.65 }}>Estado</td>
                {selectedRuns.map((run) => (
                  <td key={run.id} style={{ padding: '8px 10px' }}>
                    {run.status === 'completed' ? 'Completada' : 'Fallida'}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '8px 10px', opacity: 0.65 }}>Duración</td>
                {selectedRuns.map((run) => (
                  <td key={run.id} style={{ padding: '8px 10px' }}>
                    {run.durationSeconds !== null ? `${run.durationSeconds}s` : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
