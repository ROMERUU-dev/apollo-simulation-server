import { AlertTriangle } from 'lucide-react'
import { computeSweepSummary, describeCombinations } from '../../../../utils/parameterSweep'
import type { ParameterDefinition } from '../../../../types'
import { ParameterRow } from './ParameterRow'
import type { WizardState } from '../wizardTypes'

interface ParametersStepProps {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

export function ParametersStep({ state, onChange }: ParametersStepProps) {
  const summary = computeSweepSummary(state.parameters)

  function updateParameter(id: string, patch: Partial<ParameterDefinition>) {
    onChange({
      parameters: state.parameters.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {state.parameters.length === 0 ? (
        <p style={{ opacity: 0.65, fontSize: 13 }}>
          No hay parámetros reales detectados. La extracción automática se habilitará con la API de
          simulación.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-divider)' }}>
                <th style={{ padding: '8px 5px' }}>Nombre</th>
                <th style={{ padding: '8px 5px' }}>Valor original</th>
                <th style={{ padding: '8px 5px' }}>Modo</th>
                <th style={{ padding: '8px 5px' }}>Valor fijo</th>
                <th style={{ padding: '8px 5px' }}>Inicio</th>
                <th style={{ padding: '8px 5px' }}>Fin</th>
                <th style={{ padding: '8px 5px' }}>Paso</th>
                <th style={{ padding: '8px 5px' }}>Lista</th>
                <th style={{ padding: '8px 5px' }}>Unidad</th>
                <th style={{ padding: '8px 5px', textAlign: 'right' }}># valores</th>
              </tr>
            </thead>
            <tbody>
              {state.parameters.map((parameter) => (
                <ParameterRow
                  key={parameter.id}
                  parameter={parameter}
                  sweep={summary.sweeps.find((s) => s.parameterId === parameter.id)}
                  onUpdate={(patch) => updateParameter(parameter.id, patch)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              opacity: 0.55,
            }}
          >
            Total de combinaciones
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600 }}>
            {summary.totalCombinations.toLocaleString('es')} corridas
            {state.parameters.length > 0 && (
              <> · {describeCombinations(state.parameters, summary.sweeps)}</>
            )}
          </div>
        </div>
        {summary.isHighCombinationCount && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: 'var(--status-warn-bg)',
              color: 'var(--status-warn)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
            }}
          >
            <AlertTriangle size={15} aria-hidden="true" />
            Número elevado de corridas: esta simulación puede tardar considerablemente.
          </div>
        )}
      </div>
    </div>
  )
}
